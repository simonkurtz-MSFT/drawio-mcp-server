#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";

import EventEmitter from "node:events";
import { createServer } from "node:net";

import { WebSocket, WebSocketServer } from "ws";
import { buildConfig, shouldShowHelp, type ServerConfig } from "./config.js";
import {
  Bus,
  bus_reply_stream,
  bus_request_stream,
  BusListener,
  Context,
} from "./types.js";
import { create_bus } from "./emitter_bus.js";
import { default_tool } from "./tool.js";
import { nanoid_id_generator } from "./nanoid_id_generator.js";
import { create_logger as create_console_logger } from "./mcp_console_logger.js";
import {
  create_logger as create_server_logger,
  validLogLevels,
} from "./mcp_server_logger.js";
import { standaloneHandlers } from "./standalone_tools.js";

// Flag to track if we're in standalone mode (set in main())
let isStandaloneMode = false;

const VERSION = "1.6.1";

/**
 * Display help message and exit
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --extension-port, -p <number>  WebSocket server port for browser extension (default: 3333)
  --standalone                   Run in standalone mode (no browser extension required)
  --help, -h                     Show this help message

Examples:
  drawio-mcp-server                           # Use default extension port 3333
  drawio-mcp-server --extension-port 8080     # Use custom extension port 8080
  drawio-mcp-server -p 8080                   # Short form
  drawio-mcp-server --standalone              # Standalone mode (generates XML directly)
  `);
  process.exit(0);
}

// No PORT constant needed - using dynamic config

async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen(port, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

const emitter = new EventEmitter();
const conns = new Set<WebSocket>();

const bus_to_ws_forwarder_listener = (event: any) => {
  log.debug(
    `[bridge] received; forwarding message to #${conns.size} clients`,
    event,
  );
  for (const ws of [...conns]) {
    if (ws.readyState !== WebSocket.OPEN) {
      conns.delete(ws);
      continue;
    }

    try {
      ws.send(JSON.stringify(event));
    } catch (e) {
      log.debug("[bridge] error forwarding request", e);
      conns.delete(ws);
    }
  }
};
emitter.on(bus_request_stream, bus_to_ws_forwarder_listener);

async function start_websocket_server(extensionPort: number) {
  log.debug(
    `Draw.io MCP Server (${VERSION}) starting (WebSocket extension port: ${extensionPort})`,
  );
  const isPortAvailable = await checkPortAvailable(extensionPort);

  if (!isPortAvailable) {
    console.error(
      `[start_websocket_server] Error: Port ${extensionPort} is already in use. Please stop the process using this port and try again.`,
    );
    process.exit(1);
  }

  const server = new WebSocketServer({ port: extensionPort });

  server.on("connection", (ws) => {
    log.debug(
      `[ws_handler] A WebSocket client #${conns.size} connected, presumably MCP Extension!`,
    );
    conns.add(ws);

    ws.on("message", (data) => {
      const str = typeof data === "string" ? data : data.toString();
      try {
        const json = JSON.parse(str);
        log.debug(`[ws] received from Extension`, json);
        emitter.emit(bus_reply_stream, json);
      } catch (error) {
        log.debug(`[ws] failed to parse message`, error);
      }
    });

    ws.on("close", (code) => {
      conns.delete(ws);
      log.debug(`[ws_handler] WebSocket client closed with code ${code}`);
    });

    ws.on("error", (error) => {
      log.debug(`[ws_handler] WebSocket client error`, error);
      conns.delete(ws);
    });
  });

  server.on("listening", () => {
    log.debug(`[start_websocket_server] Listening to port ${extensionPort}`);
  });

  server.on("error", (error) => {
    console.error(
      `[start_websocket_server] Error: Failed to listen on port ${extensionPort}`,
      error,
    );
    process.exit(1);
  });

  return server;
}

const logger_type = process.env.LOGGER_TYPE;
let capabilities: any = {
  resources: {},
  tools: {},
};
if (logger_type === "mcp_server") {
  capabilities = {
    ...capabilities,
    logging: {
      setLevels: true,
      levels: validLogLevels,
    },
  };
}

// Create server instance
const server = new McpServer(
  {
    name: "drawio-mcp-server",
    version: VERSION,
  },
  {
    capabilities,
  },
);

const log =
  logger_type === "mcp_server"
    ? create_server_logger(server)
    : create_console_logger();
const bus = create_bus(log)(emitter);
const id_generator = nanoid_id_generator();

const context: Context = {
  bus,
  id_generator,
  log,
};

/**
 * Helper to create a tool handler that uses standalone mode or bridge mode
 */
