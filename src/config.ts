import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Application version — read from package.json (single source of truth).
 */
export const VERSION: string = pkg.version;

/**
 * Application configuration interface
 */
export interface ServerConfig {
  readonly httpPort: number;
  readonly transports: TransportType[];
  readonly loggerType: LoggerType;
  readonly azureIconLibraryPath: string | undefined;
}

export type TransportType = "stdio" | "http";
export type LoggerType = "console" | "mcp_server";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ServerConfig = {
  httpPort: 8080,
  transports: ["stdio"],
  loggerType: "console",
  azureIconLibraryPath: undefined,
} as const;

/**
 * Valid port range
 */
const PORT_RANGE = {
  min: 1,
  max: 65535,
} as const;

const VALID_LOGGER_TYPES: readonly LoggerType[] = ["console", "mcp_server"] as const;

/**
 * Parse http port value from string - pure function
 */
export const parseHttpPortValue = (
  value: string | undefined,
): number | Error => {
  if (!value) {
    return new Error("--http-port flag requires a port number");
  }

  const port = parseInt(value, 10);

  if (isNaN(port)) {
    return new Error(`Invalid port number "${value}". Port must be a number`);
  }

  if (port < PORT_RANGE.min || port > PORT_RANGE.max) {
    return new Error(
      `Invalid port number "${value}". Port must be between ${PORT_RANGE.min} and ${PORT_RANGE.max}`,
    );
  }

  return port;
};

/**
 * Parse logger type value - pure function
 */
export const parseLoggerType = (
  value: string | undefined,
): LoggerType | Error => {
  if (!value || value.trim().length === 0) {
    return DEFAULT_CONFIG.loggerType;
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_LOGGER_TYPES.includes(normalized as LoggerType)) {
    return normalized as LoggerType;
  }
  return new Error(
    `Invalid logger type "${value}". Supported types: ${VALID_LOGGER_TYPES.join(", ")}`,
  );
};

export const parseTransports = (
  values: string[] | undefined,
): TransportType[] | Error => {
  if (!values || values.length === 0) {
    return DEFAULT_CONFIG.transports;
  }

  const normalized = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return new Error("At least one transport must be specified");
  }

  const validTransports: TransportType[] = [];

  for (const value of normalized) {
    if (value === "stdio" || value === "http") {
      validTransports.push(value);
    } else {
      return new Error(
        `Invalid transport "${value}". Supported transports: stdio, http`,
      );
    }
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(validTransports));
};

/**
 * Find argument value by flag name - pure function
 */
export const findArgValue = (
  args: readonly string[],
  ...flags: string[]
): string | undefined => {
  const index = args.findIndex((arg) => flags.includes(arg));
  return index !== -1 ? args[index + 1] : undefined;
};

/**
 * Check if any flag exists in arguments - pure function
 */
export const hasFlag = (
  args: readonly string[],
  ...flags: string[]
): boolean => {
  return args.some((arg) => flags.includes(arg));
};

/**
 * Check if help was requested - pure function
 */
export const shouldShowHelp = (args: readonly string[]): boolean => {
  return hasFlag(args, "--help", "-h");
};

/**
 * Parse command line arguments into configuration object
 * Pure function - no side effects, deterministic output
 */
export const parseConfig = (
  args: readonly string[],
  env: Record<string, string | undefined> = {},
): ServerConfig | Error => {
  // Walk arguments so repeated flags allow "last wins" semantics
  let httpPortValue: string | undefined;
  let parsedHttpPort: number | undefined;
  let transportValues: string[] | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--http-port") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--http-port flag requires a port number");
      }

      httpPortValue = nextValue;
      i += 1;
    } else if (arg === "--transport") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--transport flag requires a transport name");
      }

      transportValues = [nextValue];
      i += 1;
    }
  }

  // ── HTTP port: CLI > env > default ──
  if (httpPortValue === undefined && env.HTTP_PORT) {
    httpPortValue = env.HTTP_PORT;
  }
  if (httpPortValue !== undefined) {
    const httpPort = parseHttpPortValue(httpPortValue);
    if (httpPort instanceof Error) {
      return httpPort;
    }
    parsedHttpPort = httpPort;
  }

  // ── Transport: CLI > env > default ──
  if (transportValues === undefined && env.TRANSPORT) {
    transportValues = [env.TRANSPORT];
  }
  const transports = parseTransports(transportValues);
  if (transports instanceof Error) {
    return transports;
  }

  // ── Logger type: env only (no CLI flag) ──
  const loggerType = parseLoggerType(env.LOGGER_TYPE);
  if (loggerType instanceof Error) {
    return loggerType;
  }

  // ── Azure icon library path: env only ──
  const azureIconLibraryPath = env.AZURE_ICON_LIBRARY_PATH?.trim() || undefined;

  return {
    ...DEFAULT_CONFIG,
    httpPort:
      parsedHttpPort !== undefined ? parsedHttpPort : DEFAULT_CONFIG.httpPort,
    transports,
    loggerType,
    azureIconLibraryPath,
  };
};

/**
 * Build configuration from process.argv
 * This is the main entry point for configuration
 * Returns Error for invalid config, or ServerConfig
 */
export const buildConfig = (): ServerConfig | Error => {
  const args = process.argv.slice(2);
  return parseConfig(args, process.env);
};
