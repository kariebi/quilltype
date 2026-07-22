# Contributing

TypeBridge supports two main workflows:

- package users installing the published CLI
- contributors working directly from the source tree

## For Package Users

Once published, install the CLI with npm:

```bash
npm install -g typebridge-cli
typebridge --help
```

Or install it in a project:

```bash
npm install --save-dev typebridge-cli
npx typebridge generate
```

## For Contributors

Clone the repository and install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run the sample generation flow:

```bash
npm run generate
npm run check
```

## Development Commands

- `npm run build`
- `npm test`
- `npm run generate`
- `npm run check`
- `npm run watch`
- `node dist/cli.js doctor`

## Release Readiness Check

Before cutting a release:

```bash
npm run release:check
```

## Examples

Example backends and frontend usage samples live in:

- `examples/fastapi`
- `examples/express`
- `examples/go`
- `examples/rust-axum`

## Versioning

TypeBridge currently uses manual versioning for releases.

That means contributors should:

1. update `package.json`
2. update `CHANGELOG.md`
3. create a release tag such as `v1.0.0`

## Pull Requests

Recommended checklist:

1. add or update tests
2. run `npm run release:check`
3. update docs when behavior changes
4. keep generated outputs deterministic
