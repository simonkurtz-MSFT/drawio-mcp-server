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
  ADD_RECTANGLE: "add-rectangle",
  ADD_EDGE: "add-edge",
  DELETE_CELL_BY_ID: "delete-cell-by-id",
  DELETE_EDGE: "delete-edge",
  GET_SHAPE_CATEGORIES: "get-shape-categories",
  GET_SHAPES_IN_CATEGORY: "get-shapes-in-category",
  GET_SHAPE_BY_NAME: "get-shape-by-name",
  ADD_CELL_OF_SHAPE: "add-cell-of-shape",
  BATCH_ADD_CELLS_OF_SHAPE: "batch-add-cells-of-shape",
  SET_CELL_SHAPE: "set-cell-shape",
  EDIT_CELL: "edit-cell",
  EDIT_EDGE: "edit-edge",
  LIST_PAGED_MODEL: "list-paged-model",
  LIST_LAYERS: "list-layers",
  SET_ACTIVE_LAYER: "set-active-layer",
  MOVE_CELL_TO_LAYER: "move-cell-to-layer",
  GET_ACTIVE_LAYER: "get-active-layer",
  CREATE_LAYER: "create-layer",
  EXPORT_DIAGRAM: "export-diagram",
  CLEAR_DIAGRAM: "clear-diagram",
  CREATE_PAGE: "create-page",
  LIST_PAGES: "list-pages",
  GET_ACTIVE_PAGE: "get-active-page",
  SET_ACTIVE_PAGE: "set-active-page",
  RENAME_PAGE: "rename-page",
  DELETE_PAGE: "delete-page",
  CREATE_GROUP: "create-group",
  ADD_CELL_TO_GROUP: "add-cell-to-group",
  REMOVE_CELL_FROM_GROUP: "remove-cell-from-group",
  LIST_GROUP_CHILDREN: "list-group-children",
  IMPORT_DIAGRAM: "import-diagram",
  GET_DIAGRAM_STATS: "get-diagram-stats",
  BATCH_ADD_CELLS: "batch-add-cells",
  BATCH_EDIT_CELLS: "batch-edit-cells",
  GET_STYLE_PRESETS: "get-style-presets",
  SEARCH_SHAPES: "search-shapes",
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
    TOOL_NAMES.ADD_RECTANGLE,
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
    createToolHandler(TOOL_NAMES.ADD_RECTANGLE, true),
  );

  server.registerTool(
    TOOL_NAMES.ADD_EDGE,
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
    createToolHandler(TOOL_NAMES.ADD_EDGE, true),
  );

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
    TOOL_NAMES.EDIT_CELL,
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
    createToolHandler(TOOL_NAMES.EDIT_CELL, true),
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

  // ─── Batch Operations ──────────────────────────────────────────

  server.registerTool(
    TOOL_NAMES.BATCH_ADD_CELLS,
    {
      description: "Add multiple raw vertex and edge cells in one call with explicit styles. Use temp_id to reference cells within the batch. For shape-library cells (Azure icons, basic shapes), use batch-add-cells-of-shape instead. Example: {cells: [{type:'vertex', x:100, y:100, text:'Web', temp_id:'web'}, {type:'edge', source_id:'web', target_id:'api'}]}",
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
    createToolHandler(TOOL_NAMES.BATCH_ADD_CELLS, true),
  );

  server.registerTool(
    TOOL_NAMES.BATCH_EDIT_CELLS,
    {
      description: "Edit multiple vertex cells in one call. Much faster than calling edit-cell repeatedly. Only updates specified properties on each cell.",
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
    createToolHandler(TOOL_NAMES.BATCH_EDIT_CELLS, true),
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
      description: "List all shapes in a category. Returns shape names and styles for use with add-cell-of-shape.",
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
    TOOL_NAMES.ADD_CELL_OF_SHAPE,
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
    createToolHandler(TOOL_NAMES.ADD_CELL_OF_SHAPE, true),
  );

  server.registerTool(
    TOOL_NAMES.BATCH_ADD_CELLS_OF_SHAPE,
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
    createToolHandler(TOOL_NAMES.BATCH_ADD_CELLS_OF_SHAPE, true),
  );

  server.registerTool(
    TOOL_NAMES.SET_CELL_SHAPE,
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
    createToolHandler(TOOL_NAMES.SET_CELL_SHAPE, true),
  );

  server.registerTool(
    TOOL_NAMES.SEARCH_SHAPES,
    {
      description: "Fuzzy search for shapes (700+ Azure icons). Returns names for use with add-cell-of-shape. Prefer 'queries' for batch lookups.",
      inputSchema: {
        query: z.string().optional().describe("Single search query (e.g., 'virtual machine', 'storage', 'function')"),
        queries: z.array(z.string()).optional().describe("Array of search queries for batch searching. Cannot be used with 'query'."),
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
    TOOL_NAMES.CREATE_GROUP,
    {
      description: "Create a group/container cell that can hold child cells. Used for visual grouping (e.g., VNet containing subnets, resource groups). Children are positioned relative to the group.",
      inputSchema: {
        x: z.number().optional().describe("X-axis position of the group").default(0),
        y: z.number().optional().describe("Y-axis position of the group").default(0),
        width: z.number().optional().describe("Width of the group container").default(400),
        height: z.number().optional().describe("Height of the group container").default(300),
        text: z.string().optional().describe("Label text for the group").default(""),
        style: z.string().optional().describe("Draw.io style string for the group container"),
      },
    },
    createToolHandler(TOOL_NAMES.CREATE_GROUP, true),
  );

  server.registerTool(
    TOOL_NAMES.ADD_CELL_TO_GROUP,
    {
      description: "Add an existing cell into a group/container. The cell becomes a child of the group and is positioned relative to it.",
      inputSchema: {
        cell_id: z.string().describe("ID of the cell to add to the group"),
        group_id: z.string().describe("ID of the group/container cell"),
      },
    },
    createToolHandler(TOOL_NAMES.ADD_CELL_TO_GROUP, true),
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
      description: "Export the diagram as Draw.io XML with diagram statistics. Save output to a .drawio file.",
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
