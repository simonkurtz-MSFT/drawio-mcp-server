/**
 * MCP tool registrations — Zod schemas, descriptions, and server.registerTool() calls.
 *
 * Extracted from index.ts so the registration logic is testable and the
 * entry point stays focused on server lifecycle (startup, shutdown, transport).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { createToolHandlerFactory } from "./tool_handler.js";

// ─── Tool Name Constants ───────────────────────────────────────

export const TOOL_NAMES = {
  ADD_CELLS: "add-cells",
  ADD_CELLS_OF_SHAPE: "add-cells-of-shape",
  ADD_CELLS_TO_GROUP: "add-cells-to-group",
  CLEAR_DIAGRAM: "clear-diagram",
  CREATE_GROUPS: "create-groups",
  CREATE_LAYER: "create-layer",
  CREATE_PAGE: "create-page",
  DELETE_CELL_BY_ID: "delete-cell-by-id",
  DELETE_EDGE: "delete-edge",
  DELETE_PAGE: "delete-page",
  EDIT_CELLS: "edit-cells",
  EDIT_EDGE: "edit-edge",
  EXPORT_DIAGRAM: "export-diagram",
  GET_ACTIVE_LAYER: "get-active-layer",
  GET_ACTIVE_PAGE: "get-active-page",
  GET_DIAGRAM_STATS: "get-diagram-stats",
  GET_SHAPE_BY_NAME: "get-shape-by-name",
  GET_SHAPE_CATEGORIES: "get-shape-categories",
  GET_SHAPES_IN_CATEGORY: "get-shapes-in-category",
  GET_STYLE_PRESETS: "get-style-presets",
  IMPORT_DIAGRAM: "import-diagram",
  LIST_GROUP_CHILDREN: "list-group-children",
  LIST_LAYERS: "list-layers",
  LIST_PAGED_MODEL: "list-paged-model",
  LIST_PAGES: "list-pages",
  MOVE_CELL_TO_LAYER: "move-cell-to-layer",
  REMOVE_CELL_FROM_GROUP: "remove-cell-from-group",
  RENAME_PAGE: "rename-page",
  SEARCH_SHAPES: "search-shapes",
  SET_ACTIVE_LAYER: "set-active-layer",
  SET_ACTIVE_PAGE: "set-active-page",
  SET_CELL_SHAPE: "set-cell-shape",
} as const;

/** The handler factory function type returned by createToolHandlerFactory */
type CreateToolHandler = ReturnType<typeof createToolHandlerFactory>;

/**
 * Register all MCP tools on the given server.
 *
 * Pure registration — no side effects beyond calling server.registerTool().
 */
