#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  ensureWritableFileTarget,
  getConfigValidationIssues,
  isSupportedReportFormat,
  isSupportedOutputMode,
  parseOutputArgument,
  validateRuntimeConfig,
  writeSampleConfig,
} from "./config.js";
import {
  type ContractChange,
  detectContractChanges,
  formatContractChanges,
} from "./diff.js";
import { AppError } from "./errors.js";
import { generateOutputs } from "./generator.js";
import { loadDocumentFromSource, loadOpenApiDocument } from "./openapi.js";
import type {
  ContractReportFormat,
  OutputConfig,
  OutputMode,
  RuntimeOptions,
  SourceConfig,
} from "./types.js";
import { validateOpenApiDocument } from "./validate.js";
import { runWatchMode } from "./watch.js";

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const runtimeOptions = toRuntimeOptions(parsed);

  switch (parsed.command) {
    case "init": {
      const targetPath = parsed.options.config
        ? path.resolve(parsed.options.config)
        : path.resolve("quilltype.config.json");
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
      const breakingIssues = result.contractChanges.filter((change) => change.severity === "error");
      const warningIssues = result.contractChanges.filter((change) => change.severity === "warning");
      const reportOptions = resolveReportOptions(parsed.options, result.config);

      if (reportOptions && result.contractChanges.length > 0) {
        await writeContractReport(result.configPath, reportOptions, result.contractChanges);
      }

      if (staleOutputs.length > 0) {
        throw new AppError(
          `Generated output is stale:\n${staleOutputs.map((item) => `- ${item.outputPath} (${item.mode})`).join("\n")}`,
          2,
        );
      }

      if (breakingIssues.length > 0) {
        throw new AppError(formatContractChanges(result.contractChanges, "text"), 2);
      }

      if (warningIssues.length > 0) {
        console.log(formatContractChanges(result.contractChanges, "text"));
      } else {
        console.log("All generated outputs are up to date.");
      }
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
            summary: summarizeGeneration(result.results, result.contractChanges),
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
      ? detectContractChanges(
          await loadDocumentFromSource(config.breaking.against, configPath),
          loaded.document,
        )
      : [];

  return {
    configPath,
    config,
    results,
    watchPlan: loaded.watchPlan,
    contractChanges:
      config.breaking?.includeWarnings === false
        ? breakingIssues.filter((issue) => issue.severity === "error")
        : breakingIssues,
  };
}

async function runDoctor(runtimeOptions: RuntimeOptions): Promise<void> {
  const report: string[] = [];
  const { configPath, config } = await validateRuntimeConfig(runtimeOptions);
  const configIssues = getConfigValidationIssues(config);

  report.push(`Quill Type doctor`);
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
  report.push(`- outputs count: ${config.outputs.length}`);

  if (config.breaking?.against) {
    report.push(
      `- breaking baseline: ${
        config.breaking.against.path
          ? `file ${config.breaking.against.path}`
          : `url ${config.breaking.against.url}`
      }`,
    );
    report.push(`- breaking warnings: ${config.breaking.includeWarnings === false ? "disabled" : "enabled"}`);
    report.push(
      `- breaking report: ${
        config.breaking.report?.output
          ? `${config.breaking.report.format ?? "text"} -> ${config.breaking.report.output}`
          : config.breaking.report?.format
            ? `${config.breaking.report.format} (stdout only)`
            : "disabled"
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
    report.push(
      `- writable outputs: ${config.outputs.every((output) => Boolean(output.path)) ? "configured" : "missing"}`,
    );
  }

  console.log(report.join("\n"));
}

function summarizeGeneration(
  results: Array<{ changed: boolean; outputPath: string; mode: OutputMode }>,
  contractChanges: ContractChange[],
): string {
  const errorCount = contractChanges.filter((change) => change.severity === "error").length;
  const warningCount = contractChanges.filter((change) => change.severity === "warning").length;
  const lines = [
    `Regeneration summary (${new Date().toISOString()}):`,
    ...results.map((result) => `- ${result.changed ? "updated" : "unchanged"} ${result.outputPath} (${result.mode})`),
  ];

  if (contractChanges.length > 0) {
    lines.push(`- contract changes: ${contractChanges.length} total, ${errorCount} errors, ${warningCount} warnings`);
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
    reportFormat?: string;
    reportFile?: string;
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
      case "--report-format":
        options.reportFormat = requireValue(current, next);
        cursor += 1;
        break;
      case "--report-file":
        options.reportFile = requireValue(current, next);
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
        `Unsupported mode ${mode}. Expected one of: types, fetch-client, react-query, axios-client, swr, zod, json-schema.`,
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
  console.log(`Quill Type

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
  --report-format <fmt>    Write contract diff output as text, json, or markdown
  --report-file <path>     Write the contract diff report to a file
  --poll-interval <ms>     Remote watch polling interval
  --retry-delay <ms>       Remote watch retry delay
  --config <path>          Use a specific config file
`);
}

function resolveReportOptions(
  options: ParsedArgs["options"],
  config: Awaited<ReturnType<typeof validateRuntimeConfig>>["config"],
): { format: ContractReportFormat; output?: string } | null {
  const format = options.reportFormat ?? config.breaking?.report?.format;
  const output = options.reportFile ?? config.breaking?.report?.output;

  if (!format && !output) {
    return null;
  }

  if (format && !isSupportedReportFormat(format)) {
    throw new AppError(
      `Unsupported report format ${format}. Expected one of: text, json, markdown.`,
      2,
    );
  }

  return {
    format: (format ?? "text") as ContractReportFormat,
    output,
  };
}

async function writeContractReport(
  configPath: string,
  options: { format: ContractReportFormat; output?: string },
  changes: ContractChange[],
): Promise<void> {
  const content = formatContractChanges(changes, options.format);

  if (!options.output) {
    console.log(content);
    return;
  }

  const outputPath = path.resolve(path.dirname(configPath), options.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${content}\n`, "utf8");
  console.log(`Wrote contract report to ${outputPath} (${options.format})`);
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
