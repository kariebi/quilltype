# NestJS Example

This example shows a tiny NestJS backend exporting an OpenAPI document and a frontend client generated with Quill Type.

Files:

- `backend/package.json`
- `backend/src/main.ts`
- `backend/openapi.json`
- `frontend/example.ts`
- `quilltype.config.json`

## Backend

```bash
cd examples/nest/backend
npm install
npm run start
```

## Generate

From the repo root:

```bash
npm run build
node dist/cli.js generate --config ./examples/nest/quilltype.config.json
```

## Validate And Check

```bash
node dist/cli.js config validate --config ./examples/nest/quilltype.config.json
node dist/cli.js check --config ./examples/nest/quilltype.config.json
```
