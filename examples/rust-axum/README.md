# Rust + Axum Example

This example shows a minimal Axum server that serves an OpenAPI file and a JSON endpoint. Rust works fine for the TypeBridge flow as long as the server exposes a reliable machine-readable contract.

## Files

- `backend/Cargo.toml`
- `backend/src/main.rs`
- `backend/openapi.json`
- `frontend/app.tsx`
- `typebridge.config.json`

## Run The Backend

From the repo root:

```bash
cargo run --manifest-path ./examples/rust-axum/backend/Cargo.toml
```

OpenAPI will be available at `http://127.0.0.1:8040/openapi.json`.

## Generate Frontend Code

From the repo root:

```bash
npm install
npm run build
node dist/cli.js generate --config ./examples/rust-axum/typebridge.config.json
```

## Validate And Check

```bash
node dist/cli.js config validate --config ./examples/rust-axum/typebridge.config.json
node dist/cli.js check --config ./examples/rust-axum/typebridge.config.json
```

## Frontend Usage

The frontend usage sample is in `frontend/app.tsx`.
