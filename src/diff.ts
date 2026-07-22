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
import type { ContractChangeSeverity, ContractReportFormat } from "./types.js";

export interface ContractChange {
  code:
    | "removed-path"
    | "removed-operation"
    | "removed-status-code"
    | "removed-enum-value"
    | "incompatible-schema-type"
    | "request-field-became-required"
    | "response-field-removed"
    | "request-parameter-became-required"
    | "added-path"
    | "added-operation"
    | "added-enum-value"
    | "operation-deprecated";
  severity: ContractChangeSeverity;
  message: string;
}

export interface BreakingIssue extends ContractChange {
  severity: "error";
}

export interface ContractChangeReport {
  summary: {
    errors: number;
    warnings: number;
    total: number;
  };
  changes: ContractChange[];
}

export function detectContractChanges(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
): ContractChange[] {
  const changes: ContractChange[] = [];
  const previousPaths = asObject(previousDocument.paths) ?? {};
  const nextPaths = asObject(nextDocument.paths) ?? {};

  for (const route of Object.keys(previousPaths)) {
    if (!(route in nextPaths)) {
      changes.push({
        code: "removed-path",
        severity: "error",
        message: `Path removed: ${route}`,
      });
    }
  }

  for (const route of Object.keys(nextPaths)) {
    if (!(route in previousPaths)) {
      changes.push({
        code: "added-path",
        severity: "warning",
        message: `Path added: ${route}`,
      });
    }
  }

  const previousOperations = new Map(
    getOperations(previousDocument).map((item) => [`${item.method} ${item.route}`, item]),
  );
  const nextOperations = new Map(
    getOperations(nextDocument).map((item) => [`${item.method} ${item.route}`, item]),
  );

  for (const [key, nextOperation] of nextOperations.entries()) {
    if (!previousOperations.has(key)) {
      changes.push({
        code: "added-operation",
        severity: "warning",
        message: `Operation added: ${nextOperation.method.toUpperCase()} ${nextOperation.route}`,
      });
    }
  }

  for (const [key, previousOperation] of previousOperations.entries()) {
    const nextOperation = nextOperations.get(key);

    if (!nextOperation) {
      changes.push({
        code: "removed-operation",
        severity: "error",
        message: `Operation removed: ${previousOperation.method.toUpperCase()} ${previousOperation.route}`,
      });
      continue;
    }

    compareOperationStatusCodes(previousOperation.operation, nextOperation.operation, changes, key);
    compareOperationParameters(previousOperation.operation, nextOperation.operation, changes, key);
    compareOperationMetadata(previousOperation.operation, nextOperation.operation, changes, key);
    compareRequestSchemas(previousDocument, nextDocument, previousOperation.operation, nextOperation.operation, changes, key);
    compareSuccessResponses(
      previousDocument,
      nextDocument,
      previousOperation.operation,
      nextOperation.operation,
      changes,
      key,
    );
  }

  compareComponentSchemas(previousDocument, nextDocument, changes);

  return sortChanges(changes);
}

export function detectBreakingChanges(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
): BreakingIssue[] {
  return detectContractChanges(previousDocument, nextDocument).filter(
    (change): change is BreakingIssue => change.severity === "error",
  );
}

export function createContractChangeReport(changes: ContractChange[]): ContractChangeReport {
  const errors = changes.filter((change) => change.severity === "error").length;
  const warnings = changes.length - errors;

  return {
    summary: {
      errors,
      warnings,
      total: changes.length,
    },
    changes,
  };
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
  return formatContractChanges(issues, "text");
}

export function formatContractChanges(
  changes: ContractChange[],
  format: ContractReportFormat = "text",
): string {
  const report = createContractChangeReport(changes);

  switch (format) {
    case "json":
      return JSON.stringify(report, null, 2);
    case "markdown":
      return formatMarkdownReport(report);
    case "text":
      return formatTextReport(report);
  }
}

function formatTextReport(report: ContractChangeReport): string {
  const lines = [
    "Contract change report:",
    `- errors: ${report.summary.errors}`,
    `- warnings: ${report.summary.warnings}`,
    `- total: ${report.summary.total}`,
  ];

  if (report.changes.length === 0) {
    lines.push("- no contract changes detected");
    return lines.join("\n");
  }

  lines.push(...report.changes.map((change) => `- [${change.severity}] [${change.code}] ${change.message}`));
  return lines.join("\n");
}

