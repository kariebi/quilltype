import { makeIdentifier } from "./utils.js";

export const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface OperationInfo {
  route: string;
  method: HttpMethod;
  operationId: string;
  operation: Record<string, unknown>;
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function resolveRef(document: Record<string, unknown>, value: unknown): unknown {
  const objectValue = asObject(value);

  if (!objectValue || typeof objectValue.$ref !== "string") {
    return value;
  }

  return resolveJsonPointer(document, objectValue.$ref) ?? value;
}

export function resolveJsonPointer(
  document: Record<string, unknown>,
  pointer: string,
): unknown | undefined {
  if (!pointer.startsWith("#/")) {
    return undefined;
  }

  const parts = pointer
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = document;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function getOperations(document: Record<string, unknown>): OperationInfo[] {
  const paths = asObject(document.paths) ?? {};
  const operations: OperationInfo[] = [];
  const seenIds = new Map<string, number>();

  for (const [route, pathLike] of Object.entries(paths)) {
    const pathItem = asObject(resolveRef(document, pathLike));

    if (!pathItem) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = asObject(resolveRef(document, pathItem[method]));

      if (!operation) {
        continue;
      }

      const rawId =
        typeof operation.operationId === "string" && operation.operationId.trim().length > 0
          ? operation.operationId.trim()
          : makeIdentifier(`${method}-${route}`);
      const count = seenIds.get(rawId) ?? 0;
      seenIds.set(rawId, count + 1);

      operations.push({
        route,
        method,
        operationId: count === 0 ? rawId : `${rawId}${count + 1}`,
        operation,
      });
    }
  }

  return operations;
}

export function getSuccessResponseCodes(operation: Record<string, unknown>): string[] {
  const responses = asObject(operation.responses) ?? {};
  return Object.keys(responses)
    .filter((statusCode) => /^[2][0-9][0-9]$/.test(statusCode))
    .sort();
}

export function getPrimarySuccessResponseCode(operation: Record<string, unknown>): string | undefined {
  return getSuccessResponseCodes(operation)[0];
}

export function getResponseSchema(
  document: Record<string, unknown>,
  operation: Record<string, unknown>,
  statusCode: string,
): Record<string, unknown> | null {
  const responses = asObject(operation.responses) ?? {};
  const response = asObject(resolveRef(document, responses[statusCode]));
  const content = asObject(response?.content) ?? {};

  for (const mediaType of Object.values(content)) {
    const mediaTypeObject = asObject(resolveRef(document, mediaType));
    const schema = asObject(resolveRef(document, mediaTypeObject?.schema));

    if (schema) {
      return schema;
    }
  }

  return null;
}

export function getRequestBodySchema(
  document: Record<string, unknown>,
  operation: Record<string, unknown>,
): Record<string, unknown> | null {
  const requestBody = asObject(resolveRef(document, operation.requestBody));
  const content = asObject(requestBody?.content) ?? {};

  for (const mediaType of Object.values(content)) {
    const mediaTypeObject = asObject(resolveRef(document, mediaType));
    const schema = asObject(resolveRef(document, mediaTypeObject?.schema));

    if (schema) {
      return schema;
    }
  }

  return null;
}

export function getSchemaKind(schemaLike: unknown): string {
  const schema = asObject(schemaLike);

  if (!schema) {
    return "unknown";
  }

  if (Array.isArray(schema.oneOf)) {
    return "oneOf";
  }

  if (Array.isArray(schema.anyOf)) {
    return "anyOf";
  }

  if (Array.isArray(schema.allOf)) {
    return "allOf";
  }

  if (schema.type === "array") {
    return "array";
  }

  if (schema.type === "object" || schema.properties || schema.additionalProperties) {
    return "object";
  }

  if (typeof schema.type === "string") {
    return schema.type;
  }

  if (Array.isArray(schema.enum)) {
    return "enum";
  }

  return "unknown";
}

export function getRequiredSet(schemaLike: unknown): Set<string> {
  const schema = asObject(schemaLike);
  const required = Array.isArray(schema?.required) ? schema.required : [];
  return new Set(required.filter((value): value is string => typeof value === "string"));
}
