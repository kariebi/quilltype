# Breaking-Change Checks Guide

Quill Type can compare the current contract against a previous contract and fail CI when the change is not backward compatible.

## Supported Breaking Changes

- removed paths
- removed operations
- removed response status codes
- removed enum values
- incompatible schema type changes
- request body fields that became required
- request parameters that became required
- response fields removed from successful responses

## Supported Warnings

Quill Type also reports important non-breaking changes so CI logs and release reviews have more context.

- added paths
- added operations
- enum values added to existing schemas
- operations newly marked as deprecated

## Config Example

```json
{
  "source": {
    "path": "./openapi.next.json"
  },
  "breaking": {
    "against": {
      "path": "./openapi.prev.json"
    },
    "includeWarnings": true,
    "report": {
      "format": "json",
      "output": "./reports/contract-report.json"
    }
  },
  "outputs": [
    {
      "path": "./src/generated/api-types.ts",
      "mode": "types"
    }
  ]
}
```

## CLI Example

```bash
node dist/cli.js check \
  --input ./openapi.next.json \
  --against ./openapi.prev.json \
  --report-format markdown \
  --report-file ./reports/contract-report.md \
  --output ./src/generated/api-types.ts:types
```

## Report Formats

- `text`
  Good for local terminal output and basic CI logs.
- `json`
  Good for machine-readable post-processing.
- `markdown`
  Good for artifacts, release notes, or pull request summaries.

## Recommended Usage

- use a tagged or committed previous contract as the baseline
- keep generated files committed
- run `check` in CI on every pull request
- treat failures as contract review prompts, not just codegen errors
