use std::sync::Arc;

use axum::{
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

async fn tab(State(state): State<Arc<AppState>>, Path(id): Path<Ulid>) -> impl IntoResponse {
    db::get_tab(&state.pool, id)
        .await
        .map(|t| t.tex)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn all_tabs(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    db::get_all_tabs(&state.pool)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn new_tab(State(state): State<Arc<AppState>>, Json(b): Json<TabBody>) -> impl IntoResponse {
    db::create_tab(&state.pool, b.name, b.tex)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_tab(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Ulid>,
    Json(b): Json<TabBody>,
) -> impl IntoResponse {
    db::update_tab(&state.pool, id, b.name, b.tex)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_tab(State(state): State<Arc<AppState>>, Path(id): Path<Ulid>) -> impl IntoResponse {
    db::delete_tab(&state.pool, id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn auth<B>(
    State(state): State<Arc<AppState>>,
    req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get("X-Tp-Pass")
        .and_then(|header| header.to_str().ok());

    match auth_header {
        Some(auth_header) if auth_header == state.master_pass => Ok(next.run(req).await),
        _ => return Err(StatusCode::UNAUTHORIZED),
    }
}

pub fn api_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/tabs", post(new_tab))
        .route("/tabs/:id", put(update_tab).delete(delete_tab))
        .layer(middleware::from_fn_with_state(state, auth))
        .route("/tabs", get(all_tabs))
        .route("/tabs/:id", get(tab))
}