function createToolHandler(toolName: string) {
  return async (args: any) => {
    if (isStandaloneMode) {
      const handler = standaloneHandlers[toolName as keyof typeof standaloneHandlers];
      if (handler) {
        return handler(args);
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Tool ${toolName} not available in standalone mode` }) }],
        isError: true,
      };
    }
    // Use bridge mode (original behavior)
    return default_tool(toolName, context)(args, {} as any);
  };
}

const TOOL_get_selected_cell = "get-selected-cell";
server.registerTool(
  TOOL_get_selected_cell,
  {
    description: "[Bridge only] Retrieve the currently selected cell (vertex or edge) from the Draw.io UI. Returns JSON with cell attributes. In standalone mode, use list-paged-model instead.",
  },
  createToolHandler(TOOL_get_selected_cell),
);

const TOOL_add_rectangle = "add-rectangle";
server.registerTool(
  TOOL_add_rectangle,
  {
    description: "[Standalone+Bridge] Add a new rectangle vertex cell to the diagram. Prefer batch-add-cells for multiple cells (fewer calls, faster).",
    inputSchema: {
      x: z
        .number()
        .optional()
        .describe("X-axis position of the Rectangle vertex cell")
        .default(100),
      y: z
        .number()
        .optional()
        .describe("Y-axis position of the Rectangle vertex cell")
        .default(100),
      width: z
        .number()
        .optional()
        .describe("Width of the Rectangle vertex cell")
        .default(200),
      height: z
        .number()
        .optional()
        .describe("Height of the Rectangle vertex cell")
        .default(100),
      text: z
        .string()
        .optional()
        .describe("Text content placed inside of the Rectangle vertex cell")
        .default("New Cell"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
        )
        .default("whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"),
    },
  },
  createToolHandler(TOOL_add_rectangle),
);

const TOOL_add_edge = "add-edge";
server.registerTool(
  TOOL_add_edge,
  {
    description: "[Standalone+Bridge] Create an edge (connection/relation) between two vertex cells. Prefer batch-add-cells for multiple edges (fewer calls, faster).",
    inputSchema: {
      source_id: z
        .string()
        .describe("Source ID of a cell. It is represented by `id` attribute."),
      target_id: z
        .string()
        .describe("Target ID of a cell. It is represented by `id` attribute."),
      text: z
        .string()
        .optional()
        .describe("Text content placed over the edge cell"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;`",
        )
        .default(
          "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;",
        ),
    },
  },
  createToolHandler(TOOL_add_edge),
);

const TOOL_delete_cell_by_id = "delete-cell-by-id";
server.registerTool(
  TOOL_delete_cell_by_id,
  {
    description: "[Standalone+Bridge] Delete a cell (vertex or edge) by its ID.",
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
        ),
    },
  },
  createToolHandler(TOOL_delete_cell_by_id),
);

const TOOL_get_shape_categories = "get-shape-categories";
server.registerTool(
  TOOL_get_shape_categories,
  {
    description: "[Standalone+Bridge] Get available shape categories (General, Flowchart, Azure icons). Use search-shapes for faster fuzzy lookup.",
  },
  createToolHandler(TOOL_get_shape_categories),
);

const TOOL_get_shapes_in_category = "get-shapes-in-category";
server.registerTool(
  TOOL_get_shapes_in_category,
  {
    description: "[Standalone+Bridge] List all shapes in a category. Returns shape names and styles for use with add-cell-of-shape.",
    inputSchema: {
      category_id: z
        .string()
        .describe(
          "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
        ),
    },
  },
  createToolHandler(TOOL_get_shapes_in_category),
);

const TOOL_get_shape_by_name = "get-shape-by-name";
server.registerTool(
  TOOL_get_shape_by_name,
  {
    description: "[Standalone+Bridge] Get a shape by exact name. For fuzzy matching, use search-shapes instead.",
    inputSchema: {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieve from the shape library of the current diagram.",
        ),
    },
  },
  createToolHandler(TOOL_get_shape_by_name),
);

