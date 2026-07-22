# Express Example

This example shows a contract-last Express server that serves an explicit `openapi.json` alongside the application routes.

## Files

- `backend/package.json`
- `backend/server.mjs`
- `backend/openapi.json`
- `frontend/example.ts`
- `quilltype.config.json`

## Run The Backend

From the repo root:

```bash
cd examples/express/backend
npm install
npm start
```

OpenAPI will be available at `http://127.0.0.1:8020/openapi.json`.

## Generate Frontend Code

From the repo root:

```bash
npm install
npm run build
node dist/cli.js generate --config ./examples/express/quilltype.config.json
```

## Validate And Check

```bash
node dist/cli.js config validate --config ./examples/express/quilltype.config.json
node dist/cli.js check --config ./examples/express/quilltype.config.json
```

## Frontend Usage

The frontend usage sample is in `frontend/example.ts`.