export function registerTools(server: McpServer, createToolHandler: CreateToolHandler): void {

  // ─── Cell Tools ────────────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.DELETE_CELL_BY_ID,
    {
      description: "Delete a cell (vertex or edge) by its ID. When a vertex is deleted, all connected edges are automatically cascade-deleted and reported in the response.",
      inputSchema: {
        cell_id: z
          .string()
          .describe(
            "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
          ),
      },
    },
    createToolHandler(TOOL_NAMES.DELETE_CELL_BY_ID, true),
  );

  server.registerTool(
    TOOL_NAMES.DELETE_EDGE,
    {
      description: "Delete an edge by its ID. Validates that the target cell is an edge. Use delete-cell-by-id to delete vertices (which also cascade-deletes connected edges).",
      inputSchema: {
        cell_id: z
          .string()
          .describe(
            "The ID of the edge to delete.",
          ),
      },
    },
    createToolHandler(TOOL_NAMES.DELETE_EDGE, true),
  );

  server.registerTool(
    TOOL_NAMES.EDIT_EDGE,
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
    createToolHandler(TOOL_NAMES.EDIT_EDGE, true),
  );

  // ─── Add / Edit Cells ─────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.ADD_CELLS,
    {
      description: "Add vertices and/or edges to the diagram. Always pass ALL cells you need in a single call — never call this tool repeatedly. Use temp_id to reference cells within the same batch (e.g., an edge referencing a vertex created in the same call). For shape-library cells (Azure icons, basic shapes), use add-cells-of-shape instead.",
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
        })).describe("Array of cells to create. Gather ALL cells you need and submit them in ONE call. Example: [{type:'vertex', x:100, y:100, temp_id:'node1'}, {type:'edge', source_id:'node1', target_id:'node2'}]"),
        dry_run: z.boolean().optional().describe("If true, validates the batch without persisting changes. Use to check for errors before committing."),
      },
    },
    createToolHandler(TOOL_NAMES.ADD_CELLS, true),
  );

  server.registerTool(
    TOOL_NAMES.EDIT_CELLS,
    {
      description: "Edit one or more vertex cells. Always pass ALL updates in a single call — never call this tool repeatedly. Only updates specified properties on each cell.",
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
    createToolHandler(TOOL_NAMES.EDIT_CELLS, true),
  );

  // ─── Shape Tools ───────────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.GET_SHAPE_CATEGORIES,
    {
      description: "Get available shape categories (General, Flowchart, Azure icons). Use search-shapes for faster fuzzy lookup.",
    },
    createToolHandler(TOOL_NAMES.GET_SHAPE_CATEGORIES),
  );

  server.registerTool(
    TOOL_NAMES.GET_SHAPES_IN_CATEGORY,
    {
      description: "List all shapes in a category. Returns shape names and styles for use with add-cells-of-shape.",
      inputSchema: {
        category_id: z
          .string()
          .describe(
            "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
          ),
      },
    },
    createToolHandler(TOOL_NAMES.GET_SHAPES_IN_CATEGORY, true),
  );

  server.registerTool(
    TOOL_NAMES.GET_SHAPE_BY_NAME,
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
    createToolHandler(TOOL_NAMES.GET_SHAPE_BY_NAME, true),
  );

  server.registerTool(
    TOOL_NAMES.ADD_CELLS_OF_SHAPE,
    {
      description: "Add one or more shape-based cells (Azure icons, basic shapes) to the diagram. Always pass ALL shapes in a single call — never call this tool repeatedly. Use search-shapes first to discover shape names.",
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
        })).describe("Array of shape cells to create. Gather ALL shapes and submit ONE call."),
      },
    },
    createToolHandler(TOOL_NAMES.ADD_CELLS_OF_SHAPE, true),
  );

  server.registerTool(
    TOOL_NAMES.SET_CELL_SHAPE,
    {
      description: "Update one or more cells' visual styles to match library shapes. Always pass ALL updates in a single call. Use search-shapes to find shape names first.",
      inputSchema: {
        cells: z
          .array(
            z.object({
              cell_id: z.string().describe("Cell ID to update"),
              shape_name: z.string().describe("Shape name to apply"),
            }),
          )
          .describe(
            "Array of cell-shape pairs. Example: [{cell_id: 'cell-1', shape_name: 'App Services'}, {cell_id: 'cell-2', shape_name: 'SQL Database'}]",
          ),
      },
    },
    createToolHandler(TOOL_NAMES.SET_CELL_SHAPE, true),
  );

  server.registerTool(
    TOOL_NAMES.SEARCH_SHAPES,
    {
      description: "Fuzzy search for shapes across 700+ Azure icons and basic shapes. Returns names for use with add-cells-of-shape. Call this tool exactly ONCE with ALL shape names in the queries array — never call it multiple times.",
      inputSchema: {
        queries: z.array(z.string()).describe("Array of ALL search terms. Gather every shape name you need and pass them all here. Example: ['front door', 'container apps', 'app service', 'key vault', 'dns zone', 'nsg', 'log analytics']"),
        limit: z.number().min(1).max(50).optional().default(10).describe("Maximum results to return per query (1-50)"),
      },
    },
    createToolHandler(TOOL_NAMES.SEARCH_SHAPES, true),
  );

  server.registerTool(
    TOOL_NAMES.GET_STYLE_PRESETS,
    {
      description: "Get style presets (Azure colors, flowchart shapes, edges) for consistent styling.",
    },
    createToolHandler(TOOL_NAMES.GET_STYLE_PRESETS),
  );

  // ─── Model / Query Tools ───────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.LIST_PAGED_MODEL,
    {
      description: "Get a paginated list of cells on the active page. Returns active page and layer context alongside results. Use this to inspect diagram structure or find cells by type.",
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
              .enum(["edge", "vertex"])
              .optional()
              .describe(
                "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes",
              ),
          })
          .optional()
          .describe("Optional filter criteria to apply to cells before pagination")
          .default({}),
      },
    },
    createToolHandler(TOOL_NAMES.LIST_PAGED_MODEL, true),
  );

  server.registerTool(
    TOOL_NAMES.GET_DIAGRAM_STATS,
    {
      description: "Get comprehensive statistics about the current diagram including cell counts, bounds, layer distribution, and more. Useful for understanding diagram state before making changes.",
    },
    createToolHandler(TOOL_NAMES.GET_DIAGRAM_STATS),
  );

  // ─── Layer Tools ───────────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.LIST_LAYERS,
    {
      description: "List all layers on the active page with IDs, names, and which layer is currently active.",
    },
    createToolHandler(TOOL_NAMES.LIST_LAYERS),
  );

  server.registerTool(
    TOOL_NAMES.GET_ACTIVE_LAYER,
    {
      description: "Get the currently active layer.",
    },
    createToolHandler(TOOL_NAMES.GET_ACTIVE_LAYER),
  );

  server.registerTool(
    TOOL_NAMES.SET_ACTIVE_LAYER,
    {
      description: "Set the active layer for new elements.",
      inputSchema: {
        layer_id: z.string().describe("ID of the layer to set as active"),
      },
    },
    createToolHandler(TOOL_NAMES.SET_ACTIVE_LAYER, true),
  );

  server.registerTool(
    TOOL_NAMES.CREATE_LAYER,
    {
      description: "Create a new layer on the active page. Layers organize cells into separate visual planes that can be shown or hidden.",
      inputSchema: {
        name: z.string().describe("Name for the new layer"),
      },
    },
    createToolHandler(TOOL_NAMES.CREATE_LAYER, true),
  );

  server.registerTool(
    TOOL_NAMES.MOVE_CELL_TO_LAYER,
    {
      description: "Move a cell to a different layer. Updates the cell's parent reference and returns the updated cell.",
      inputSchema: {
        cell_id: z.string().describe("ID of the cell to move"),
        target_layer_id: z
          .string()
          .describe("ID of the target layer where the cell will be moved"),
      },
    },
    createToolHandler(TOOL_NAMES.MOVE_CELL_TO_LAYER, true),
  );

  // ─── Page Tools ────────────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.CREATE_PAGE,
    {
      description: "Create a new page (tab) in the diagram. Each page has its own cells, layers, and canvas. Does not switch the active page.",
      inputSchema: {
        name: z.string().describe("Name for the new page"),
      },
    },
    createToolHandler(TOOL_NAMES.CREATE_PAGE, true),
  );

  server.registerTool(
    TOOL_NAMES.LIST_PAGES,
    {
      description: "List all pages in the diagram with IDs and names.",
    },
    createToolHandler(TOOL_NAMES.LIST_PAGES),
  );

  server.registerTool(
    TOOL_NAMES.GET_ACTIVE_PAGE,
    {
      description: "Get the currently active page.",
    },
    createToolHandler(TOOL_NAMES.GET_ACTIVE_PAGE),
  );

  server.registerTool(
    TOOL_NAMES.SET_ACTIVE_PAGE,
    {
      description: "Switch to a different page. All subsequent cell and layer operations apply to the active page. Returns the page's cell and layer counts.",
      inputSchema: {
        page_id: z.string().describe("ID of the page to switch to"),
      },
    },
    createToolHandler(TOOL_NAMES.SET_ACTIVE_PAGE, true),
  );

  server.registerTool(
    TOOL_NAMES.RENAME_PAGE,
    {
      description: "Rename an existing page.",
      inputSchema: {
        page_id: z.string().describe("ID of the page to rename"),
        name: z.string().describe("New name for the page"),
      },
    },
    createToolHandler(TOOL_NAMES.RENAME_PAGE, true),
  );

  server.registerTool(
    TOOL_NAMES.DELETE_PAGE,
    {
      description: "Delete a page and all its cells, layers, and groups. Cannot delete the last remaining page.",
      inputSchema: {
        page_id: z.string().describe("ID of the page to delete"),
      },
    },
    createToolHandler(TOOL_NAMES.DELETE_PAGE, true),
  );

  // ─── Group / Container Tools ───────────────────────────────────

  server.registerTool(
    TOOL_NAMES.CREATE_GROUPS,
    {
      description: "Create one or more group/container cells. Always pass ALL groups in a single call — never call this tool repeatedly. Each group gets a unique ID for use with add-cells-to-group. Children are positioned relative to the group.",
      inputSchema: {
        groups: z.array(z.object({
          x: z.number().optional().describe("X-axis position of the group").default(0),
          y: z.number().optional().describe("Y-axis position of the group").default(0),
          width: z.number().optional().describe("Width of the group container").default(400),
          height: z.number().optional().describe("Height of the group container").default(300),
          text: z.string().optional().describe("Label text for the group").default(""),
          style: z.string().optional().describe("Draw.io style string for the group container"),
          temp_id: z.string().optional().describe("Temporary ID for referencing this group later (e.g., in add-cells-to-group)"),
        })).describe("Array of groups to create. Example: [{text: 'VNet', width: 600, height: 400, temp_id: 'vnet'}, {text: 'Subnet', width: 300, height: 200, temp_id: 'subnet'}]"),
      },
    },
    createToolHandler(TOOL_NAMES.CREATE_GROUPS, true),
  );

  server.registerTool(
    TOOL_NAMES.ADD_CELLS_TO_GROUP,
    {
      description: "Assign one or more cells to groups. Always pass ALL assignments in a single call — never call this tool repeatedly. Supports assigning cells to different groups in a single call.",
      inputSchema: {
        assignments: z.array(z.object({
          cell_id: z.string().describe("ID of the cell to add to a group"),
          group_id: z.string().describe("ID of the group/container cell"),
        })).describe("Array of cell-to-group assignments. Example: [{cell_id: 'cell-5', group_id: 'cell-2'}, {cell_id: 'cell-6', group_id: 'cell-3'}]"),
      },
    },
    createToolHandler(TOOL_NAMES.ADD_CELLS_TO_GROUP, true),
  );

  server.registerTool(
    TOOL_NAMES.REMOVE_CELL_FROM_GROUP,
    {
      description: "Remove a cell from its group, returning it to the active layer.",
      inputSchema: {
        cell_id: z.string().describe("ID of the cell to remove from its group"),
      },
    },
    createToolHandler(TOOL_NAMES.REMOVE_CELL_FROM_GROUP, true),
  );

  server.registerTool(
    TOOL_NAMES.LIST_GROUP_CHILDREN,
    {
      description: "List all cells that are children of a group/container.",
      inputSchema: {
        group_id: z.string().describe("ID of the group/container cell"),
      },
    },
    createToolHandler(TOOL_NAMES.LIST_GROUP_CHILDREN, true),
  );

  // ─── Import / Export Tools ─────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.IMPORT_DIAGRAM,
    {
      description: "Import a Draw.io XML string, replacing the current diagram. Supports single-page and multi-page documents. Use this to load and modify existing .drawio files.",
      inputSchema: {
        xml: z.string().describe("The Draw.io XML string to import"),
      },
    },
    createToolHandler(TOOL_NAMES.IMPORT_DIAGRAM, true),
  );

  server.registerTool(
    TOOL_NAMES.EXPORT_DIAGRAM,
    {
      description: "Export the diagram as Draw.io XML with diagram statistics. The XML is in the response payload's `xml` property. Save the output to a .drawio file.",
    },
    createToolHandler(TOOL_NAMES.EXPORT_DIAGRAM),
  );

  server.registerTool(
    TOOL_NAMES.CLEAR_DIAGRAM,
    {
      description: "Clear all cells, layers, and pages, resetting the diagram to a single empty page.",
    },
    createToolHandler(TOOL_NAMES.CLEAR_DIAGRAM),
  );
}
