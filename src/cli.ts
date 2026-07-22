#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";

import {
  ensureWritableFileTarget,
  getConfigValidationIssues,
  isSupportedOutputMode,
  parseOutputArgument,
  validateRuntimeConfig,
  writeSampleConfig,
} from "./config.js";
import { assertNoBreakingChanges, detectBreakingChanges, formatBreakingChanges } from "./diff.js";
import { AppError } from "./errors.js";
import { generateOutputs } from "./generator.js";
import { loadDocumentFromSource, loadOpenApiDocument } from "./openapi.js";
import type { OutputConfig, OutputMode, RuntimeOptions, SourceConfig } from "./types.js";
import { validateOpenApiDocument } from "./validate.js";
import { runWatchMode } from "./watch.js";

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const runtimeOptions = toRuntimeOptions(parsed);

  switch (parsed.command) {
    case "init": {
      const targetPath = parsed.options.config
        ? path.resolve(parsed.options.config)
        : path.resolve("typebridge.config.json");
      const configPath = await writeSampleConfig(targetPath);
      console.log(`Created ${configPath}`);
      return;
    }

    case "generate": {
      const result = await runGenerate(runtimeOptions, false);

      for (const output of result.results) {
        console.log(
          `${output.changed ? "updated" : "unchanged"} ${output.outputPath} (${output.mode})`,
        );
      }

      return;
    }

    case "check": {
      const result = await runGenerate(runtimeOptions, true);
      const staleOutputs = result.results.filter((item) => item.changed);

      if (staleOutputs.length > 0) {
        throw new AppError(
          `Generated output is stale:\n${staleOutputs.map((item) => `- ${item.outputPath} (${item.mode})`).join("\n")}`,
          2,
        );
      }

      if (result.breakingIssues.length > 0) {
        throw new AppError(formatBreakingChanges(result.breakingIssues), 2);
      }

      console.log("All generated outputs are up to date.");
      return;
    }

    case "watch": {
      console.log("Watching for OpenAPI or config changes. Press Ctrl+C to stop.");
      const runtimeConfig = await validateRuntimeConfig(runtimeOptions);

      await runWatchMode({
        run: async () => {
          const result = await runGenerate(runtimeOptions, false);
          return {
            plan: result.watchPlan,
            summary: summarizeGeneration(result.results, result.breakingIssues),
          };
        },
        getFallbackPlan: async () =>
          buildFallbackWatchPlan(runtimeConfig.configPath, runtimeConfig.config),
        onError: printError,
      });
      return;
    }

    case "config validate": {
      const { configPath, config } = await validateRuntimeConfig(runtimeOptions);
      validateOpenApiDocument((await loadOpenApiDocument(config, configPath)).document, config);
      console.log(`Config is valid: ${configPath}`);
      return;
    }

    case "doctor": {
      await runDoctor(runtimeOptions);
      return;
    }

    case "help":
    case undefined: {
      printHelp();
      return;
    }

    default:
      throw new AppError(`Unknown command: ${parsed.command}`, 2);
  }
}

async function runGenerate(runtimeOptions: RuntimeOptions, check: boolean) {
  const { configPath, config } = await validateRuntimeConfig(runtimeOptions);
  const loaded = await loadOpenApiDocument(config, configPath, runtimeOptions.sourceOverride);

  validateOpenApiDocument(loaded.document, config);

  if (!check) {
    for (const output of config.outputs) {
      await ensureWritableFileTarget(path.resolve(path.dirname(configPath), output.path));
    }
  }

  const results = await generateOutputs({
    config,
    configPath,
    document: loaded.document,
    sourceLabel: loaded.sourceLabel,
    check,
  });

  const breakingIssues =
    config.breaking?.against
      ? detectBreakingChanges(
          await loadDocumentFromSource(config.breaking.against, configPath),
          loaded.document,
        )
      : [];

  return {
    configPath,
    config,
    results,
    watchPlan: loaded.watchPlan,
    breakingIssues,
  };
}

