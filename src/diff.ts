import { AppError } from "./errors.js";
import {
  asObject,
  getOperations,
  getPrimarySuccessResponseCode,
  getRequestBodySchema,
  getRequiredSet,
  getResponseSchema,
  getSchemaKind,
  resolveRef,
} from "./oas.js";

export interface BreakingIssue {
  code:
    | "removed-path"
    | "removed-operation"
    | "removed-status-code"
    | "removed-enum-value"
    | "incompatible-schema-type"
    | "request-field-became-required"
    | "response-field-removed"
    | "request-parameter-became-required";
  message: string;
}

export function detectBreakingChanges(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
): BreakingIssue[] {
  const issues: BreakingIssue[] = [];
  const previousPaths = asObject(previousDocument.paths) ?? {};
  const nextPaths = asObject(nextDocument.paths) ?? {};

  for (const route of Object.keys(previousPaths)) {
    if (!(route in nextPaths)) {
      issues.push({
        code: "removed-path",
        message: `Path removed: ${route}`,
      });
    }
  }

  const previousOperations = new Map(
    getOperations(previousDocument).map((item) => [`${item.method} ${item.route}`, item]),
  );
  const nextOperations = new Map(
    getOperations(nextDocument).map((item) => [`${item.method} ${item.route}`, item]),
  );

  for (const [key, previousOperation] of previousOperations.entries()) {
    const nextOperation = nextOperations.get(key);

    if (!nextOperation) {
      issues.push({
        code: "removed-operation",
        message: `Operation removed: ${previousOperation.method.toUpperCase()} ${previousOperation.route}`,
      });
      continue;
    }

    compareOperationStatusCodes(previousOperation.operation, nextOperation.operation, issues, key);
    compareOperationParameters(previousOperation.operation, nextOperation.operation, issues, key);
    compareRequestSchemas(previousDocument, nextDocument, previousOperation.operation, nextOperation.operation, issues, key);
    compareSuccessResponses(
      previousDocument,
      nextDocument,
      previousOperation.operation,
      nextOperation.operation,
      issues,
      key,
    );
  }

  compareComponentSchemas(previousDocument, nextDocument, issues);

  return issues;
}

export function assertNoBreakingChanges(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
): void {
  const issues = detectBreakingChanges(previousDocument, nextDocument);

  if (issues.length > 0) {
    throw new AppError(formatBreakingChanges(issues), 2);
  }
}

export function formatBreakingChanges(issues: BreakingIssue[]): string {
  return [
    "Breaking change check failed:",
    ...issues.map((issue) => `- [${issue.code}] ${issue.message}`),
  ].join("\n");
}

function compareOperationStatusCodes(
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  issues: BreakingIssue[],
  label: string,
): void {
  const previousResponses = asObject(previousOperation.responses) ?? {};
  const nextResponses = asObject(nextOperation.responses) ?? {};

  for (const statusCode of Object.keys(previousResponses)) {
    if (!(statusCode in nextResponses)) {
      issues.push({
        code: "removed-status-code",
        message: `${label.toUpperCase()} removed status code ${statusCode}`,
      });
    }
  }
}

function compareOperationParameters(
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  issues: BreakingIssue[],
  label: string,
): void {
  const previousParameters = normalizeParameters(previousOperation.parameters);
  const nextParameters = normalizeParameters(nextOperation.parameters);

  for (const [key, previousParameter] of previousParameters.entries()) {
    const nextParameter = nextParameters.get(key);

    if (!nextParameter) {
      continue;
    }

    if (!previousParameter.required && nextParameter.required) {
      issues.push({
        code: "request-parameter-became-required",
        message: `${label.toUpperCase()} parameter ${key} became required`,
      });
    }
  }
}

function compareRequestSchemas(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  issues: BreakingIssue[],
  label: string,
): void {
  const previousSchema = getRequestBodySchema(previousDocument, previousOperation);
  const nextSchema = getRequestBodySchema(nextDocument, nextOperation);

  if (previousSchema && nextSchema) {
    compareSchemas(previousSchema, nextSchema, issues, `${label.toUpperCase()} request body`, {
      detectNewRequiredFields: true,
      detectRemovedResponseFields: false,
    });
  }
}

