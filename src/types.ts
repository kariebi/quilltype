export type OutputMode = "types" | "fetch-client" | "react-query";

export interface SourceConfig {
  path?: string;
  url?: string;
  headers?: Record<string, string>;
}

export interface OutputConfig {
  path: string;
  mode: OutputMode;
}

export interface TypeBridgeConfig {
  $schema?: string;
  source: SourceConfig;
  outputs: OutputConfig[];
  validation?: {
    requireOperationIds?: boolean;
    requireResponseSchemas?: boolean;
  };
  breaking?: {
    against: SourceConfig;
  };
  watch?: {
    pollIntervalMs?: number;
    retryDelayMs?: number;
  };
}

export interface GenerateResult {
  outputPath: string;
  changed: boolean;
  mode: OutputMode;
}

export interface WatchPlan {
  localFiles: string[];
  remote?: {
    url: string;
    headers?: Record<string, string>;
    pollIntervalMs: number;
    retryDelayMs: number;
  };
}

export interface RuntimeOptions {
  configPathArg?: string;
  sourceOverride?: SourceConfig;
  outputsOverride?: OutputConfig[];
  watchOverride?: TypeBridgeConfig["watch"];
  againstOverride?: SourceConfig;
}
