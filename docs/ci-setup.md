# CI Setup Guide

TypeBridge is designed for CI workflows where generated code must stay current and contract changes must be surfaced early.

## Recommended Steps

```bash
npm ci
npm run build
npm test
node dist/cli.js generate --config ./typebridge.config.json
node dist/cli.js check --config ./typebridge.config.json
```

## Release Workflow

Releases use manual versioning.

Recommended sequence:

1. update `package.json`
2. update `CHANGELOG.md`
3. create a git tag such as `v1.0.0`
4. push the tag so GitHub Actions can publish

## What `check` Enforces

- generated outputs are up to date
- breaking-change checks pass when a baseline is configured
- config and source loading still work

## Recommended Pull Request Pattern

1. Run `generate` when the backend contract changes.
2. Commit the generated output.
3. Let CI run `check`.
4. If CI fails, either regenerate the outputs or resolve the breaking contract change.
