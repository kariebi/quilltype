# FastAPI Example

This example shows the cleanest OpenAPI workflow: FastAPI produces the contract automatically, and Quill Type generates frontend code from that contract.

## Files

- `backend/main.py`
- `backend/requirements.txt`
- `frontend/app.tsx`
- `quilltype.config.json`

## Run The Backend

From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r examples/fastapi/backend/requirements.txt
uvicorn main:app --reload --app-dir examples/fastapi/backend --port 8010
```

OpenAPI will be available at `http://127.0.0.1:8010/openapi.json`.

## Generate Frontend Code

From the repo root:

```bash
npm install
npm run build
node dist/cli.js generate --config ./examples/fastapi/quilltype.config.json
```

## Validate And Check

```bash
node dist/cli.js config validate --config ./examples/fastapi/quilltype.config.json
node dist/cli.js check --config ./examples/fastapi/quilltype.config.json
```

## Frontend Usage

The frontend usage sample is in `frontend/app.tsx`.
