import { access, constants, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { AppError } from "./errors.js";
import type { OutputConfig, OutputMode, RuntimeOptions, SourceConfig, QuillTypeConfig } from "./types.js";
import { deepReplaceEnvPlaceholders, isUrl } from "./utils.js";

const DEFAULT_CONFIG_FILES = [
  "quilltype.config.json",
  "quilltype.config.yaml",
  "quilltype.config.yml",
];

const DEFAULT_SCHEMA_PATH = "./schemas/quilltype.schema.json";

export function createDefaultConfig(): QuillTypeConfig {
  return {
    $schema: DEFAULT_SCHEMA_PATH,
    source: {
      path: "./examples/petstore.openapi.json",
    },
    outputs: [
      {
        path: "./src/generated/api-types.ts",
        mode: "types",
      },
      {
        path: "./src/generated/api-client.ts",
        mode: "fetch-client",
      },
      {
        path: "./src/generated/api-react-query.ts",
        mode: "react-query",
      },
    ],
    validation: {
      requireOperationIds: true,
      requireResponseSchemas: true,
    },
    watch: {
      pollIntervalMs: 30000,
      retryDelayMs: 5000,
    },
  };
}

export async function resolveConfigPath(explicitPath?: string): Promise<string> {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  for (const candidate of DEFAULT_CONFIG_FILES) {
    try {
      await access(path.resolve(candidate));
      return path.resolve(candidate);
    } catch {
      // Keep searching until we find a supported file.
    }
  }

  throw new AppError(
    "No Quill Type config file found. Run `quilltype init` or pass `--config <path>`.",
    2,
  );
}

export async function loadConfig(explicitPath?: string): Promise<{
  configPath: string;
  config: QuillTypeConfig;
}> {
  const configPath = await resolveConfigPath(explicitPath);
  const raw = await readFile(configPath, "utf8");
  const parsed = parseStructuredText(raw, configPath);
  const config = deepReplaceEnvPlaceholders(parsed);

  validateConfigShape(config);

  return {
    configPath,
    config,
  };
}

export async function loadRuntimeConfig(options: RuntimeOptions = {}): Promise<{
  configPath: string;
  config: QuillTypeConfig;
}> {
  const loaded = await loadConfig(options.configPathArg);
  const config = mergeRuntimeOptions(loaded.config, options);
  validateConfigShape(config);

  return {
    configPath: loaded.configPath,
    config,
  };
}

export async function writeSampleConfig(targetPath?: string): Promise<string> {
  const configPath = path.resolve(targetPath ?? "quilltype.config.json");

  try {
    await access(configPath);
    throw new AppError(`Config file already exists at ${configPath}.`, 2);
  } catch (error) {
    if (!(error instanceof AppError)) {
      const sampleConfig = JSON.stringify(createDefaultConfig(), null, 2);
      await writeFile(configPath, `${sampleConfig}\n`, "utf8");
    } else {
      throw error;
    }
  }

  return configPath;
}

export function buildConfigFromFlags(options: RuntimeOptions): QuillTypeConfig {
  const source = options.sourceOverride;
  const outputs = options.outputsOverride;

  if (!source || (!source.path && !source.url)) {
    throw new AppError(
      "Flags-first usage requires `--input <file>` or `--url <url>` when no config file is provided.",
      2,
    );
  }

  if (!outputs || outputs.length === 0) {
    throw new AppError(
      "Flags-first usage requires at least one output. Use `--output <path:mode>` or `--output <path> --mode <mode>`.",
      2,
    );
  }

  const config: QuillTypeConfig = {
    $schema: DEFAULT_SCHEMA_PATH,
    source,
    outputs,
    validation: {
      requireOperationIds: true,
      requireResponseSchemas: true,
    },
    watch: {
      pollIntervalMs: options.watchOverride?.pollIntervalMs ?? 30000,
      retryDelayMs: options.watchOverride?.retryDelayMs ?? 5000,
    },
  };

  if (options.againstOverride) {
    config.breaking = {
      against: options.againstOverride,
    };
  }

  validateConfigShape(config);
  return config;
}

export function mergeRuntimeOptions(
  baseConfig: QuillTypeConfig,
  options: RuntimeOptions,
): QuillTypeConfig {
  const nextConfig: QuillTypeConfig = structuredClone(baseConfig);

  if (options.sourceOverride && (options.sourceOverride.path || options.sourceOverride.url)) {
    nextConfig.source = {
      ...nextConfig.source,
      ...options.sourceOverride,
    };
  }

  if (options.outputsOverride && options.outputsOverride.length > 0) {
    nextConfig.outputs = options.outputsOverride;
  }

  if (options.watchOverride) {
    nextConfig.watch = {
      ...nextConfig.watch,
      ...options.watchOverride,
    };
  }

  if (options.againstOverride && (options.againstOverride.path || options.againstOverride.url)) {
    nextConfig.breaking = {
      against: options.againstOverride,
    };
  }

  return nextConfig;
}

export async function validateRuntimeConfig(options: RuntimeOptions = {}): Promise<{
  configPath: string;
  config: QuillTypeConfig;
}> {
  if (
    !options.configPathArg &&
    options.sourceOverride &&
    (options.sourceOverride.path || options.sourceOverride.url)
  ) {
    return {
      configPath: path.resolve("quilltype.inline.json"),
      config: buildConfigFromFlags(options),
    };
  }

  return loadRuntimeConfig(options);
}

export async function ensureWritableFileTarget(filePath: string): Promise<void> {
  let directory = path.dirname(filePath);

  while (directory !== path.dirname(directory)) {
    try {
      await access(directory, constants.W_OK);
      return;
    } catch {
      directory = path.dirname(directory);
    }
  }

  throw new AppError(`Output directory is not writable: ${path.dirname(filePath)}`, 2);
}

export function validateConfigShape(input: unknown): asserts input is QuillTypeConfig {
  const issues = getConfigValidationIssues(input);

  if (issues.length > 0) {
    throw new AppError(`Config validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`, 2);
  }
}

export function getConfigValidationIssues(input: unknown): string[] {
  const issues: string[] = [];

  if (!input || typeof input !== "object") {
    return ["Config must be an object."];
  }

  const config = input as QuillTypeConfig;

  validateSource(config.source, "source", issues);

  if (!Array.isArray(config.outputs) || config.outputs.length === 0) {
    issues.push("Config must define at least one output.");
  } else {
    for (let index = 0; index < config.outputs.length; index += 1) {
      validateOutput(config.outputs[index], `outputs[${index}]`, issues);
    }
  }

  if (config.validation && typeof config.validation !== "object") {
    issues.push("`validation` must be an object when provided.");
  }

  if (config.breaking) {
    if (typeof config.breaking !== "object") {
      issues.push("`breaking` must be an object when provided.");
    } else if (!config.breaking.against) {
      issues.push("`breaking.against` is required when `breaking` is provided.");
    } else {
      validateSource(config.breaking.against, "breaking.against", issues);
    }
  }

  if (config.watch) {
    if (typeof config.watch !== "object") {
      issues.push("`watch` must be an object when provided.");
    } else {
      validatePositiveInteger(config.watch.pollIntervalMs, "watch.pollIntervalMs", issues);
      validatePositiveInteger(config.watch.retryDelayMs, "watch.retryDelayMs", issues);
    }
  }

  if (config.$schema && typeof config.$schema !== "string") {
    issues.push("`$schema` must be a string when provided.");
  }

  return issues;
}

export function parseOutputArgument(value: string, modeFallback?: OutputMode): OutputConfig {
  const delimiterIndex = value.lastIndexOf(":");

  if (delimiterIndex > 1) {
    const candidatePath = value.slice(0, delimiterIndex);
    const candidateMode = value.slice(delimiterIndex + 1) as OutputMode;

    if (isSupportedOutputMode(candidateMode)) {
      return {
        path: candidatePath,
        mode: candidateMode,
      };
    }
  }

  if (!modeFallback) {
    throw new AppError(
      `Output ${value} is missing a mode. Use \`--output <path:mode>\` or add \`--mode <mode>\`.`,
      2,
    );
  }

  return {
    path: value,
    mode: modeFallback,
  };
}

export function isSupportedOutputMode(value: string): value is OutputMode {
  return value === "types" || value === "fetch-client" || value === "react-query";
}

function parseStructuredText(raw: string, filename: string): unknown {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(raw);
  }

  try {
    return JSON.parse(raw);
  } catch (jsonError) {
    try {
      return YAML.parse(raw);
    } catch {
      const detail = jsonError instanceof Error ? jsonError.message : "Unknown parse error";
      throw new AppError(`Failed to parse config file ${filename}: ${detail}`, 2);
    }
  }
}

