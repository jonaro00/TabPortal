use std::io::Write;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use ulid::Ulid;

use crate::{
    db::{self, TabBody},
    AppState,
};

async fn tab(State(state): State<AppState>, Path(id): Path<Ulid>) -> impl IntoResponse {
    db::get_tab(&state.pool, id)
        .await
        .map(|t| t.tex)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn all_tab_metas(State(state): State<AppState>) -> impl IntoResponse {
    db::get_all_tab_metas(&state.pool)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn export_all_tabs(State(state): State<AppState>) -> impl IntoResponse {
    let tabs = db::get_all_tabs(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let vec = vec![0; 1024];
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(vec));

    let zip_options =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    let trc_options = sanitize_filename::Options {
        truncate: true,
        windows: true,
        replacement: "",
    };

    for t in tabs {
        zip.start_file(
            sanitize_filename::sanitize_with_options(
                format!("{}.atx", t.name),
                trc_options.clone(),
            ),
            zip_options,
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        zip.write(t.tex.as_bytes())
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let c = zip
        .finish()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    drop(zip);

    let pos = c.position() as usize;
    let mut v = c.into_inner();
    v.truncate(pos);

    Result::<_, StatusCode>::Ok(v)
}

async fn new_tab(State(state): State<AppState>, Json(b): Json<TabBody>) -> impl IntoResponse {
    db::create_tab(&state.pool, b.name, b.tex)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_tab(
    State(state): State<AppState>,
    Path(id): Path<Ulid>,
    Json(b): Json<TabBody>,
) -> impl IntoResponse {
    db::update_tab(&state.pool, id, b.name, b.tex)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_tab(State(state): State<AppState>, Path(id): Path<Ulid>) -> impl IntoResponse {
    db::delete_tab(&state.pool, id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn auth(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get("X-Tp-Pass")
        .and_then(|header| header.to_str().ok());

    match auth_header {
        Some(auth_header) if auth_header == state.master_pass => Ok(next.run(req).await),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

pub fn api_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/tabs", post(new_tab))
        .route("/tabs/:id", put(update_tab).delete(delete_tab))
        .layer(middleware::from_fn_with_state(state, auth))
        .route("/tabs", get(all_tab_metas))
        .route("/tabs/:id", get(tab))
        .route("/tabs/tabportal_export.zip", get(export_all_tabs))
}
