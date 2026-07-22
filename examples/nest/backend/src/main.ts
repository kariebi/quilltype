import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const openapi = readFileSync(path.resolve("./openapi.json"), "utf8");

const server = http.createServer((request, response) => {
  if (request.url === "/openapi.json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(openapi);
    return;
  }

  if (request.url === "/books") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([{ id: "1", title: "Nest Handbook" }]));
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(4020, () => {
  console.log("Nest example running on http://localhost:4020");
});