async function runDoctor(runtimeOptions: RuntimeOptions): Promise<void> {
  const report: string[] = [];
  const { configPath, config } = await validateRuntimeConfig(runtimeOptions);
  const configIssues = getConfigValidationIssues(config);

  report.push(`TypeBridge doctor`);
  report.push(`- cwd: ${process.cwd()}`);
  report.push(`- node: ${process.version}`);
  report.push(`- config: ${configPath}`);
  report.push(
    `- source: ${config.source.path ? `file ${config.source.path}` : `url ${config.source.url}`}`,
  );
  report.push(
    `- outputs: ${config.outputs.map((output) => `${output.mode} -> ${output.path}`).join(", ")}`,
  );
  report.push(
    `- watch: pollIntervalMs=${config.watch?.pollIntervalMs ?? 30000}, retryDelayMs=${config.watch?.retryDelayMs ?? 5000}`,
  );

  if (config.breaking?.against) {
    report.push(
      `- breaking baseline: ${
        config.breaking.against.path
          ? `file ${config.breaking.against.path}`
          : `url ${config.breaking.against.url}`
      }`,
    );
  }

  if (configIssues.length > 0) {
    report.push(`- config issues: ${configIssues.join("; ")}`);
  } else {
    const loaded = await loadOpenApiDocument(config, configPath, runtimeOptions.sourceOverride);
    validateOpenApiDocument(loaded.document, config);
    report.push(`- schema load: ok`);
    report.push(
      `- watch targets: ${loaded.watchPlan.localFiles.length} local, ${
        loaded.watchPlan.remote ? "1 remote" : "0 remote"
      }`,
    );
  }

  console.log(report.join("\n"));
}

function summarizeGeneration(
  results: Array<{ changed: boolean; outputPath: string; mode: OutputMode }>,
  breakingIssues: Array<{ code: string; message: string }>,
): string {
  const lines = [
    `Regeneration summary (${new Date().toISOString()}):`,
    ...results.map((result) => `- ${result.changed ? "updated" : "unchanged"} ${result.outputPath} (${result.mode})`),
  ];

  if (breakingIssues.length > 0) {
    lines.push(`- breaking issues: ${breakingIssues.length}`);
  }

  return lines.join("\n");
}

async function buildFallbackWatchPlan(
  configPath: string,
  config: Awaited<ReturnType<typeof validateRuntimeConfig>>["config"],
) {
  const localFiles: string[] = [];

  try {
    await access(configPath);
    localFiles.push(configPath);
  } catch {
    // Flags-first inline configs do not have a real file to watch.
  }

  return {
    localFiles,
    remote: config.source.url
      ? {
          url: config.source.url,
          headers: config.source.headers,
          pollIntervalMs: config.watch?.pollIntervalMs ?? 30000,
          retryDelayMs: config.watch?.retryDelayMs ?? 5000,
        }
      : undefined,
  };
}

interface ParsedArgs {
  command?: string;
  options: {
    config?: string;
    input?: string;
    url?: string;
    headers: string[];
    outputs: string[];
    mode?: string;
    pollIntervalMs?: number;
    retryDelayMs?: number;
    against?: string;
    againstUrl?: string;
  };
}

function parseArgs(args: string[]): ParsedArgs {
  let commandParts: string[] = [];
  let cursor = 0;

  while (cursor < args.length && !args[cursor].startsWith("-")) {
    commandParts.push(args[cursor]);
    cursor += 1;

    if (commandParts[0] === "config" && commandParts.length === 2) {
      break;
    }
  }

  const command = normalizeCommand(commandParts);
  const options: ParsedArgs["options"] = {
    headers: [],
    outputs: [],
  };

  for (; cursor < args.length; cursor += 1) {
    const current = args[cursor];
    const next = args[cursor + 1];

    switch (current) {
      case "--config":
        options.config = requireValue(current, next);
        cursor += 1;
        break;
      case "--input":
        options.input = requireValue(current, next);
        cursor += 1;
        break;
      case "--url":
        options.url = requireValue(current, next);
        cursor += 1;
        break;
      case "--header":
        options.headers.push(requireValue(current, next));
        cursor += 1;
        break;
      case "--output":
        options.outputs.push(requireValue(current, next));
        cursor += 1;
        break;
      case "--mode":
        options.mode = requireValue(current, next);
        cursor += 1;
        break;
      case "--poll-interval":
        options.pollIntervalMs = parsePositiveInteger(requireValue(current, next), current);
        cursor += 1;
        break;
      case "--retry-delay":
        options.retryDelayMs = parsePositiveInteger(requireValue(current, next), current);
        cursor += 1;
        break;
      case "--against":
        options.against = requireValue(current, next);
        cursor += 1;
        break;
      case "--against-url":
        options.againstUrl = requireValue(current, next);
        cursor += 1;
        break;
      default:
        throw new AppError(`Unknown option: ${current}`, 2);
    }
  }

  return {
    command,
    options,
  };
}