const TOOL_add_cell_of_shape = "add-cell-of-shape";
server.registerTool(
  TOOL_add_cell_of_shape,
  {
    description: "[Standalone+Bridge] Add a vertex cell using a shape from the library (e.g., Azure icons). Use search-shapes to find shape names. Prefer batch-add-cells when adding multiple shapes.",
    inputSchema: {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieve from the shape library (e.g., 'rectangle', 'decision', or an Azure icon name). Use search-shapes to discover names.",
        ),
      x: z
        .number()
        .optional()
        .describe("X-axis position of the vertex cell of the shape")
        .default(100),
      y: z
        .number()
        .optional()
        .describe("Y-axis position of the vertex cell of the shape")
        .default(100),
      width: z
        .number()
        .optional()
        .describe("Width of the vertex cell (defaults to the shape's native width)"),
      height: z
        .number()
        .optional()
        .describe("Height of the vertex cell (defaults to the shape's native height)"),
      text: z
        .string()
        .optional()
        .describe("Text content placed inside of the vertex cell of the shape"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
        ),
    },
  },
  createToolHandler(TOOL_add_cell_of_shape),
);

const TOOL_batch_add_cells_of_shape = "batch-add-cells-of-shape";
server.registerTool(
  TOOL_batch_add_cells_of_shape,
  {
    description: "[Standalone only] Add multiple shape-based cells in one call. Much faster than calling add-cell-of-shape individually. Supports Azure icons and basic shapes.",
    inputSchema: {
      cells: z.array(z.object({
        shape_name: z.string().describe("Name of the shape from the library (e.g., Azure icon name or basic shape like 'rectangle')"),
        x: z.number().optional().describe("X-axis position of the vertex cell"),
        y: z.number().optional().describe("Y-axis position of the vertex cell"),
        width: z.number().optional().describe("Width (defaults to shape's native width)"),
        height: z.number().optional().describe("Height (defaults to shape's native height)"),
        text: z.string().optional().describe("Text label (defaults to shape title)"),
        style: z.string().optional().describe("Override the shape's default style"),
        temp_id: z.string().optional().describe("Temporary ID for referencing this cell later"),
      })).describe("Array of shape cells to create"),
    },
  },
  createToolHandler(TOOL_batch_add_cells_of_shape),
);

const TOOL_set_cell_shape = "set-cell-shape";
server.registerTool(
  TOOL_set_cell_shape,
  {
    description: "[Standalone+Bridge] Update a cell's visual style to match a library shape. Use search-shapes to find shape names. Prefer the 'cells' array for batch updates.",
    inputSchema: {
      cell_id: z
        .string()
        .optional()
        .describe(
          "Identifier (`id` attribute) of the cell whose shape should change.",
        ),
      shape_name: z
        .string()
        .optional()
        .describe(
          "Name of the library shape whose style should be applied to the existing cell.",
        ),
      cells: z
        .array(
          z.object({
            cell_id: z.string().describe("Cell ID to update"),
            shape_name: z.string().describe("Shape name to apply"),
          }),
        )
        .optional()
        .describe(
          "Array of cell-shape pairs for batch operations. Cannot be used with cell_id/shape_name.",
        ),
    },
  },
  createToolHandler(TOOL_set_cell_shape),
);

const TOOL_set_cell_data = "set-cell-data";
server.registerTool(
  TOOL_set_cell_data,
  {
    description: "[Standalone+Bridge] Set a custom data attribute on a cell. Note: In standalone mode, data is not persisted to XML.",
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the cell to update with custom data.",
        ),
      key: z.string().describe("Name of the attribute to set on the cell."),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe(
          "Value to store for the attribute. Non-string values are stringified before storage.",
        ),
    },
  },
  createToolHandler(TOOL_set_cell_data),
);

const TOOL_edit_cell = "edit-cell";
server.registerTool(
  TOOL_edit_cell,
  {
    description: "[Standalone+Bridge] Update a vertex cell's properties (position, size, text, style). Only specified fields change.",
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the cell to update. Applies to vertex/shape cells.",
        ),
      text: z
        .string()
        .optional()
        .describe("Replace the cell's text/label content."),
      x: z
        .number()
        .optional()
        .describe("Set a new X-axis position for the cell."),
      y: z
        .number()
        .optional()
        .describe("Set a new Y-axis position for the cell."),
      width: z.number().optional().describe("Set a new width for the cell."),
      height: z.number().optional().describe("Set a new height for the cell."),
      style: z
        .string()
        .optional()
        .describe(
          "Replace the cell's style string (semi-colon separated `key=value` pairs).",
        ),
    },
  },
  createToolHandler(TOOL_edit_cell),
);

