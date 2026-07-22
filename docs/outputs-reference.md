# Outputs Reference

## `types`

Generates TypeScript types from OpenAPI.

Use this when:

- you already have a custom fetch layer
- you only need type safety
- you want the smallest generated surface

## `fetch-client`

Generates:

- TypeScript types
- a tiny fetch-based runtime
- one function per operation

Use this when:

- you want a lightweight client
- you do not want a larger framework dependency
- you want to share a client between browser and server code

## `react-query`

Generates:

- TypeScript types
- fetch helpers
- query helpers for read operations
- mutation helpers for write operations

Use this when:

- your frontend uses TanStack React Query
- you want query keys and hooks generated from the contract
- you want backend changes reflected directly in React usage

## `axios-client`

Generates:

- TypeScript types
- an Axios-based runtime
- one function per operation

Use this when:

- your application already standardizes on Axios
- you want request interceptors and shared Axios instances
- you do not want to wrap the generated client yourself

## `swr`

Generates:

- TypeScript types
- fetch helpers
- SWR hooks for reads
- SWR mutation hooks for writes

Use this when:

- your frontend uses SWR
- you want lightweight React data hooks from the contract
- you prefer SWR over React Query

## `zod`

Generates:

- TypeScript types
- Zod schemas for components
- Zod schemas for operation request and success response payloads

Use this when:

- you want runtime validation near the generated contract
- you want to validate API payloads at the boundary
- you already use Zod in the frontend or edge layer

Notes:

- generated `react-query` output expects `@tanstack/react-query`
- generated `axios-client` output expects `axios`
- generated `swr` output expects `swr`
- generated `zod` output expects `zod`
- generated `json-schema` output is plain JSON and can feed non-TypeScript tooling

## `json-schema`

Generates:

- a JSON bundle of component schemas
- per-operation request schemas
- per-operation success response schemas

Use this when:

- you want raw JSON Schema artifacts for runtime validation pipelines
- you need to hand schema bundles to non-TypeScript tooling
- you want a predictable machine-readable export in CI