function formatMarkdownReport(report: ContractChangeReport): string {
  const lines = [
    "# Contract Change Report",
    "",
    `- Errors: ${report.summary.errors}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Total: ${report.summary.total}`,
    "",
  ];

  if (report.changes.length === 0) {
    lines.push("No contract changes detected.");
    return lines.join("\n");
  }

  lines.push("| Severity | Code | Message |");
  lines.push("| --- | --- | --- |");

  for (const change of report.changes) {
    lines.push(`| ${change.severity} | ${change.code} | ${escapeMarkdownCell(change.message)} |`);
  }

  return lines.join("\n");
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function compareOperationMetadata(
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  changes: ContractChange[],
  label: string,
): void {
  if (previousOperation.deprecated !== true && nextOperation.deprecated === true) {
    changes.push({
      code: "operation-deprecated",
      severity: "warning",
      message: `${label.toUpperCase()} is now deprecated`,
    });
  }
}

function compareOperationStatusCodes(
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  changes: ContractChange[],
  label: string,
): void {
  const previousResponses = asObject(previousOperation.responses) ?? {};
  const nextResponses = asObject(nextOperation.responses) ?? {};

  for (const statusCode of Object.keys(previousResponses)) {
    if (!(statusCode in nextResponses)) {
      changes.push({
        code: "removed-status-code",
        severity: "error",
        message: `${label.toUpperCase()} removed status code ${statusCode}`,
      });
    }
  }
}

function compareOperationParameters(
  previousOperation: Record<string, unknown>,
  nextOperation: Record<string, unknown>,
  changes: ContractChange[],
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
      changes.push({
        code: "request-parameter-became-required",
        severity: "error",
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
  changes: ContractChange[],
  label: string,
): void {
  const previousSchema = getRequestBodySchema(previousDocument, previousOperation);
  const nextSchema = getRequestBodySchema(nextDocument, nextOperation);

  if (previousSchema && nextSchema) {
    compareSchemas(previousSchema, nextSchema, changes, `${label.toUpperCase()} request body`, {
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
  changes: ContractChange[],
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
    compareSchemas(previousSchema, nextSchema, changes, `${label.toUpperCase()} response ${previousStatus}`, {
      detectNewRequiredFields: false,
      detectRemovedResponseFields: true,
    });
  }
}

function compareComponentSchemas(
  previousDocument: Record<string, unknown>,
  nextDocument: Record<string, unknown>,
  changes: ContractChange[],
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
      compareSchemas(previousSchema, nextSchema, changes, `components.schemas.${name}`, {
        detectNewRequiredFields: true,
        detectRemovedResponseFields: true,
      });
    }
  }
}

function compareSchemas(
  previousSchemaLike: unknown,
  nextSchemaLike: unknown,
  changes: ContractChange[],
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
    changes.push({
      code: "incompatible-schema-type",
      severity: "error",
      message: `${context} changed type from ${previousKind} to ${nextKind}`,
    });
    return;
  }

  if (Array.isArray(previousSchema.enum) && Array.isArray(nextSchema.enum)) {
    const previousEnumValues = previousSchema.enum as unknown[];
    const nextEnumValues = nextSchema.enum as unknown[];
    const removedValues = previousEnumValues.filter((value) => !nextEnumValues.includes(value));
    const addedValues = nextEnumValues.filter((value) => !previousEnumValues.includes(value));

    for (const removedValue of removedValues) {
      changes.push({
        code: "removed-enum-value",
        severity: "error",
        message: `${context} removed enum value ${JSON.stringify(removedValue)}`,
      });
    }

    for (const addedValue of addedValues) {
      changes.push({
        code: "added-enum-value",
        severity: "warning",
        message: `${context} added enum value ${JSON.stringify(addedValue)}`,
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
          changes.push({
            code: "response-field-removed",
            severity: "error",
            message: `${context} removed field ${propertyName}`,
          });
        }
      }
    }

    if (options.detectNewRequiredFields) {
      for (const propertyName of Object.keys(nextProperties)) {
        if (!previousRequired.has(propertyName) && nextRequired.has(propertyName)) {
          changes.push({
            code: "request-field-became-required",
            severity: "error",
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

      compareSchemas(previousProperty, nextProperty, changes, `${context}.${propertyName}`, options);
    }

    return;
  }

  if (previousKind === "array") {
    compareSchemas(previousSchema.items, nextSchema.items, changes, `${context}[]`, options);
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

function sortChanges(changes: ContractChange[]): ContractChange[] {
  return [...changes].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }

    if (left.code !== right.code) {
      return left.code.localeCompare(right.code);
    }

    return left.message.localeCompare(right.message);
  });
}
