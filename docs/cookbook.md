# Cookbook

## FastAPI + React Query

- backend: FastAPI auto-exposes the contract
- output modes: `types`, `fetch-client`, `react-query`
- example: [examples/fastapi](../examples/fastapi/README.md)

## Go + Fetch

- backend: serve a checked-in or generated OpenAPI document
- output modes: `types`, `fetch-client`
- example: [examples/go](../examples/go/README.md)

## NestJS + Axios

- backend: generate or export `openapi.json`
- output modes: `types`, `axios-client`
- example: [examples/nest](../examples/nest/README.md)

## Runtime Validation With Zod

- output modes: `types`, `zod`
- use generated component schemas at the API boundary
- validate request payloads before they hit app logic

## CI Contract Review

- run `quilltype generate`
- commit generated output
- run `quilltype check`
- optionally save `json` or `markdown` contract reports as CI artifacts
