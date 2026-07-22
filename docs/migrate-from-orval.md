# Migrate From `orval`

Use this migration path when you want a smaller CLI surface and more explicit contract workflow checks.

## Main Difference

`orval` is strongest when you want rich frontend client generation features immediately.

Quill Type is strongest when you want:

- stable generation commands
- lighter output modes
- breaking-change checks
- config validation
- watch and doctor tooling

## Recommended Migration Strategy

1. Start with one service, not the whole platform.
2. Generate `types` or `fetch-client` first.
3. Add `react-query` or `swr` only where it fits.
4. Add `check` in CI before replacing every old workflow.

## Mapping

- `orval` type-focused usage -> Quill Type `types`
- `orval` client generation -> Quill Type `fetch-client` or `axios-client`
- `orval` React Query flow -> Quill Type `react-query`
- runtime validation workflows -> Quill Type `zod`

## Watchouts

- Quill Type intentionally exposes fewer generation knobs right now
- some advanced `orval` customizations may still be better kept in `orval`
- Quill Type favors predictable contract workflows over deep framework specialization
