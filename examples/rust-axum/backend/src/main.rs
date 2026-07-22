use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;

static OPENAPI: &str = include_str!("../openapi.json");

#[derive(Serialize)]
struct Deployment {
    id: &'static str,
    environment: &'static str,
    status: &'static str,
}

async fn openapi() -> Json<serde_json::Value> {
    Json(serde_json::from_str(OPENAPI).expect("valid openapi"))
}

async fn list_deployments() -> Json<Vec<Deployment>> {
    Json(vec![Deployment {
        id: "dep_1",
        environment: "production",
        status: "running",
    }])
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/openapi.json", get(openapi))
        .route("/deployments", get(list_deployments));
    let addr = SocketAddr::from(([127, 0, 0, 1], 8040));

    println!("Rust Axum example listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind listener");
    axum::serve(listener, app).await.expect("serve app");
}
