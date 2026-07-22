import { listReleases } from "./generated/api-client";

const client = {
  baseUrl: "http://127.0.0.1:8030",
};

async function main() {
  const releases = await listReleases(client);
  console.log(releases);
}

void main();
