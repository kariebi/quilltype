# Remote Schema Example

This example shows Quill Type consuming a remote OpenAPI URL instead of a local file.

## Config

`quilltype.config.json` points at `http://localhost:4010/openapi.json`.

## Generate

```bash
npm run build
node dist/cli.js generate --config ./examples/remote-schema/quilltype.config.json
```

## Watch

```bash
node dist/cli.js watch --config ./examples/remote-schema/quilltype.config.json
```
