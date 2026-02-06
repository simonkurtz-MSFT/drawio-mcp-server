import {
  parseHttpPortValue,
  findArgValue,
  hasFlag,
  shouldShowHelp,
  parseConfig,
  buildConfig,
  parseTransports,
} from "../src/config.js";

describe("parseHttpPortValue", () => {
  test("valid port returns number", () => {
    expect(parseHttpPortValue("8080")).toBe(8080);
  });

  test("undefined input returns Error", () => {
    expect(parseHttpPortValue(undefined)).toBeInstanceOf(Error);
  });

  test("non-numeric string returns Error", () => {
    expect(parseHttpPortValue("abc")).toBeInstanceOf(Error);
  });

  test("out of range returns Error", () => {
    expect(parseHttpPortValue("70000")).toBeInstanceOf(Error);
  });
});

describe("parseTransports", () => {
  test("returns default when undefined", () => {
    expect(parseTransports(undefined)).toEqual(["stdio"]);
  });

  test("parses single transport", () => {
    expect(parseTransports(["stdio"])).toEqual(["stdio"]);
  });

  test("parses comma separated list", () => {
    expect(parseTransports(["stdio,http"])).toEqual(["stdio", "http"]);
  });

  test("deduplicates transports", () => {
    expect(parseTransports(["stdio", "stdio"])).toEqual(["stdio"]);
  });

  test("rejects empty string", () => {
    const result = parseTransports([""]);
    expect(result).toBeInstanceOf(Error);
  });

  test("rejects unknown transport", () => {
    const result = parseTransports(["foo"]);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("findArgValue", () => {
  test("finds value after flag", () => {
    expect(findArgValue(["--port", "8080", "--help"], "--port")).toBe("8080");
  });

  test("returns undefined when flag not found", () => {
    expect(findArgValue(["--help"], "--port")).toBeUndefined();
  });

  test("returns undefined when flag is last argument", () => {
    expect(findArgValue(["--port"], "--port")).toBeUndefined();
  });

  test("finds value with short flag", () => {
    expect(findArgValue(["-p", "8080"], "-p")).toBe("8080");
  });

  test("works with readonly array", () => {
    const args = ["--port", "8080"] as const;
    expect(findArgValue(args, "--port")).toBe("8080");
  });
});

describe("hasFlag", () => {
  test("returns true when flag exists", () => {
    expect(hasFlag(["--help", "--port", "8080"], "--help")).toBe(true);
  });

  test("returns false when flag does not exist", () => {
    expect(hasFlag(["--port", "8080"], "--help")).toBe(false);
  });

  test("returns true with short flag", () => {
    expect(hasFlag(["-h"], "-h")).toBe(true);
  });

  test("works with multiple flags", () => {
    expect(hasFlag(["-h"], "-h", "--help")).toBe(true);
  });

  test("works with readonly array", () => {
    const args = ["--help"] as const;
    expect(hasFlag(args, "--help")).toBe(true);
  });
});

describe("shouldShowHelp", () => {
  test("returns true for --help", () => {
    expect(shouldShowHelp(["--help"])).toBe(true);
  });

  test("returns true for -h", () => {
    expect(shouldShowHelp(["-h"])).toBe(true);
  });

  test("returns false for no help flag", () => {
    expect(shouldShowHelp(["--http-port", "8080"])).toBe(false);
  });

  test("returns false for empty args", () => {
    expect(shouldShowHelp([])).toBe(false);
  });
});

describe("parseConfig", () => {
  test("no args returns default config", () => {
    expect(parseConfig([])).toEqual({
      httpPort: 8080,
      transports: ["stdio"],
    });
  });

  test("--http-port flag sets custom port", () => {
    expect(parseConfig(["--http-port", "4242"])).toEqual({
      httpPort: 4242,
      transports: ["stdio"],
    });
  });

  test("help flag is ignored in config parsing", () => {
    expect(parseConfig(["--help"])).toEqual({
      httpPort: 8080,
      transports: ["stdio"],
    });
  });

  test("invalid port returns Error", () => {
    const result = parseConfig(["--http-port", "abc"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("missing http port value returns Error", () => {
    const result = parseConfig(["--http-port"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(
      "--http-port flag requires a port number",
    );
  });

  test("out of range port returns Error", () => {
    const result = parseConfig(["--http-port", "70000"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("last http-port flag wins", () => {
    expect(parseConfig(["--http-port", "4000", "--http-port", "5000"])).toEqual(
      {
        httpPort: 5000,
        transports: ["stdio"],
      },
    );
  });

  test("sets single transport", () => {
    expect(parseConfig(["--transport", "stdio"])).toEqual({
      httpPort: 8080,
      transports: ["stdio"],
    });
  });

  test("sets multiple transports", () => {
    expect(parseConfig(["--transport", "stdio,http"])).toEqual({
      httpPort: 8080,
      transports: ["stdio", "http"],
    });
  });

  test("rejects unknown transport", () => {
    const result = parseConfig(["--transport", "foo"]);
    expect(result).toBeInstanceOf(Error);
  });

  test("missing transport value returns Error", () => {
    const result = parseConfig(["--transport"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(
      "--transport flag requires a transport name",
    );
  });
});

describe("buildConfig", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  test("uses default config with empty args", () => {
    process.argv = ["node", "script.js"];
    const result = buildConfig();
    expect(result).toEqual({
      httpPort: 8080,
      transports: ["stdio"],
    });
  });

  test("parses custom http port from argv", () => {
    process.argv = ["node", "script.js", "--http-port", "4242"];
    const result = buildConfig();
    expect(result).toEqual({
      httpPort: 4242,
      transports: ["stdio"],
    });
  });

  test("returns Error for invalid config", () => {
    process.argv = ["node", "script.js", "--http-port", "abc"];
    const result = buildConfig();
    expect(result).toBeInstanceOf(Error);
  });
});
