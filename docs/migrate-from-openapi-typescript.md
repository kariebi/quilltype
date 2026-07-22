# Migrate From `openapi-typescript`

Use this migration path when your team already generates types with `openapi-typescript` and wants Quill Type's workflow features around that core step.

## What Stays Familiar

- OpenAPI remains the source of truth
- generated TypeScript types still exist
- generated files are still committed when you want CI freshness checks

## What Changes

- Quill Type adds stable commands around generation
- config validation becomes explicit
- watch mode and doctor become available
- breaking-change checks can run in CI
- multiple output modes can come from one contract

## Minimal Migration

1. Add `quilltype` as a dependency.
2. Create `quilltype.config.json`.
3. Start with `mode: "types"`.
4. Replace your old generation script with `quilltype generate`.
5. Add `quilltype check` to CI.

## Example

```json
{
  "source": {
    "path": "./openapi.json"
  },
  "outputs": [
    {
      "path": "./src/generated/api-types.ts",
      "mode": "types"
    }
  ],
  "breaking": {
    "against": {
      "path": "./openapi.prev.json"
    },
    "includeWarnings": true
  }
}
```

## When To Stop At `types`

Stay on `types` first if your project already has:

- a mature fetch wrapper
- a custom API SDK
- a frontend data layer you do not want to replace yet

You can add `fetch-client`, `axios-client`, `react-query`, `swr`, or `zod` later without changing the source contract.
