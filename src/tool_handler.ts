/**
 * Factory for creating MCP tool handlers with logging.
 * Extracted for testability and reuse.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Minimal logger interface for tool handler logging.
 */
export interface ToolLogger {
  debug: (...args: any[]) => void;
}

/**
 * Map of tool names to their async handler functions.
 */
export type ToolHandlerMap = Record<string, (args: any) => Promise<CallToolResult>>;

/**
 * Creates a factory function that produces MCP tool handlers with logging.
 *
 * Each returned handler:
 * 1. Extracts session/request metadata from the `extra` parameter
 * 2. Logs the tool invocation
 * 3. Dispatches to the matching handler in `handlerMap`
 * 4. Logs success/error and duration
 * 5. Returns a structured error if the tool name is not found
 *
 * @param handlerMap - Map of tool names to handler functions
 * @param log - Logger instance for debug output
 * @returns A `createToolHandler` function for registering tools
 */
export function createToolHandlerFactory(handlerMap: ToolHandlerMap, log: ToolLogger) {
  function createToolHandler(toolName: string, hasArgs: true): (args: any, extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs?: false): (extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs = false) {
    return async (...params: any[]) => {
      const extra = hasArgs ? params[1] : params[0];
      const args = hasArgs ? params[0] : {};
      const sessionId = extra?.sessionId ?? "no-session";
      const requestId = extra?.requestId;
      log.debug(`[tool:${toolName}] called (session=${sessionId}, req=${requestId})`);

      const handler = handlerMap[toolName];
      if (handler) {
        const start = Date.now();
        const result = await handler(args);
        const duration = Date.now() - start;
        const isError = result.isError ?? false;
        log.debug(`[tool:${toolName}] ${isError ? "error" : "ok"} in ${duration}ms (session=${sessionId}, req=${requestId})`);
        return result;
      }
      log.debug(`[tool:${toolName}] not found (session=${sessionId}, req=${requestId})`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Tool ${toolName} not available` }) }],
        isError: true,
      };
    };
  }

  return createToolHandler;
}
