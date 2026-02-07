import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolHandlerFactory, type ToolLogger, type ToolHandlerMap } from "../src/tool_handler.js";

describe("createToolHandlerFactory", () => {
  let log: ToolLogger;
  const mockExtra = { sessionId: "test-session", requestId: "req-1" };

  beforeEach(() => {
    log = { debug: vi.fn() };
  });

  describe("handler dispatch", () => {
    it("should dispatch to the correct handler with args when hasArgs=true", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerMap: ToolHandlerMap = {
        "my-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("my-tool", true);
      const result = await handler({ x: 100, y: 200 }, mockExtra);

      expect(handlerMap["my-tool"]).toHaveBeenCalledWith({ x: 100, y: 200 });
      expect(result).toBe(mockResult);
    });

    it("should pass empty args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"data":"ok"}' }],
      };
      const handlerMap: ToolHandlerMap = {
        "no-args-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args-tool");
      const result = await handler(mockExtra);

      expect(handlerMap["no-args-tool"]).toHaveBeenCalledWith({});
      expect(result).toBe(mockResult);
    });

    it("should return structured error for unknown tool name", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("nonexistent-tool", true);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain("nonexistent-tool");
      expect(parsed.error).toContain("not available");
    });

    it("should return structured error for unknown tool without args", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing-tool");
      const result = await handler(mockExtra);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain("missing-tool");
    });
  });

  describe("logging", () => {
    it("should log tool call with session and request IDs", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "logged-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("logged-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      expect(debugCalls.every((msg: string) => !msg.includes("session="))).toBe(true);
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining("req=req-1"),
      );
    });

    it("should handle missing sessionId without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool", true);
      await handler({}, { requestId: "r1" });

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      expect(debugCalls.every((msg: string) => !msg.includes("session="))).toBe(true);
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining("req=r1"),
      );
    });

    it("should handle undefined extra without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool");
      await handler(undefined);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      expect(debugCalls.every((msg: string) => !msg.includes("session="))).toBe(true);
    });

    it("should log 'ok' for successful handler results", async () => {
      const successResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "ok-tool": vi.fn().mockResolvedValue(successResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("ok-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("ok in"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toContain("[tool:ok-tool]");
    });

    it("should log 'error' for handler results with isError=true", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":"fail"}' }],
        isError: true,
      };
      const handlerMap: ToolHandlerMap = {
        "error-tool": vi.fn().mockResolvedValue(errorResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("error-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("error in"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toContain("[tool:error-tool]");
    });

    it("should log 'not found' for unknown tools", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing", true);
      await handler({}, mockExtra);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining("not found"),
      );
    });

    it("should include duration in success log", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "timed-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("timed-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("ms"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toMatch(/\d+ms/);
    });

    it("should pad tool prefix to align status words", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "a": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("a", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const calledLog = debugCalls.find((msg: string) => msg.includes("called"));
      const okLog = debugCalls.find((msg: string) => msg.includes("ok in"));
      // Both lines should have the prefix padded to the same width (30 chars)
      expect(calledLog).toMatch(/^\[tool:a\]\s+called/);
      expect(okLog).toMatch(/^\[tool:a\]\s+ok in/);
      // The prefix "[tool:a]" (8 chars) padded to 30, plus a space separator = status starts at 31
      expect(calledLog!.indexOf("called")).toBe(31);
      expect(okLog!.indexOf("ok in")).toBe(31);
    });
  });
});