function validateSource(source: unknown, context: string, issues: string[]): void {
  if (!source || typeof source !== "object") {
    issues.push(`\`${context}\` must be an object.`);
    return;
  }

  const typedSource = source as SourceConfig;

  if (typedSource.path && typedSource.url) {
    issues.push(`\`${context}\` cannot define both \`path\` and \`url\`.`);
  }

  if (!typedSource.path && !typedSource.url) {
    issues.push(`\`${context}\` must define either \`path\` or \`url\`.`);
  }

  if (typedSource.path && typeof typedSource.path !== "string") {
    issues.push(`\`${context}.path\` must be a string.`);
  }

  if (typedSource.url) {
    if (typeof typedSource.url !== "string") {
      issues.push(`\`${context}.url\` must be a string.`);
    } else if (!isUrl(typedSource.url)) {
      issues.push(`\`${context}.url\` must start with http:// or https://.`);
    }
  }

  if (typedSource.headers) {
    if (typeof typedSource.headers !== "object") {
      issues.push(`\`${context}.headers\` must be an object.`);
    } else {
      for (const [key, value] of Object.entries(typedSource.headers)) {
        if (typeof value !== "string") {
          issues.push(`\`${context}.headers.${key}\` must be a string.`);
        }
      }
    }
  }
}

function validateOutput(output: unknown, context: string, issues: string[]): void {
  if (!output || typeof output !== "object") {
    issues.push(`\`${context}\` must be an object.`);
    return;
  }

  const typedOutput = output as OutputConfig;

  if (!typedOutput.path || typeof typedOutput.path !== "string") {
    issues.push(`\`${context}.path\` must be a string.`);
  }

  if (!typedOutput.mode || typeof typedOutput.mode !== "string") {
    issues.push(`\`${context}.mode\` must be a string.`);
  } else if (!isSupportedOutputMode(typedOutput.mode)) {
    issues.push(
      `\`${context}.mode\` must be one of: types, fetch-client, react-query.`,
    );
  }
}

function validatePositiveInteger(
  value: number | undefined,
  context: string,
  issues: string[],
): void {
  if (value === undefined) {
    return;
  }

  if (!Number.isInteger(value) || value <= 0) {
    issues.push(`\`${context}\` must be a positive integer.`);
  }
}