const TOOL_edit_edge = "edit-edge";
server.registerTool(
  TOOL_edit_edge,
  {
    description: "[Standalone+Bridge] Update an edge's properties (text, source, target, style). Only specified fields change.",
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the edge cell to update. The ID must reference an edge.",
        ),
      text: z.string().optional().describe("Replace the edge's label text."),
      source_id: z
        .string()
        .optional()
        .describe("Reassign the edge's source terminal to a different cell ID."),
      target_id: z
        .string()
        .optional()
        .describe("Reassign the edge's target terminal to a different cell ID."),
      style: z
        .string()
        .optional()
        .describe(
          "Replace the edge's style string (semi-colon separated `key=value` pairs).",
        ),
    },
  },
  createToolHandler(TOOL_edit_edge),
);

const Attributes: z.ZodType<any> = z.lazy(() =>
  z
    .array(
      z.union([
        z.string(),
        Attributes, // recursion: nested arrays
      ]),
    )
    .refine((arr) => arr.length === 0 || typeof arr[0] === "string", {
      message: "If not empty, the first element must be a string operator",
    })
    .default([]),
);

const TOOL_list_paged_model = "list-paged-model";
server.registerTool(
  TOOL_list_paged_model,
  {
    description: "[Standalone+Bridge] Get a paginated list of all cells with filtering. Use this to inspect diagram structure or find cells by type/attributes.",
    inputSchema: {
      page: z
        .number()
        .optional()
        .describe(
          "Zero-based page number for pagination. Page 0 returns the first batch of cells, page 1 returns the next batch, etc. Default is 0.",
        )
        .default(0),
      page_size: z
        .number()
        .optional()
        .describe(
          "Maximum number of cells to return in a single page. Controls response size and performance. Must be between 1 and 1000. Default is 50.",
        )
        .default(50),
      filter: z
        .object({
          cell_type: z
            .enum(["edge", "vertex", "object", "layer", "group"])
            .optional()
            .describe(
              "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes, 'object' for any cell type, 'layer' for layer cells, 'group' for grouped cells",
            ),
          attributes: Attributes.optional().describe(
            'Boolean logic array expressions for filtering cell attributes. Format: ["and" | "or", ...expressions] or ["equal", key, value]. Matches against cell attributes and parsed style properties.',
          ),
        })
        .optional()
        .describe("Optional filter criteria to apply to cells before pagination")
        .default({}),
    },
  },
  createToolHandler(TOOL_list_paged_model),
);

const TOOL_list_layers = "list-layers";
server.registerTool(
  TOOL_list_layers,
  {
    description: "[Standalone+Bridge] List all layers in the diagram with IDs and names.",
  },
  createToolHandler(TOOL_list_layers),
);

const TOOL_set_active_layer = "set-active-layer";
server.registerTool(
  TOOL_set_active_layer,
  {
    description: "[Standalone+Bridge] Set the active layer for new elements.",
    inputSchema: {
      layer_id: z.string().describe("ID of the layer to set as active"),
    },
  },
  createToolHandler(TOOL_set_active_layer),
);

const TOOL_move_cell_to_layer = "move-cell-to-layer";
server.registerTool(
  TOOL_move_cell_to_layer,
  {
    description: "[Standalone+Bridge] Move a cell to a different layer.",
    inputSchema: {
      cell_id: z.string().describe("ID of the cell to move"),
      target_layer_id: z
        .string()
        .describe("ID of the target layer where the cell will be moved"),
    },
  },
  createToolHandler(TOOL_move_cell_to_layer),
);

const TOOL_get_active_layer = "get-active-layer";
server.registerTool(
  TOOL_get_active_layer,
  {
    description: "[Standalone+Bridge] Get the currently active layer.",
  },
  createToolHandler(TOOL_get_active_layer),
);

const TOOL_create_layer = "create-layer";
server.registerTool(
  TOOL_create_layer,
  {
    description: "[Standalone+Bridge] Create a new layer in the diagram.",
    inputSchema: {
      name: z.string().describe("Name for the new layer"),
    },
  },
  createToolHandler(TOOL_create_layer),
);

// Standalone-only tools
const TOOL_export_diagram = "export-diagram";
server.registerTool(
  TOOL_export_diagram,
  {
    description: "[Standalone only] Export the diagram as Draw.io XML. Save output to a .drawio file.",
  },
  createToolHandler(TOOL_export_diagram),
);

