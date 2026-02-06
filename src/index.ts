#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { buildConfig, shouldShowHelp, VERSION, type ServerConfig } from "./config.js";
import {
  create_logger as create_console_logger } from "./loggers/mcp_console_logger.js";
import {
  create_logger as create_server_logger,
  validLogLevels,
} from "./loggers/mcp_server_logger.js";
import { standaloneHandlers } from "./standalone_tools.js";

/**
 * Display help message and exit
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION}) - Standalone Mode

Usage: drawio-mcp-server [options]

Options:
  --http-port <number>     HTTP server port for MCP clients (default: 8080)
  --transport <type>       Transport type: stdio, http, or stdio,http (default: stdio)
  --help, -h              Show this help message

Examples:
  drawio-mcp-server                           # Use stdio transport
  drawio-mcp-server --transport http          # Use HTTP transport on port 8080
  drawio-mcp-server --http-port 4000          # Use HTTP on port 4000
  drawio-mcp-server --transport stdio,http    # Use both transports
  `);
  process.exit(0);
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

/**
 * Creates a tool handler that logs session/request metadata and delegates to standaloneHandlers.
 * Works for both tools WITH inputSchema (args + extra) and WITHOUT (extra only).
 */
function createToolHandler(toolName: string, hasArgs: true): (args: any, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => Promise<any>;
function createToolHandler(toolName: string, hasArgs?: false): (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => Promise<any>;
function createToolHandler(toolName: string, hasArgs = false) {
  return async (...params: any[]) => {
    const extra: RequestHandlerExtra<ServerRequest, ServerNotification> = hasArgs ? params[1] : params[0];
    const args = hasArgs ? params[0] : {};
    const sessionId = extra.sessionId ?? "no-session";
    const requestId = extra.requestId;
    log.debug(`[tool:${toolName}] called (session=${sessionId}, req=${requestId})`);

    const handler = standaloneHandlers[toolName as keyof typeof standaloneHandlers];
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

const TOOL_add_rectangle = "add-rectangle";
server.registerTool(
  TOOL_add_rectangle,
  {
    description: "Add a new rectangle vertex cell to the diagram. Prefer batch-add-cells for multiple cells (fewer calls, faster).",
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
  createToolHandler(TOOL_add_rectangle, true),
);

const TOOL_add_edge = "add-edge";
server.registerTool(
  TOOL_add_edge,
  {
    description: "Create an edge (connection/relation) between two vertex cells. Prefer batch-add-cells for multiple edges (fewer calls, faster).",
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
  createToolHandler(TOOL_add_edge, true),
);

const TOOL_delete_cell_by_id = "delete-cell-by-id";
server.registerTool(
  TOOL_delete_cell_by_id,
  {
    description: "Delete a cell (vertex or edge) by its ID.",
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
        ),
    },
  },
  createToolHandler(TOOL_delete_cell_by_id, true),
);

const TOOL_get_shape_categories = "get-shape-categories";
server.registerTool(
  TOOL_get_shape_categories,
  {
    description: "Get available shape categories (General, Flowchart, Azure icons). Use search-shapes for faster fuzzy lookup.",
  },
  createToolHandler(TOOL_get_shape_categories),
);

const TOOL_get_shapes_in_category = "get-shapes-in-category";
server.registerTool(
  TOOL_get_shapes_in_category,
  {
    description: "List all shapes in a category. Returns shape names and styles for use with add-cell-of-shape.",
    inputSchema: {
      category_id: z
        .string()
        .describe(
          "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
        ),
    },
  },
  createToolHandler(TOOL_get_shapes_in_category, true),
);

const TOOL_get_shape_by_name = "get-shape-by-name";
server.registerTool(
  TOOL_get_shape_by_name,
  {
    description: "Get a shape by exact name. For fuzzy matching, use search-shapes instead.",
    inputSchema: {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieve from the shape library of the current diagram.",
        ),
    },
  },
  createToolHandler(TOOL_get_shape_by_name, true),
);

const TOOL_add_cell_of_shape = "add-cell-of-shape";
server.registerTool(
  TOOL_add_cell_of_shape,
  {
    description: "Add a vertex cell using a shape from the library (e.g., Azure icons). Use search-shapes to find shape names. Prefer batch-add-cells when adding multiple shapes.",
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
  createToolHandler(TOOL_add_cell_of_shape, true),
);

const TOOL_batch_add_cells_of_shape = "batch-add-cells-of-shape";
server.registerTool(
  TOOL_batch_add_cells_of_shape,
  {
    description: "Add multiple shape-based cells in one call. Much faster than calling add-cell-of-shape individually. Supports Azure icons and basic shapes.",
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
  createToolHandler(TOOL_batch_add_cells_of_shape, true),
);

const TOOL_set_cell_shape = "set-cell-shape";
server.registerTool(
  TOOL_set_cell_shape,
  {
    description: "Update a cell's visual style to match a library shape. Use search-shapes to find shape names. Prefer the 'cells' array for batch updates. Example: {cells: [{cell_id: 'cell-1', shape_name: 'Virtual Machines'}, {cell_id: 'cell-2', shape_name: 'Storage Accounts'}]}",
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
          "Array of cell-shape pairs for batch operations. Cannot be used with cell_id/shape_name. Example: [{cell_id: 'cell-1', shape_name: 'App Services'}, {cell_id: 'cell-2', shape_name: 'SQL Database'}]",
        ),
    },
  },
  createToolHandler(TOOL_set_cell_shape, true),
);

const TOOL_edit_cell = "edit-cell";
server.registerTool(
  TOOL_edit_cell,
  {
    description: "Update a vertex cell's properties (position, size, text, style). Only specified fields change.",
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
  createToolHandler(TOOL_edit_cell, true),
);

const TOOL_edit_edge = "edit-edge";
server.registerTool(
  TOOL_edit_edge,
  {
    description: "Update an edge's properties (text, source, target, style). Only specified fields change.",
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
  createToolHandler(TOOL_edit_edge, true),
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
    description: "Get a paginated list of all cells with filtering. Use this to inspect diagram structure or find cells by type/attributes.",
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
  createToolHandler(TOOL_list_paged_model, true),
);

const TOOL_list_layers = "list-layers";
server.registerTool(
  TOOL_list_layers,
  {
    description: "List all layers in the diagram with IDs and names.",
  },
  createToolHandler(TOOL_list_layers),
);

const TOOL_set_active_layer = "set-active-layer";
server.registerTool(
  TOOL_set_active_layer,
  {
    description: "Set the active layer for new elements.",
    inputSchema: {
      layer_id: z.string().describe("ID of the layer to set as active"),
    },
  },
  createToolHandler(TOOL_set_active_layer, true),
);

const TOOL_move_cell_to_layer = "move-cell-to-layer";
server.registerTool(
  TOOL_move_cell_to_layer,
  {
    description: "Move a cell to a different layer.",
    inputSchema: {
      cell_id: z.string().describe("ID of the cell to move"),
      target_layer_id: z
        .string()
        .describe("ID of the target layer where the cell will be moved"),
    },
  },
  createToolHandler(TOOL_move_cell_to_layer, true),
);

const TOOL_get_active_layer = "get-active-layer";
server.registerTool(
  TOOL_get_active_layer,
  {
    description: "Get the currently active layer.",
  },
  createToolHandler(TOOL_get_active_layer),
);

const TOOL_create_layer = "create-layer";
server.registerTool(
  TOOL_create_layer,
  {
    description: "Create a new layer in the diagram.",
    inputSchema: {
      name: z.string().describe("Name for the new layer"),
    },
  },
  createToolHandler(TOOL_create_layer, true),
);

// Core tools
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

const TOOL_get_diagram_stats = "get-diagram-stats";
server.registerTool(
  TOOL_get_diagram_stats,
  {
    description: "[Standalone only] Get comprehensive statistics about the current diagram including cell counts, bounds, layer distribution, and more. Useful for understanding diagram state before making changes.",
  },
  createToolHandler(TOOL_get_diagram_stats),
);

// Tier 1: Speed - Batch operations
const TOOL_batch_add_cells = "batch-add-cells";
server.registerTool(
  TOOL_batch_add_cells,
  {
    description: "[Standalone only] Add multiple raw vertex and edge cells in one call with explicit styles. Use temp_id to reference cells within the batch. For shape-library cells (Azure icons, basic shapes), use batch-add-cells-of-shape instead. Example: {cells: [{type:'vertex', x:100, y:100, text:'Web', temp_id:'web'}, {type:'edge', source_id:'web', target_id:'api'}]}",
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
      })).describe("Array of cells to create. Example: [{type:'vertex', x:100, y:100, temp_id:'node1'}, {type:'edge', source_id:'node1', target_id:'node2'}]"),
      dry_run: z.boolean().optional().describe("If true, validates the batch without persisting changes. Use to check for errors before committing."),
    },
  },
  createToolHandler(TOOL_batch_add_cells, true),
);

const TOOL_batch_edit_cells = "batch-edit-cells";
server.registerTool(
  TOOL_batch_edit_cells,
  {
    description: "[Standalone only] Edit multiple vertex cells in one call. Much faster than calling edit-cell repeatedly. Only updates specified properties on each cell.",
    inputSchema: {
      cells: z.array(z.object({
        cell_id: z.string().describe("ID of the cell to update"),
        text: z.string().optional().describe("New text label"),
        x: z.number().optional().describe("New X position"),
        y: z.number().optional().describe("New Y position"),
        width: z.number().optional().describe("New width"),
        height: z.number().optional().describe("New height"),
        style: z.string().optional().describe("New style string"),
      })).describe("Array of cell updates. Example: [{cell_id: 'cell-1', x: 200, y: 150}, {cell_id: 'cell-2', text: 'Updated'}]"),
    },
  },
  createToolHandler(TOOL_batch_edit_cells, true),
);

// Tier 1: Speed - Style presets
const TOOL_get_style_presets = "get-style-presets";
server.registerTool(
  TOOL_get_style_presets,
  {
    description: "Get style presets (Azure colors, flowchart shapes, edges) for consistent styling.",
  },
  createToolHandler(TOOL_get_style_presets),
);

// Tier 1: Speed - Shape search
const TOOL_search_shapes = "search-shapes";
server.registerTool(
  TOOL_search_shapes,
  {
    description: "Fuzzy search for shapes (700+ Azure icons). Returns names for use with add-cell-of-shape. Prefer 'queries' for batch lookups.",
    inputSchema: {
      query: z.string().optional().describe("Single search query (e.g., 'virtual machine', 'storage', 'function')"),
      queries: z.array(z.string()).optional().describe("Array of search queries for batch searching. Cannot be used with 'query'."),
      limit: z.number().min(1).max(50).optional().default(10).describe("Maximum results to return per query (1-50)"),
    },
  },
  createToolHandler(TOOL_search_shapes, true),
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

  log.debug(`Draw.io MCP Server v${VERSION} starting in STANDALONE mode`);
  log.debug(`Transports: ${config.transports.join(", ")}`);

  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  if (config.transports.indexOf("http") > -1) {
    await start_streamable_http_transport(config.httpPort);
  }

  log.debug(`Draw.io MCP Server v${VERSION} is ready`);
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
