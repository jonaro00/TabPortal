use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgRow, types::Uuid, FromRow, PgPool, Row};
use ulid::Ulid;

#[derive(Serialize, Deserialize)]
pub struct TabMeta {
    pub id: Ulid,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Tab {
    pub id: Ulid,
    pub name: String,
    pub tex: String,
}

#[derive(Serialize, Deserialize)]
pub struct TabBody {
    pub name: String,
    pub tex: String,
}

impl FromRow<'_, PgRow> for TabMeta {
    fn from_row(row: &'_ PgRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get::<'_, Uuid, _>("id").map(Ulid::from)?,
            name: row.try_get("name")?,
        })
    }
}

impl FromRow<'_, PgRow> for Tab {
    fn from_row(row: &'_ PgRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get::<'_, Uuid, _>("id").map(Ulid::from)?,
            name: row.try_get("name")?,
            tex: row.try_get("tex")?,
        })
    }
}

pub async fn get_tab(pool: &PgPool, id: Ulid) -> Result<Tab, sqlx::Error> {
    sqlx::query_as("SELECT * FROM tabs WHERE id = $1")
        .bind(Uuid::from(id))
        .fetch_one(pool)
        .await
}

pub async fn get_all_tabs(pool: &PgPool) -> Result<Vec<TabMeta>, sqlx::Error> {
    sqlx::query_as("SELECT id, name FROM tabs ORDER BY name")
        .fetch_all(pool)
        .await
}

pub async fn create_tab(pool: &PgPool, name: String, tex: String) -> Result<Tab, sqlx::Error> {
    sqlx::query_as("INSERT INTO tabs (id, name, tex) VALUES ($1, $2, $3) RETURNING *")
        .bind(Uuid::from(Ulid::new()))
        .bind(name)
        .bind(tex)
        .fetch_one(pool)
        .await
}

pub async fn update_tab(
    pool: &PgPool,
    id: Ulid,
    name: String,
    tex: String,
) -> Result<Tab, sqlx::Error> {
    sqlx::query_as("UPDATE tabs SET name = $1, tex = $2 WHERE id = $3 RETURNING *")
        .bind(name)
        .bind(tex)
        .bind(Uuid::from(id))
        .fetch_one(pool)
        .await
}

pub async fn delete_tab(pool: &PgPool, id: Ulid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM tabs WHERE id = $1")
        .bind(Uuid::from(id))
        .fetch_optional(pool)
        .await
        .map(|_| ())
}
