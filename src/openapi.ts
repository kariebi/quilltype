import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { AppError } from "./errors.js";
import { resolveJsonPointer } from "./oas.js";
import type { SourceConfig, QuillTypeConfig, WatchPlan } from "./types.js";
import { isUrl } from "./utils.js";

export interface LoadedDocument {
  sourceLabel: string;
  document: Record<string, unknown>;
  watchPlan: WatchPlan;
}

export async function loadOpenApiDocument(
  config: QuillTypeConfig,
  configPath: string,
  sourceOverride?: SourceConfig,
): Promise<LoadedDocument> {
  const source = sourceOverride ?? config.source;

  if (source.path) {
    const sourcePath = path.resolve(path.dirname(configPath), source.path);
    const loadContext = await loadDocumentFromFile(sourcePath);

    return {
      sourceLabel: formatSourceLabel(sourcePath),
      document: loadContext.document,
      watchPlan: {
        localFiles: [configPath, ...loadContext.watchFiles],
      },
    };
  }

  if (!source.url) {
    throw new AppError("Config source is missing both `path` and `url`.", 2);
  }

  if (!isUrl(source.url)) {
    throw new AppError(`Unsupported source URL: ${source.url}`, 2);
  }

  let response: Response;

  try {
    response = await fetch(source.url, {
      headers: source.headers,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch OpenAPI document from ${source.url}. ${
        error instanceof Error ? error.message : String(error)
      }`,
      2,
    );
  }

  if (!response.ok) {
    throw new AppError(
      `Failed to fetch OpenAPI document from ${source.url}: ${response.status} ${response.statusText}`,
      2,
    );
  }

  const raw = await response.text();
  const document = parseDocument(raw, source.url);

  return {
    sourceLabel: source.url,
    document,
    watchPlan: {
      localFiles: [configPath],
      remote: {
        url: source.url,
        headers: source.headers,
        pollIntervalMs: config.watch?.pollIntervalMs ?? 30000,
        retryDelayMs: config.watch?.retryDelayMs ?? 5000,
      },
    },
  };
}

export async function loadDocumentFromSource(
  source: SourceConfig,
  basePath: string,
): Promise<Record<string, unknown>> {
  if (source.path) {
    const sourcePath = path.resolve(path.dirname(basePath), source.path);
    return (await loadDocumentFromFile(sourcePath)).document;
  }

  if (source.url) {
    let response: Response;

    try {
      response = await fetch(source.url, {
        headers: source.headers,
      });
    } catch (error) {
      throw new AppError(
        `Failed to fetch comparison OpenAPI document from ${source.url}. ${
          error instanceof Error ? error.message : String(error)
        }`,
        2,
      );
    }

    if (!response.ok) {
      throw new AppError(
        `Failed to fetch comparison OpenAPI document from ${source.url}: ${response.status} ${response.statusText}`,
        2,
      );
    }

    return parseDocument(await response.text(), source.url);
  }

  throw new AppError("Comparison source must define either `path` or `url`.", 2);
}

function formatSourceLabel(sourcePath: string): string {
  const relativePath = path.relative(process.cwd(), sourcePath);

  if (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return relativePath;
  }

  return sourcePath;
}

interface LoadedFileContext {
  document: Record<string, unknown>;
  watchFiles: string[];
}

async function loadDocumentFromFile(filePath: string): Promise<LoadedFileContext> {
  const watchFiles = new Set<string>();
  const cache = new Map<string, Record<string, unknown>>();
  const resolving = new Set<string>();

  const document = await loadResolvedFile(filePath, watchFiles, cache, resolving);

  return {
    document,
    watchFiles: [...watchFiles].sort(),
  };
}

async function loadResolvedFile(
  filePath: string,
  watchFiles: Set<string>,
  cache: Map<string, Record<string, unknown>>,
  resolving: Set<string>,
): Promise<Record<string, unknown>> {
  const absolutePath = path.resolve(filePath);

  if (cache.has(absolutePath)) {
    return structuredClone(cache.get(absolutePath)!);
  }

  if (resolving.has(absolutePath)) {
    throw new AppError(`Circular external $ref detected while loading ${absolutePath}.`, 2);
  }

  resolving.add(absolutePath);
  watchFiles.add(absolutePath);

  const raw = await readFile(absolutePath, "utf8");
  const parsed = parseDocument(raw, absolutePath);
  const resolved = await resolveExternalRefs(parsed, absolutePath, watchFiles, cache, resolving);

  cache.set(absolutePath, resolved);
  resolving.delete(absolutePath);

  return structuredClone(resolved);
}

async function resolveExternalRefs(
  input: unknown,
  sourcePath: string,
  watchFiles: Set<string>,
  cache: Map<string, Record<string, unknown>>,
  resolving: Set<string>,
): Promise<Record<string, unknown>> {
  const resolved = await resolveNode(input, sourcePath, watchFiles, cache, resolving);

  if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
    throw new AppError(`OpenAPI document ${sourcePath} must parse to an object.`, 2);
  }

  return resolved as Record<string, unknown>;
}

async function resolveNode(
  input: unknown,
  sourcePath: string,
  watchFiles: Set<string>,
  cache: Map<string, Record<string, unknown>>,
  resolving: Set<string>,
): Promise<unknown> {
  if (Array.isArray(input)) {
    return Promise.all(
      input.map((item) => resolveNode(item, sourcePath, watchFiles, cache, resolving)),
    );
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  const objectValue = input as Record<string, unknown>;

  if (typeof objectValue.$ref === "string" && !objectValue.$ref.startsWith("#/")) {
    const [refPath, fragment = ""] = objectValue.$ref.split("#");

    if (!refPath || isUrl(refPath)) {
      return input;
    }

    const referencedPath = path.resolve(path.dirname(sourcePath), refPath);
    const referencedDocument = await loadResolvedFile(referencedPath, watchFiles, cache, resolving);
    const target = fragment
      ? resolveJsonPointer(referencedDocument, `#${fragment}`)
      : referencedDocument;

    if (target === undefined) {
      throw new AppError(`Unable to resolve external $ref ${objectValue.$ref} from ${sourcePath}.`, 2);
    }

    return resolveNode(structuredClone(target), referencedPath, watchFiles, cache, resolving);
  }

  const entries = await Promise.all(
    Object.entries(objectValue).map(async ([key, value]) => [
      key,
      await resolveNode(value, sourcePath, watchFiles, cache, resolving),
    ]),
  );

  return Object.fromEntries(entries);
}

function parseDocument(raw: string, sourceLabel: string): Record<string, unknown> {
  const ext = path.extname(sourceLabel).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return ensureObject(YAML.parse(raw), sourceLabel);
  }

  try {
    return ensureObject(JSON.parse(raw), sourceLabel);
  } catch (jsonError) {
    try {
      return ensureObject(YAML.parse(raw), sourceLabel);
    } catch {
      const detail = jsonError instanceof Error ? jsonError.message : "Unknown parse error";
      throw new AppError(`Failed to parse OpenAPI document ${sourceLabel}: ${detail}`, 2);
    }
  }
}

function ensureObject(value: unknown, sourceLabel: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(`OpenAPI document ${sourceLabel} must parse to an object.`, 2);
  }

  return value as Record<string, unknown>;
}
