import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/openapi.json", async (_request, response) => {
  const raw = await readFile(path.join(__dirname, "openapi.json"), "utf8");
  response.type("application/json").send(raw);
});

app.get("/projects", (_request, response) => {
  response.json([
    {
      id: "proj_1",
      name: "TypeBridge Launch",
      status: "active",
    },
  ]);
});

app.listen(8020, () => {
  console.log("Express example listening on http://127.0.0.1:8020");
});
