export type Logger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

function timestamp(): string {
  return new Date().toISOString();
}

/** Map log levels to emoji prefixes for console output. */
const LEVEL_EMOJI: Record<string, string> = {
  emergency: "\u274C",
  alert: "\u274C",
  critical: "\u274C",
  error: "\u274C",
  warning: "\u26A0\uFE0F",
  notice: "\u26A0\uFE0F",
};

export function create_logger(): Logger {
  return {
    log: (level, message, ...data) => {
      const emoji = LEVEL_EMOJI[level?.toLowerCase()] ?? "";
      const prefix = emoji ? `${emoji} ${level?.toUpperCase()}` : level?.toUpperCase();
      return data.length > 0 ? console.error(`${timestamp()} ${prefix}: ${message}`, ...data) : console.error(`${timestamp()} ${prefix}: ${message}`);
    },
    debug: (message, ...data) => {
      return data.length > 0 ? console.error(`${timestamp()} DEBUG: ${message}`, ...data) : console.error(`${timestamp()} DEBUG: ${message}`);
    },
  };
}
