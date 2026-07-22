import { listBooks } from "../../../src/generated/api-client";

async function main() {
  const books = await listBooks({
    baseUrl: "http://localhost:4020",
  });

  console.log(books);
}

void main();