function toRuntimeOptions(parsed: ParsedArgs): RuntimeOptions {
  const outputsOverride = buildOutputsOverride(parsed.options.outputs, parsed.options.mode);

  return {
    configPathArg: parsed.options.config,
    sourceOverride:
      parsed.options.input || parsed.options.url || parsed.options.headers.length > 0
        ? {
            path: parsed.options.input,
            url: parsed.options.url,
            headers: parseHeaders(parsed.options.headers),
          }
        : undefined,
    outputsOverride,
    watchOverride:
      parsed.options.pollIntervalMs || parsed.options.retryDelayMs
        ? {
            pollIntervalMs: parsed.options.pollIntervalMs,
            retryDelayMs: parsed.options.retryDelayMs,
          }
        : undefined,
    againstOverride:
      parsed.options.against || parsed.options.againstUrl
        ? {
            path: parsed.options.against,
            url: parsed.options.againstUrl,
          }
        : undefined,
  };
}

function buildOutputsOverride(values: string[], mode?: string): OutputConfig[] | undefined {
  if (values.length === 0) {
    return undefined;
  }

  let modeFallback: OutputMode | undefined;

  if (mode !== undefined) {
    if (!isSupportedOutputMode(mode)) {
      throw new AppError(
        `Unsupported mode ${mode}. Expected one of: types, fetch-client, react-query.`,
        2,
      );
    }

    modeFallback = mode;
  }

  return values.map((value) => parseOutputArgument(value, modeFallback));
}

function parseHeaders(values: string[]): Record<string, string> | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const headers: Record<string, string> = {};

  for (const value of values) {
    const separatorIndex = value.indexOf("=");

    if (separatorIndex < 1) {
      throw new AppError(`Invalid header ${value}. Expected KEY=VALUE.`, 2);
    }

    headers[value.slice(0, separatorIndex)] = value.slice(separatorIndex + 1);
  }

  return headers;
}

function normalizeCommand(parts: string[]): string | undefined {
  if (parts.length === 0) {
    return undefined;
  }

  if (parts[0] === "config" && parts[1] === "validate") {
    return "config validate";
  }

  return parts[0];
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new AppError(`Missing value for ${flag}.`, 2);
  }

  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${flag} expects a positive integer.`, 2);
  }

  return parsed;
}

function printHelp(): void {
  console.log(`TypeBridge

Commands:
  init                     Create a sample config file
  generate                 Validate the contract and write generated files
  check                    Fail if generated files are stale or breaking changes are detected
  watch                    Re-run generation when local or remote sources change
  config validate          Validate the config and source contract
  doctor                   Print environment and config diagnostics

Flags-first shortcuts:
  --input <file>           Use a local OpenAPI file without a config file
  --url <url>              Use a remote OpenAPI URL without a config file
  --output <path:mode>     Add an output. Repeat for multiple outputs.
  --mode <mode>            Fallback mode for outputs passed as bare paths
  --against <file>         Compare against a previous local OpenAPI document
  --against-url <url>      Compare against a previous remote OpenAPI document
  --header <KEY=VALUE>     Add a source request header. Repeat as needed.
  --poll-interval <ms>     Remote watch polling interval
  --retry-delay <ms>       Remote watch retry delay
  --config <path>          Use a specific config file
`);
}

function printError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(error.message);
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    return;
  }

  console.error(String(error));
}

main().catch((error: unknown) => {
  printError(error);
  process.exit(error instanceof AppError ? error.exitCode : 1);
});
