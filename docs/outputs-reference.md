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
