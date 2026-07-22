import { listProjects } from "./generated/api-client";

const client = {
  baseUrl: "http://127.0.0.1:8020",
};

async function main() {
  const projects = await listProjects(client);
  console.log(projects);
}

void main();
