# Quill Type Product Checklist

This file is the working launch checklist for `Quill Type`.

It is split into:

- `v1.0`: the smallest version we can confidently ship as a real installable product
- `v1.1`: the immediate expansion layer after launch

Target planning date: `2026-07-22`

## Release Principle

`v1.0` should be:

- installable
- documented
- testable in CI
- useful beyond type generation alone
- clear about why it exists next to `openapi-typescript` and `orval`

`v1.1` should deepen ecosystem support and developer experience, but should not block first release.

---

## v1.0 Launch Checklist

### 1. Product Scope

- [ ] Freeze the `v1.0` feature set
- [ ] Confirm the core commands and keep them stable:
  - `init`
  - `generate`
  - `check`
  - `watch`
  - `config validate`
  - `doctor`
- [ ] Define the supported output modes for `v1.0`
- [ ] Define what counts as a breaking change for `v1.0`
- [ ] Decide whether `Quill Type` is config-first only or also supports flags-first shortcuts

### 2. CLI and Core Engine

- [ ] Harden command parsing and help output
- [ ] Add `typebridge config validate`
- [ ] Add `typebridge doctor`
- [ ] Improve error messages for:
  - missing config
  - invalid config
  - invalid OpenAPI schema source
  - output write failures
  - watch failures
- [ ] Support multiple outputs cleanly in one config
- [ ] Add clear exit codes for CI usage

### 3. Output Modes

- [ ] Keep `types` mode stable
- [ ] Add `fetch-client` output mode
- [ ] Add `react-query` output mode
- [ ] Decide whether `axios-client` belongs in `v1.0` or `v1.1`
- [ ] Ensure generated outputs include a clear banner and predictable formatting

### 4. Breaking Change Detection

- [ ] Add a breaking-change comparison command or mode
- [ ] Detect removed paths
- [ ] Detect removed operations
- [ ] Detect removed response status codes
- [ ] Detect removed enum values
- [ ] Detect incompatible schema type changes
- [ ] Detect request fields that became newly required
- [ ] Detect response fields removed from successful responses
- [ ] Make breaking-change output readable in CI logs

### 5. Config UX

- [ ] Publish a JSON Schema for the config file
- [ ] Validate config with actionable messages
- [ ] Support environment variable interpolation clearly
- [ ] Document config examples for every supported output mode
- [ ] Add a recommended default config template

### 6. Watch Mode

- [ ] Keep local file watch mode reliable
- [ ] Improve debounce behavior
- [ ] Handle multiple watched schema files
- [ ] Decide how remote URL watch should work:
  - polling interval
  - retry behavior
  - offline failure messaging
- [ ] Print useful regeneration summaries

### 7. Examples

- [x] Add a `FastAPI` example
- [x] Add an `Express` or `NestJS` example
- [x] Add a `Go` example
- [x] Add a `Rust` example
- [x] Include one frontend usage example per backend example
- [x] Document exact commands for each example
- [x] Keep examples small and runnable

### 8. Documentation

- [x] Rewrite the main README as product-facing documentation
- [x] Add a `Why Quill Type` section
- [x] Add `Quill Type vs openapi-typescript`
- [x] Add `Quill Type vs Orval`
- [x] Add `When to use Quill Type`
- [x] Add a quickstart guide
- [x] Add a CI setup guide
- [x] Add a config reference
- [x] Add an outputs reference
- [x] Add a breaking-change checks guide

### 9. Publishing and Release Readiness

- [x] Confirm npm package name availability for `typebridge`
- [ ] Finalize `package.json` metadata:
  - `repository`
  - `homepage`
  - `bugs`
  - `files`
  - `publishConfig`
- [x] Add `LICENSE`
- [x] Add `CHANGELOG.md`
- [x] Add `CONTRIBUTING.md`
- [x] Confirm published package only ships necessary files
- [x] Test local packed artifact before publishing
- [ ] Publish a prerelease if needed
- [ ] Publish `v1.0.0`

### 10. CI and Automation

