import { AppError } from "./errors.js";
import { asObject, getOperations, resolveRef } from "./oas.js";
import type { QuillTypeConfig } from "./types.js";

export function validateOpenApiDocument(
  document: Record<string, unknown>,
  config: QuillTypeConfig,
): void {
  const issues: string[] = [];
  const paths = asObject(document.paths);

  if (!paths) {
    throw new AppError("OpenAPI document must define a `paths` object.", 2);
  }

  for (const operationInfo of getOperations(document)) {
    const operationLabel = `${operationInfo.method.toUpperCase()} ${operationInfo.route}`;
    const operation = operationInfo.operation;

    if (config.validation?.requireOperationIds && typeof operation.operationId !== "string") {
      issues.push(`${operationLabel} is missing an operationId.`);
    }

    if (config.validation?.requireResponseSchemas) {
      const responses = asObject(operation.responses);

      if (!responses) {
        issues.push(`${operationLabel} is missing responses.`);
        continue;
      }

      for (const [statusCode, responseLike] of Object.entries(responses)) {
        if (!/^[2][0-9][0-9]$/.test(statusCode) || statusCode === "204" || statusCode === "205") {
          continue;
        }

        const response = resolveRef(document, responseLike);
        const responseObject = asObject(response);

        if (!responseObject) {
          issues.push(`${operationLabel} response ${statusCode} is invalid.`);
          continue;
        }

        const content = asObject(responseObject.content);

        if (!content || !hasSchemaInContent(document, content)) {
          issues.push(`${operationLabel} response ${statusCode} is missing a content schema.`);
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new AppError(`OpenAPI validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`, 2);
  }
}

function hasSchemaInContent(
  document: Record<string, unknown>,
  content: Record<string, unknown>,
): boolean {
  for (const mediaType of Object.values(content)) {
    const mediaTypeObject = asObject(resolveRef(document, mediaType));

    if (!mediaTypeObject) {
      continue;
    }

    if (mediaTypeObject.schema) {
      return true;
    }
  }

  return false;
}