function compareSuccessResponses(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  issues: BreakingIssue[],
  label: string,
): void {
  const previousStatus = getPrimarySuccessResponseCode(previousOperation);
  const nextStatus = getPrimarySuccessResponseCode(nextOperation);

  if (!previousStatus || !nextStatus) {
    return;
  }

  const previousSchema = getResponseSchema(previousDocument, previousOperation, previousStatus);
  const nextSchema = getResponseSchema(nextDocument, nextOperation, nextStatus);

  if (previousSchema && nextSchema) {
    compareSchemas(previousSchema, nextSchema, issues, `${label.toUpperCase()} response ${previousStatus}`, {
      detectNewRequiredFields: false,
      detectRemovedResponseFields: true,
    });
  }
}

function compareComponentSchemas(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
  issues: BreakingIssue[],
): void {
  const previousComponents = asObject(asObject(previousDocument.components)?.schemas) ?? {};
  const nextComponents = asObject(asObject(nextDocument.components)?.schemas) ?? {};

  for (const [name, previousSchemaLike] of Object.entries(previousComponents)) {
    const nextSchemaLike = nextComponents[name];

    if (!nextSchemaLike) {
      continue;
    }

    const previousSchema = asObject(resolveRef(previousDocument, previousSchemaLike));
    const nextSchema = asObject(resolveRef(nextDocument, nextSchemaLike));

    if (previousSchema && nextSchema) {
      compareSchemas(previousSchema, nextSchema, issues, `components.schemas.${name}`, {
        detectNewRequiredFields: true,
        detectRemovedResponseFields: true,
      });
    }
  }
}

function compareSchemas(
  previousSchemaLike: unknown,
  nextSchemaLike: unknown,
  issues: BreakingIssue[],
  context: string,
  options: {
    detectNewRequiredFields: boolean;
    detectRemovedResponseFields: boolean;
  },
): void {
  const previousSchema = asObject(previousSchemaLike);
  const nextSchema = asObject(nextSchemaLike);

  if (!previousSchema || !nextSchema) {
    return;
  }

  const previousKind = getSchemaKind(previousSchema);
  const nextKind = getSchemaKind(nextSchema);

  if (previousKind !== nextKind) {
    issues.push({
      code: "incompatible-schema-type",
      message: `${context} changed type from ${previousKind} to ${nextKind}`,
    });
    return;
  }

  if (Array.isArray(previousSchema.enum) && Array.isArray(nextSchema.enum)) {
    const nextEnumValues = nextSchema.enum as unknown[];
    const removedValues = (previousSchema.enum as unknown[]).filter(
      (value) => !nextEnumValues.includes(value),
    );

    for (const removedValue of removedValues) {
      issues.push({
        code: "removed-enum-value",
        message: `${context} removed enum value ${JSON.stringify(removedValue)}`,
      });
    }
  }

  if (previousKind === "object") {
    const previousProperties = asObject(previousSchema.properties) ?? {};
    const nextProperties = asObject(nextSchema.properties) ?? {};
    const previousRequired = getRequiredSet(previousSchema);
    const nextRequired = getRequiredSet(nextSchema);

    if (options.detectRemovedResponseFields) {
      for (const propertyName of Object.keys(previousProperties)) {
        if (!(propertyName in nextProperties)) {
          issues.push({
            code: "response-field-removed",
            message: `${context} removed field ${propertyName}`,
          });
        }
      }
    }

    if (options.detectNewRequiredFields) {
      for (const propertyName of Object.keys(nextProperties)) {
        if (!previousRequired.has(propertyName) && nextRequired.has(propertyName)) {
          issues.push({
            code: "request-field-became-required",
            message: `${context} field ${propertyName} became required`,
          });
        }
      }
    }

    for (const [propertyName, previousProperty] of Object.entries(previousProperties)) {
      const nextProperty = nextProperties[propertyName];

      if (!nextProperty) {
        continue;
      }

      compareSchemas(previousProperty, nextProperty, issues, `${context}.${propertyName}`, options);
    }

    return;
  }

  if (previousKind === "array") {
    compareSchemas(previousSchema.items, nextSchema.items, issues, `${context}[]`, options);
  }
}

function normalizeParameters(parametersLike: unknown): Map<string, { required: boolean }> {
  const parameters = Array.isArray(parametersLike) ? parametersLike : [];
  const normalized = new Map<string, { required: boolean }>();

  for (const parameterLike of parameters) {
    const parameter = asObject(parameterLike);

    if (!parameter || typeof parameter.name !== "string" || typeof parameter.in !== "string") {
      continue;
    }

    normalized.set(`${parameter.in}:${parameter.name}`, {
      required: parameter.required === true,
    });
  }

  return normalized;
}
