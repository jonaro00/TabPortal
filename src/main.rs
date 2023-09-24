use std::sync::Arc;

use askama::Template;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use db::get_all_tab_metas;
use serde::Deserialize;
use shuttle_runtime::CustomError;
use shuttle_secrets::SecretStore;
use sqlx::PgPool;
use tower_http::services::ServeDir;
use ulid::Ulid;

mod api;
mod db;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Template)]
#[template(path = "tabportal.html")]
struct TabPortal<'a> {
    version: &'a str,
}

#[derive(Template)]
#[template(path = "tabviewer.html")]
struct TabViewer<'a> {
    version: &'a str,
    tab_file: String,
}

#[derive(Template)]
#[template(path = "tabexplorer.html")]
struct TabExplorer<'a> {
    version: &'a str,
    entries: Vec<Entry>,
}

struct Entry {
    name: String,
    path: String,
}

#[derive(Default, Template)]
#[template(path = "tabeditor.html")]
struct TabEditor<'a> {
    version: &'a str,
    readonly: bool,
    alpha_tex: String,
    name: String,
    tab_file: &'a str,
}

async fn home() -> impl IntoResponse {
    HtmlTemplate(TabEditor {
        version: VERSION,
        ..Default::default()
    })
}

async fn explorer(State(state): State<AppState>) -> impl IntoResponse {
    get_all_tab_metas(&state.pool)
        .await
        .map(|v| {
            let entries: Vec<_> = v
                .iter()
                .map(|t| Entry {
                    name: t.name.clone(),
                    path: format!("/tabs/{}", t.id),
                })
                .collect();
            HtmlTemplate(TabExplorer {
                entries,
                version: VERSION,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct EditorQuery {
    edit: Option<bool>,
}
async fn editor(
    State(state): State<AppState>,
    Path(id): Path<Ulid>,
    Query(q): Query<EditorQuery>,
) -> impl IntoResponse {
    db::get_tab(&state.pool, id)
        .await
        .map(|t| {
            HtmlTemplate(TabEditor {
                version: VERSION,
                readonly: q.edit.is_none(),
                alpha_tex: t.tex,
                name: t.name,
                tab_file: "",
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Clone)]
pub struct AppStateInner {
    pub master_pass: String,
    pub pool: PgPool,
}

pub type AppState = Arc<AppStateInner>;

#[shuttle_runtime::main]
async fn axum(
    #[shuttle_secrets::Secrets] secrets: SecretStore,
    #[shuttle_shared_db::Postgres] pool: PgPool,
) -> shuttle_axum::ShuttleAxum {
    sqlx::migrate!()
        .run(&pool)
        .await
        .map_err(CustomError::new)?;

    let master_pass = secrets.get("MASTER_PASS").expect("master password");

    let state: AppState = Arc::new(AppStateInner { pool, master_pass });

    let mut router = Router::new()
        .route("/", get(home))
        .route("/tabs", get(explorer))
        .route("/tabs/:id", get(editor))
        .nest("/api", api::api_router(state.clone()))
        .nest_service("/static", ServeDir::new("static"))
        .with_state(state);

    if cfg!(debug_assertions) {
        router = router.layer(tower_livereload::LiveReloadLayer::new());
    }

    Ok(router.into())
}

struct HtmlTemplate<T>(T);

impl<T> IntoResponse for HtmlTemplate<T>
where
    T: Template,
{
    fn into_response(self) -> Response {
        match self.0.render() {
            Ok(html) => Html(html).into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to render template. Error: {}", err),
            )
                .into_response(),
        }
    }
}
