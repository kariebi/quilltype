# Quickstart

## Install

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

## Flags-First Example

```bash
node dist/cli.js generate \
  --input ./examples/petstore.openapi.json \
  --output ./src/generated/api-types.ts:types \
  --output ./src/generated/api-client.ts:fetch-client
```

## Install From npm

Once a package is published:

```bash
npm install -g typebridge-cli
typebridge generate
```
