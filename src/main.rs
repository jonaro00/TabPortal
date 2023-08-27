use std::{borrow::Cow, path::PathBuf, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use db::get_all_tab_metas;
use hyro::prelude::*;
use hyro::{context, Template};
use serde::Deserialize;
use shuttle_runtime::CustomError;
use shuttle_secrets::SecretStore;
use sqlx::PgPool;
use tower_http::services::ServeDir;
use ulid::Ulid;

mod api;
mod db;

const VERSION: &str = env!("CARGO_PKG_VERSION");

// #[derive(Template)]
// #[template(path = "tabportal.html")]
// struct TabPortal<'a> {
//     version: &'a str,
// }

// #[derive(Template)]
// #[template(path = "tabexplorer.html")]
// struct TabExplorer<'a> {
//     version: &'a str,
//     entries: Vec<Entry>,
// }

// struct Entry {
//     name: String,
//     path: String,
// }

// #[derive(Default, Template)]
// #[template(path = "tabeditor.html")]
// struct TabEditor<'a> {
//     version: &'a str,
//     tab_file: &'a str,
//     readonly: bool,
//     alpha_tex: String,
//     name: String,
// }

async fn index(template: Template) -> Html<Cow<'static, str>> {
    template.render(context! {
        version => VERSION,
    })
}

#[derive(Deserialize)]
struct MenuQuery {
    editor: Option<bool>,
}
async fn menu(Query(q): Query<MenuQuery>, template: Template) -> Html<Cow<'static, str>> {
    template.render(context! {
        editor => q.editor.unwrap_or_default(),
    })
}

async fn explorer(State(state): State<AppState>) -> impl IntoResponse {
    // get_all_tab_metas(&state.pool)
    //     .await
    //     .map(|v| {
    //         let entries: Vec<_> = v
    //             .iter()
    //             .map(|t| Entry {
    //                 name: t.name.clone(),
    //                 path: format!("/tabs/{}", t.id),
    //             })
    //             .collect();
    //         HtmlTemplate(TabExplorer {
    //             entries,
    //             version: VERSION,
    //         })
    //     })
    //     .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct EditorQuery {
    edit: Option<bool>,
}
async fn tabeditor(
    State(state): State<AppState>,
    Path(id): Path<Ulid>,
    Query(q): Query<EditorQuery>,
    template: Template,
) -> impl IntoResponse {
    db::get_tab(&state.pool, id)
        .await
        .map(|t| {
            template.render(context! {
                // editor => q.editor.unwrap_or_default(),
                readonly => q.edit.is_none(),
                alpha_tex => t.tex,
                name => t.name,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Clone, Debug)]
pub struct AppStateInner {
    pub master_pass: String,
    pub pool: PgPool,
}

pub type AppState = Arc<AppStateInner>;

#[shuttle_runtime::main]
async fn axum(
    #[shuttle_secrets::Secrets] secrets: SecretStore,
    #[shuttle_static_folder::StaticFolder] static_folder: PathBuf,
    #[shuttle_shared_db::Postgres] pool: PgPool,
) -> Result<AxumService, shuttle_runtime::Error> {
    sqlx::migrate!()
        .run(&pool)
        .await
        .map_err(CustomError::new)?;

    let master_pass = secrets.get("MASTER_PASS").expect("master password");

    let state: AppState = Arc::new(AppStateInner { pool, master_pass });

    let mut router = Router::new()
        .route("/", get(index))
        .route("/menu", get(menu))
        .route("/tabs", get(explorer))
        .route("/tabs/:id", get(tabeditor))
        .route("/tabeditor", get(tabeditor))
        .nest("/api", api::api_router(state.clone()))
        .nest_service("/static", ServeDir::new(static_folder))
        .with_state(state);

    // if cfg!(debug_assertions) {
    //     router = router.layer(tower_livereload::LiveReloadLayer::new());
    // }

    Ok(AxumService(router))
}

use std::net::SocketAddr;

pub struct AxumService(pub axum::Router);

#[shuttle_runtime::async_trait]
impl shuttle_runtime::Service for AxumService {
    async fn bind(mut self, _addr: SocketAddr) -> Result<(), shuttle_runtime::Error> {
        // let s = addr.to_string();
        axum::Server::from_tcp(hyro::bind("127.0.0.1:8000"))
            .unwrap()
            .serve(self.0.into_service_with_hmr())
            .await
            .map_err(shuttle_runtime::CustomError::new)?;

        Ok(())
    }
}