const TOOL_clear_diagram = "clear-diagram";
server.registerTool(
  TOOL_clear_diagram,
  {
    description: "[Standalone only] Clear all cells and reset the diagram.",
  },
  createToolHandler(TOOL_clear_diagram),
);

// Tier 1: Speed - Batch operations
const TOOL_batch_add_cells = "batch-add-cells";
server.registerTool(
  TOOL_batch_add_cells,
  {
    description: "[Standalone only] Add multiple raw vertex and edge cells in one call with explicit styles. Use temp_id to reference cells within the batch. For shape-library cells (Azure icons, basic shapes), use batch-add-cells-of-shape instead.",
    inputSchema: {
      cells: z.array(z.object({
        type: z.enum(["vertex", "edge"]).describe("Cell type: 'vertex' for shapes, 'edge' for connections"),
        x: z.number().optional().describe("X position (vertices only)"),
        y: z.number().optional().describe("Y position (vertices only)"),
        width: z.number().optional().describe("Width (vertices only)"),
        height: z.number().optional().describe("Height (vertices only)"),
        text: z.string().optional().describe("Text label"),
        style: z.string().optional().describe("Draw.io style string"),
        source_id: z.string().optional().describe("Source cell ID for edges (can use temp_id from same batch)"),
        target_id: z.string().optional().describe("Target cell ID for edges (can use temp_id from same batch)"),
        temp_id: z.string().optional().describe("Temporary ID to reference this cell within the batch"),
      })).describe("Array of cells to create"),
    },
  },
  createToolHandler(TOOL_batch_add_cells),
);

// Tier 1: Speed - Style presets
const TOOL_get_style_presets = "get-style-presets";
server.registerTool(
  TOOL_get_style_presets,
  {
    description: "[Standalone only] Get style presets (Azure colors, flowchart shapes, edges) for consistent styling.",
  },
  createToolHandler(TOOL_get_style_presets),
);

// Tier 1: Speed - Shape search
const TOOL_search_shapes = "search-shapes";
server.registerTool(
  TOOL_search_shapes,
  {
    description: "[Standalone only] Fuzzy search for shapes (700+ Azure icons). Returns names for use with add-cell-of-shape. Prefer 'queries' for batch lookups.",
    inputSchema: {
      query: z.string().optional().describe("Single search query (e.g., 'virtual machine', 'storage', 'function')"),
      queries: z.array(z.string()).optional().describe("Array of search queries for batch searching. Cannot be used with 'query'."),
      limit: z.number().optional().default(10).describe("Maximum results to return per query"),
    },
  },
  createToolHandler(TOOL_search_shapes),
);

async function start_stdio_transport() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.debug(`Draw.io MCP Server STDIO transport active`);
}

async function start_streamable_http_transport(http_port: number) {
  // Create a stateless transport (no options = no session management)
  const transport = new WebStandardStreamableHTTPServerTransport();

  // Create the Hono app
  const app = new Hono();

  // Enable CORS for all origins
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );

  app.get("/health", (c) =>
    c.json({ status: server.isConnected() ? "ok" : "mcp not ready" }),
  );

  app.all("/mcp", (c) => transport.handleRequest(c.req.raw));

  await server.connect(transport);

  serve({
    fetch: app.fetch,
    port: http_port,
  });
  log.debug(`Draw.io MCP Server Streamable HTTP transport active`);
  log.debug(`Health check: http://localhost:${http_port}/health`);
  log.debug(`MCP endpoint: http://localhost:${http_port}/mcp`);
}

async function main() {
  // Check if help was requested (before parsing config)
  if (shouldShowHelp(process.argv.slice(2))) {
    showHelp();
    // never returns
  }

  // Build configuration from command line args
  const configResult = buildConfig();

  // Handle errors from configuration parsing
  if (configResult instanceof Error) {
    console.error(`Error: ${configResult.message}`);
    process.exit(1);
  }

  const config: ServerConfig = configResult;

  // Set standalone mode flag
  isStandaloneMode = config.standalone;

  // Only start WebSocket server if not in standalone mode
  if (!isStandaloneMode) {
    await start_websocket_server(config.extensionPort);
  } else {
    log.debug(`Draw.io MCP Server running in STANDALONE mode (no browser extension required)`);
  }

  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  if (config.transports.indexOf("http") > -1) {
    start_streamable_http_transport(config.httpPort);
  }

  log.debug(`Draw.io MCP Server running on ${config.transports}`);
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
