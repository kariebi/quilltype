# Quickstart

## Install

For normal usage, install the published CLI:

```bash
npm install -g quilltype
quilltype --help
```

If you prefer to keep it project-local:

```bash
npm install --save-dev quilltype
npx quilltype --help
```

## Start Using Quill Type

Create a starter config:

```bash
quilltype init
```

Generate outputs:

```bash
quilltype generate
```

Validate, check, and watch:

```bash
quilltype config validate
quilltype check
quilltype watch
```

## Flags-First Example

```bash
quilltype generate \
  --input ./examples/petstore.openapi.json \
  --output ./src/generated/api-types.ts:types \
  --output ./src/generated/api-client.ts:fetch-client
```

## Contributing From Source

From the repo root when contributing from source:

```bash
npm install
npm run build
```

## Initialize A Config

```bash
node dist/cli.js init
```

## Generate Outputs

```bash
node dist/cli.js generate
```

## Validate, Check, And Watch

```bash
node dist/cli.js config validate
node dist/cli.js check
node dist/cli.js watch
```
