use std::{path::PathBuf, sync::Arc};

use askama::Template;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use db::get_all_tabs;
use serde::Deserialize;
use shuttle_runtime::CustomError;
use shuttle_secrets::SecretStore;
use sqlx::PgPool;
use tower_http::services::ServeDir;
use ulid::Ulid;

mod api;
mod db;

#[derive(Template)]
#[template(path = "tabportal.html")]
struct TabPortal;

#[derive(Template)]
#[template(path = "tabviewer.html")]
struct TabViewer {
    tab_file: String,
}

#[derive(Template)]
#[template(path = "tabexplorer.html")]
struct TabExplorer {
    entries: Vec<Entry>,
}

struct Entry {
    name: String,
    path: String,
}

#[derive(Default, Template)]
#[template(path = "tabeditor.html")]
struct TabEditor<'a> {
    readonly: bool,
    alpha_tex: String,
    name: String,
    tab_file: &'a str,
}

async fn home() -> impl IntoResponse {
    HtmlTemplate(TabEditor::default())
}

async fn explorer(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    get_all_tabs(&state.pool)
        .await
        .map(|v| {
            let x: Vec<_> = v
                .iter()
                .map(|t| Entry {
                    name: t.name.clone(),
                    path: format!("/tabs/{}", t.id),
                })
                .collect();
            HtmlTemplate(TabExplorer { entries: x })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct EditorQuery {
    edit: Option<bool>,
}
async fn editor(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Ulid>,
    Query(q): Query<EditorQuery>,
) -> impl IntoResponse {
    db::get_tab(&state.pool, id)
        .await
        .map(|t| {
            HtmlTemplate(TabEditor {
                readonly: q.edit.is_none(),
                alpha_tex: t.tex,
                name: t.name,
                tab_file: "",
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Clone)]
pub struct AppState {
    pub master_pass: String,
    pub pool: PgPool,
}

#[shuttle_runtime::main]
async fn axum(
    #[shuttle_secrets::Secrets] secrets: SecretStore,
    #[shuttle_static_folder::StaticFolder] static_folder: PathBuf,
    #[shuttle_shared_db::Postgres] pool: PgPool,
) -> shuttle_axum::ShuttleAxum {
    sqlx::migrate!()
        .run(&pool)
        .await
        .map_err(CustomError::new)?;

    let master_pass = secrets.get("MASTER_PASS").expect("master password");

    let state = Arc::new(AppState { pool, master_pass });

    let router = Router::new()
        .route("/", get(home))
        .route("/tabs", get(explorer))
        .route("/tabs/:id", get(editor))
        .nest("/api", api::api_router(state.clone()))
        .nest_service("/static", ServeDir::new(static_folder))
        .with_state(state);

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
