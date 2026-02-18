export type Logger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

function timestamp(): string {
  return new Date().toISOString();
}

export function create_logger(): Logger {
  return {
    log: (level, message, ...data) => {
      return data.length > 0
        ? console.error(`${timestamp()} ${level?.toUpperCase()}: ${message}`, ...data)
        : console.error(`${timestamp()} ${level?.toUpperCase()}: ${message}`);
    },
    debug: (message, ...data) => {
      return data.length > 0
        ? console.error(`${timestamp()} DEBUG: ${message}`, ...data)
        : console.error(`${timestamp()} DEBUG: ${message}`);
    },
  };
}
