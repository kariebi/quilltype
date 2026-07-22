# Monorepo Example

This example shows one frontend app consuming contracts from multiple services in a monorepo-style layout.

## Layout

- `services/catalog/openapi.json`
- `services/orders/openapi.json`
- `apps/web/quilltype.catalog.json`
- `apps/web/quilltype.orders.json`

## Generate Catalog Client

```bash
npm run build
node dist/cli.js generate --config ./examples/monorepo/apps/web/quilltype.catalog.json
```

## Generate Orders Client

```bash
node dist/cli.js generate --config ./examples/monorepo/apps/web/quilltype.orders.json
```