- [x] Add GitHub Actions workflow for:
  - install
  - build
  - test
  - generate
  - check
- [x] Add CI badge to the README
- [x] Add release workflow for npm publishing
- [x] Add changelog or release notes flow
- [x] Decide whether versioning is manual or automated

### 11. Testing and Quality

- [x] Add tests for config validation failures
- [x] Add tests for OpenAPI validation failures
- [x] Add tests for multiple outputs
- [x] Add tests for breaking-change detection
- [x] Add tests for remote URL loading
- [x] Add tests for watch behavior where practical
- [x] Review and address the current dependency audit warnings

### 12. v1.0 Exit Criteria

- [ ] `npm install` works cleanly
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run generate` passes
- [ ] `npm run check` passes
- [ ] At least 3 examples exist and are documented
- [ ] At least 2 useful nontrivial output modes exist
- [x] Breaking-change checks work in CI
- [x] README clearly explains value and usage
- [ ] Package is published and installable from npm

---

## v1.1 Expansion Checklist

### 1. More Output Modes

- [ ] Add `axios-client`
- [ ] Add `swr`
- [ ] Add `zod` output.
- [ ] Consider JSON Schema export for runtime validation workflows
- [ ] Add generator presets for common stacks

### 2. More Backend Ecosystem Examples

- [ ] Add a `Rust` example
- [ ] Add a `NestJS` example if `Express` ships first
- [ ] Add a multi-service or monorepo example
- [ ] Add an example with a remote schema source

### 3. Better Contract Diffing

- [ ] Add severity levels to breaking changes
- [ ] Add non-breaking but important warnings
- [ ] Add machine-readable diff output
- [ ] Add markdown or JSON report output

### 4. Better Developer Experience

- [ ] Add prettier generated client output
- [ ] Add output customization hooks
- [ ] Add presets such as:
  - `fastapi-react-query`
  - `go-fetch`
  - `nest-types`
- [ ] Improve watch logs and progress output
- [ ] Add richer doctor diagnostics

### 5. Documentation and Adoption

- [ ] Add a docs site or expanded `/docs` section
- [ ] Add migration guides from `openapi-typescript`
- [ ] Add migration guides from `orval`
- [ ] Add cookbook recipes for common stack setups
- [ ] Add troubleshooting guide

### 6. Maintenance

- [ ] Add benchmark or performance checks for large schemas
- [ ] Add compatibility notes for OpenAPI 3.0 vs 3.1
- [ ] Add support policy for Node versions
- [ ] Add issue templates and PR templates

---

## One-Hour Reality Check

Finishing all of `v1.0` and `v1.1` in one hour is not realistic.

What is realistic in the next hour is creating a strong `v1.0` foundation by finishing the highest-leverage launch tasks first.

### Recommended 60-Minute Sprint Order

- [ ] Finalize `v1.0` scope
- [ ] Add `config validate`
- [ ] Add `doctor`
- [ ] Add CI workflow
- [ ] Upgrade README into product docs
- [ ] Add publish-ready package metadata
- [ ] Add `FastAPI` example

### Recommended First Cut For `v1.0`

If we need a narrower first release, the leanest good launch is:

- [ ] `types`
- [ ] `fetch-client`
- [ ] breaking-change detection
- [ ] config schema and config validation
- [ ] doctor command
- [ ] CI and npm publish flow
- [ ] FastAPI + Go + Express or Nest example
- [ ] strong README and positioning

---

## Decision Notes

Use this section to record launch decisions as we make them.

- [ ] Decide whether `axios-client` is `v1.0` or `v1.1`
- [ ] Decide whether `Express` or `NestJS` is the initial Node backend example
- [x] Package name `typebridge` is already taken on npm; current publish-ready fallback is `quilltype`
- [x] Versioning approach for `v1.0` is manual
- [ ] Decide whether `Rust` is required before first public release
- [ ] Decide whether `react-query` is required for `v1.0`
- [ ] Decide whether the first publish should be `0.x` or `1.0.0`
