import path from "node:path";

export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

export function replaceEnvPlaceholders(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, variableName: string) => {
    return process.env[variableName] ?? "";
  });
}

export function deepReplaceEnvPlaceholders<T>(input: T): T {
  if (typeof input === "string") {
    return replaceEnvPlaceholders(input) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => deepReplaceEnvPlaceholders(item)) as T;
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, deepReplaceEnvPlaceholders(value)]),
    ) as T;
  }

  return input;
}

export function quote(value: string): string {
  return JSON.stringify(value);
}

export function toCamelCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

export function toPascalCase(value: string): string {
  const camel = toCamelCase(value);
  return camel ? camel[0].toUpperCase() + camel.slice(1) : camel;
}

export function makeIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, " ");
  const camel = toCamelCase(cleaned);
  const candidate = camel || "operation";
  return /^[0-9]/.test(candidate) ? `op${candidate}` : candidate;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }

  return value;
}
