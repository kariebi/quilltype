# Config Reference

## Root Fields

- `$schema`
  Optional path or URL to the Quill Type config schema.
- `source`
  The OpenAPI source to read.
- `outputs`
  One or more generated outputs.
- `validation`
  Contract quality rules.
- `breaking`
  Previous contract source for breaking-change checks.
- `watch`
  Watch behavior for polling and retries.

## `source`

```json
{
  "path": "./openapi.yaml"
}
```

or

```json
{
  "url": "https://api.example.com/openapi.json",
  "headers": {
    "authorization": "Bearer ${API_TOKEN}"
  }
}
```

Rules:

- use either `path` or `url`
- `headers` is only needed for remote sources
- `${ENV_VAR}` placeholders are expanded at load time

## `outputs`

Each output needs:

- `path`
- `mode`

Example:

```json
{
  "path": "./src/generated/api-client.ts",
  "mode": "fetch-client"
}
```

Supported modes:

- `types`
- `fetch-client`
- `react-query`
- `axios-client`
- `swr`
- `zod`
- `json-schema`

## `validation`

- `requireOperationIds`
- `requireResponseSchemas`

## `breaking`

```json
{
  "against": {
    "path": "./openapi.prev.json"
  },
  "includeWarnings": true,
  "report": {
    "format": "markdown",
    "output": "./reports/contract-report.md"
  }
}
```

Fields:

- `against`
  The previous contract to compare against.
- `includeWarnings`
  Whether non-breaking but notable changes should be included.
- `report.format`
  `text`, `json`, or `markdown`.
- `report.output`
  Optional file path for a saved report.

## `watch`

```json
{
  "pollIntervalMs": 30000,
  "retryDelayMs": 5000
}
```

For remote sources:

- `pollIntervalMs` controls how often the contract is re-fetched
- `retryDelayMs` controls retry timing when the source is unavailable
