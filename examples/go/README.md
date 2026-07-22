# Go Example

This example shows a small Go server that serves a hand-authored OpenAPI document and a JSON endpoint.

## Files

- `backend/main.go`
- `backend/openapi.json`
- `frontend/example.ts`
- `typebridge.config.json`

## Run The Backend

From the repo root:

```bash
go run ./examples/go/backend
```

OpenAPI will be available at `http://127.0.0.1:8030/openapi.json`.

## Generate Frontend Code

From the repo root:

```bash
npm install
npm run build
node dist/cli.js generate --config ./examples/go/typebridge.config.json
```

## Validate And Check

```bash
node dist/cli.js config validate --config ./examples/go/typebridge.config.json
node dist/cli.js check --config ./examples/go/typebridge.config.json
```

## Frontend Usage

The frontend usage sample is in `frontend/example.ts`.
