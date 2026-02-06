/**
 * Tool handlers that generate Draw.io XML directly
 * without requiring the browser extension.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { diagram, StructuredError } from "./diagram_model.js";
import {
  getAzureCategories,
  getShapesInCategory,
  getAzureShapeByName,
  searchAzureIcons,
} from "./shapes/azure_icon_library.js";
import { BASIC_SHAPES, BASIC_SHAPE_CATEGORIES, getBasicShape } from "./shapes/basic_shapes.js";

/**
 * Resolved shape with unified dimensions and style, regardless of source (basic or Azure).
 */
interface ResolvedShape {
  name: string;
  style: string;
  width: number;
  height: number;
  source: "basic" | "azure-exact" | "azure-fuzzy";
  score?: number;
}

/**
 * Resolve a shape name to its definition by checking:
 * 1. Basic shapes (exact match, case-insensitive)
 * 2. Azure icon library (exact match by title/ID)
 * 3. Azure icon library (fuzzy search, top result)
 *
 * Returns undefined if no match is found.
 */
function resolveShape(shapeName: string): ResolvedShape | undefined {
  // 1. Basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
  const basic = getBasicShape(shapeName);
  if (basic) {
    return {
      name: basic.name,
      style: basic.style,
      width: basic.defaultWidth,
      height: basic.defaultHeight,
      source: "basic",
    };
  }

  // 2. Azure exact match by title or ID
  const azureExact = getAzureShapeByName(shapeName);
  if (azureExact) {
    return {
      name: azureExact.title,
      style: azureExact.style ?? "",
      width: azureExact.width,
      height: azureExact.height,
      source: "azure-exact",
    };
  }

  // 3. Azure fuzzy search as last resort
  const searchResults = searchAzureIcons(shapeName, 1);
  if (searchResults.length > 0) {
    const shape = searchResults[0];
    return {
      name: shape.title,
      style: shape.style ?? "",
      width: shape.width,
      height: shape.height,
      source: "azure-fuzzy",
      score: shape.score,
    };
  }

  return undefined;
}

function successResult(data: any): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
  };
}

function errorResult(error: StructuredError): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error }) }],
    isError: true,
  };
}

export const handlers = {
  "add-rectangle": async (args: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const cell = diagram.addRectangle(args);
    return successResult({ cell });
  },

  "add-edge": async (args: {
    source_id: string;
    target_id: string;
    text?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const result = diagram.addEdge({
      sourceId: args.source_id,
      targetId: args.target_id,
      text: args.text,
      style: args.style,
    });
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "delete-cell-by-id": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const { deleted, cascadedEdgeIds } = diagram.deleteCell(args.cell_id);
    if (!deleted) {
      return errorResult({
        code: "CELL_NOT_FOUND",
        message: `Cell '${args.cell_id}' not found`,
        cell_id: args.cell_id,
        suggestion: "Use list-paged-model to see available cells",
      });
    }
    return successResult({
      deleted: args.cell_id,
      ...(cascadedEdgeIds.length > 0 && { cascaded_edges: cascadedEdgeIds }),
    });
  },

  "edit-cell": async (args: {
    cell_id: string;
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: string;
  }): Promise<CallToolResult> => {
    const result = diagram.editCell(args.cell_id, {
      text: args.text,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      style: args.style,
    });
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "edit-edge": async (args: {
    cell_id: string;
    text?: string;
    source_id?: string;
    target_id?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const result = diagram.editEdge(args.cell_id, {
      text: args.text,
      sourceId: args.source_id,
      targetId: args.target_id,
      style: args.style,
    });
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "list-paged-model": async (args: {
    page?: number;
    page_size?: number;
    filter?: { cell_type?: string };
  }): Promise<CallToolResult> => {
    const page = args.page ?? 0;
    const pageSize = args.page_size ?? 50;

    let cells = diagram.listCells();

    // Apply filter
    if (args.filter?.cell_type === "vertex") {
      cells = cells.filter(c => c.type === "vertex");
    } else if (args.filter?.cell_type === "edge") {
      cells = cells.filter(c => c.type === "edge");
    }

    // Paginate
    const start = page * pageSize;
    const pagedCells = cells.slice(start, start + pageSize);

    return successResult({
      page,
      pageSize,
      totalCells: cells.length,
      totalPages: Math.ceil(cells.length / pageSize),
      cells: pagedCells,
    });
  },

  "list-layers": async (): Promise<CallToolResult> => {
    return successResult({ layers: diagram.listLayers() });
  },

  "get-active-layer": async (): Promise<CallToolResult> => {
    return successResult({ layer: diagram.getActiveLayer() });
  },

  "set-active-layer": async (args: {
    layer_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.setActiveLayer(args.layer_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ success: true, layer: result });
  },

  "create-layer": async (args: { name: string }): Promise<CallToolResult> => {
    const layer = diagram.createLayer(args.name);
    return successResult({ success: true, layer });
  },

  "move-cell-to-layer": async (args: {
    cell_id: string;
    target_layer_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.moveCellToLayer(args.cell_id, args.target_layer_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ success: true, cell: result });
  },

  "export-diagram": async (): Promise<CallToolResult> => {
    const xml = diagram.toXml();
    const stats = diagram.getStats();
    return successResult({ xml, stats });
  },

  "get-diagram-stats": async (): Promise<CallToolResult> => {
    const stats = diagram.getStats();
    return successResult({ stats });
  },

  "clear-diagram": async (): Promise<CallToolResult> => {
    const cleared = diagram.clear();
    return successResult({ message: "Diagram cleared", cleared });
  },

  // ─── Multi-Page Handlers ────────────────────────────────────────

  "create-page": async (args: { name: string }): Promise<CallToolResult> => {
    const page = diagram.createPage(args.name);
    return successResult({ page });
  },

  "list-pages": async (): Promise<CallToolResult> => {
    return successResult({
      pages: diagram.listPages(),
      active_page: diagram.getActivePage(),
    });
  },

  "get-active-page": async (): Promise<CallToolResult> => {
    return successResult({ page: diagram.getActivePage() });
  },

  "set-active-page": async (args: { page_id: string }): Promise<CallToolResult> => {
    const result = diagram.setActivePage(args.page_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ page: result });
  },

  "rename-page": async (args: { page_id: string; name: string }): Promise<CallToolResult> => {
    const result = diagram.renamePage(args.page_id, args.name);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ page: result });
  },

  "delete-page": async (args: { page_id: string }): Promise<CallToolResult> => {
    const result = diagram.deletePage(args.page_id);
    if (!result.deleted) {
      return errorResult(result.error!);
    }
    return successResult({ deleted: true, remaining_pages: diagram.listPages() });
  },

  // ─── Group / Container Handlers ─────────────────────────────────

  "create-group": async (args: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const cell = diagram.createGroup(args);
    return successResult({ cell });
  },

  "add-cell-to-group": async (args: {
    cell_id: string;
    group_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.addCellToGroup(args.cell_id, args.group_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "remove-cell-from-group": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.removeCellFromGroup(args.cell_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "list-group-children": async (args: {
    group_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.listGroupChildren(args.group_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ children: result, total: result.length });
  },

  // ─── Import Handler ─────────────────────────────────────────────

  "import-diagram": async (args: {
    xml: string;
  }): Promise<CallToolResult> => {
    const result = diagram.importXml(args.xml);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({
      message: `Imported ${result.pages} page(s) with ${result.cells} cell(s) and ${result.layers} layer(s)`,
      ...result,
    });
  },

  "get-shape-categories": async (): Promise<CallToolResult> => {
    const basicCategories = [
      { id: "general", name: "General" },
      { id: "flowchart", name: "Flowchart" },
    ];
    const azureCategories = getAzureCategories().map((cat) => ({
      id: cat.toLowerCase().replace(/\s+/g, "-"),
      name: cat,
    }));

    return successResult({
      categories: [...basicCategories, ...azureCategories],
      info: "Includes basic shapes and 700+ Azure architecture icons from dwarfered/azure-architecture-icons-for-drawio.",
    });
  },

  "get-shapes-in-category": async (args: {
    category_id: string;
  }): Promise<CallToolResult> => {
    const categoryId = args.category_id.toLowerCase();

    // Check basic shape categories first
    const basicShapeNames = BASIC_SHAPE_CATEGORIES[categoryId];
    if (basicShapeNames) {
      const shapes = basicShapeNames
        .map((name) => BASIC_SHAPES[name])
        .filter(Boolean)
        .map((s) => ({ name: s.name, style: s.style, width: s.defaultWidth, height: s.defaultHeight }));
      return successResult({ category: categoryId, shapes, total: shapes.length });
    }

    // Check Azure categories
    const azureCategories = getAzureCategories();
    const matchingCategory = azureCategories.find(
      (cat) => cat.toLowerCase().replace(/\s+/g, "-") === categoryId
    );

    if (matchingCategory) {
      const shapes = getShapesInCategory(matchingCategory);
      return successResult({
        category: categoryId,
        shapes: shapes.map((shape) => ({
          name: shape.title,
          id: shape.id,
          width: shape.width,
          height: shape.height,
        })),
        total: shapes.length,
      });
    }

    return errorResult({
      code: "CATEGORY_NOT_FOUND",
      message: `Category '${args.category_id}' not found`,
      suggestion: "Use get-shape-categories to list available categories",
    });
  },

  "get-shape-by-name": async (args: {
    shape_name: string;
  }): Promise<CallToolResult> => {
    const resolved = resolveShape(args.shape_name);
    if (resolved) {
      return successResult({
        shape: {
          name: resolved.name,
          style: resolved.style,
          width: resolved.width,
          height: resolved.height,
          source: resolved.source,
          ...(resolved.score !== undefined && { confidence: resolved.score }),
        },
      });
    }
    return errorResult({
      code: "SHAPE_NOT_FOUND",
      message: `Shape '${args.shape_name}' not found`,
      suggestion: "Use search-shapes to find available shapes",
    });
  },

  "add-cell-of-shape": async (args: {
    shape_name: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const resolved = resolveShape(args.shape_name);
    if (!resolved) {
      return errorResult({
        code: "SHAPE_NOT_FOUND",
        message: `Unknown shape '${args.shape_name}'`,
        suggestion: "Use search-shapes to find available shapes, or try basic names like 'rectangle', 'ellipse', 'decision'",
      });
    }

    const cell = diagram.addRectangle({
      x: args.x,
      y: args.y,
      width: args.width ?? resolved.width,
      height: args.height ?? resolved.height,
      text: args.text ?? (resolved.source !== "basic" ? resolved.name : undefined),
      style: args.style ?? resolved.style,
    });

    const info = resolved.source === "azure-fuzzy"
      ? `Added Azure icon (matched from search): ${resolved.name}`
      : resolved.source === "azure-exact"
        ? `Added Azure icon: ${resolved.name}`
        : undefined;

    return successResult({
      success: true,
      cell,
      ...(info && { info }),
      ...(resolved.score !== undefined && { confidence: resolved.score }),
    });
  },

  "batch-add-cells-of-shape": async (args: {
    cells: Array<{
      shape_name: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      temp_id?: string;
    }>;
  }): Promise<CallToolResult> => {
    if (!args.cells || args.cells.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'cells' array",
      });
    }

    const results = args.cells.map((item) => {
      const resolved = resolveShape(item.shape_name);
      if (!resolved) {
        return {
          success: false,
          temp_id: item.temp_id,
          shape_name: item.shape_name,
          error: {
            code: "SHAPE_NOT_FOUND",
            message: `Unknown shape '${item.shape_name}'`,
            suggestion: "Use search-shapes to find available shapes",
          },
        };
      }

      const cell = diagram.addRectangle({
        x: item.x,
        y: item.y,
        width: item.width ?? resolved.width,
        height: item.height ?? resolved.height,
        text: item.text ?? (resolved.source !== "basic" ? resolved.name : undefined),
        style: item.style ?? resolved.style,
      });

      return {
        success: true,
        cell,
        temp_id: item.temp_id,
        ...(resolved.source === "azure-exact" && { info: `Added Azure icon: ${resolved.name}` }),
        ...(resolved.source === "azure-fuzzy" && {
          info: `Added Azure icon (matched from search): ${resolved.name}`,
          confidence: resolved.score,
        }),
      };
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return successResult({
      success: errorCount === 0,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: errorCount,
      },
      results,
    });
  },

  "set-cell-shape": async (args: {
    cell_id?: string;
    shape_name?: string;
    cells?: Array<{ cell_id: string; shape_name: string }>;
  }): Promise<CallToolResult> => {
    // Validate input: must have either cell_id/shape_name or cells, but not both
    const hasSingleParams = args.cell_id && args.shape_name;
    const hasBatchParams = args.cells && args.cells.length > 0;

    if (!hasSingleParams && !hasBatchParams) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide either 'cell_id' and 'shape_name' OR 'cells' array",
      });
    }
    if (hasSingleParams && hasBatchParams) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Cannot provide both single parameters (cell_id/shape_name) and batch parameter (cells)",
      });
    }

    // Helper function to get style for a shape name
    const getShapeStyle = (shapeName: string): string | null => {
      const resolved = resolveShape(shapeName);
      return resolved ? resolved.style : null;
    };

    // Handle single operation (backward compatible)
    if (hasSingleParams) {
      const style = getShapeStyle(args.shape_name!);
      if (!style) {
        return errorResult({
          code: "SHAPE_NOT_FOUND",
          message: `Unknown shape '${args.shape_name}'`,
          suggestion: "Use search-shapes to find available shapes",
        });
      }

      const result = diagram.editCell(args.cell_id!, { style });
      if ("error" in result) {
        return errorResult(result.error);
      }
      return successResult({
        success: true,
        cell: result,
      });
    }

    // hasBatchParams is guaranteed true here by the guards above
    const results = args.cells!.map((item) => {
        const style = getShapeStyle(item.shape_name);
        if (!style) {
          return {
            success: false,
            cell_id: item.cell_id,
            shape_name: item.shape_name,
            error: {
              code: "SHAPE_NOT_FOUND",
              message: `Unknown shape '${item.shape_name}'`,
              suggestion: "Use search-shapes to find available shapes",
            },
          };
        }

        const result = diagram.editCell(item.cell_id, { style });
        if ("error" in result) {
          return {
            success: false,
            cell_id: item.cell_id,
            shape_name: item.shape_name,
            error: result.error,
          };
        }

        return {
          success: true,
          cell_id: item.cell_id,
          shape_name: item.shape_name,
          cell: result,
        };
      });

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.filter((r) => !r.success).length;

      return successResult({
        batch: true,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: errorCount,
        },
        results,
      });
  },

  "batch-add-cells": async (args: {
    cells: Array<{
      type: "vertex" | "edge";
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      source_id?: string;
      target_id?: string;
      temp_id?: string;
    }>;
    dry_run?: boolean;
  }): Promise<CallToolResult> => {
    const items = args.cells.map(c => ({
      type: c.type,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      text: c.text,
      style: c.style,
      sourceId: c.source_id,
      targetId: c.target_id,
      tempId: c.temp_id,
    }));
    const results = diagram.batchAddCells(items, { dryRun: args.dry_run });
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    return successResult({
      summary: { total: results.length, succeeded: successCount, failed: errorCount },
      results,
      dry_run: args.dry_run ?? false,
    });
  },

  "batch-edit-cells": async (args: {
    cells: Array<{
      cell_id: string;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      style?: string;
    }>;
  }): Promise<CallToolResult> => {
    const results = diagram.batchEditCells(args.cells);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    return successResult({
      summary: { total: results.length, succeeded: successCount, failed: errorCount },
      results,
    });
  },

  "get-style-presets": async (): Promise<CallToolResult> => {
    const presets = {
      azure: {
        primary: "fillColor=#0078D4;strokeColor=#0078D4;fontColor=#ffffff;",
        secondary: "fillColor=#50E6FF;strokeColor=#0078D4;fontColor=#000000;",
        container: "fillColor=#E6F2FA;strokeColor=#0078D4;rounded=1;dashed=1;",
      },
      flowchart: {
        process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
        start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
        end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
        data: "shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;",
      },
      general: {
        blue: "fillColor=#dae8fc;strokeColor=#6c8ebf;",
        green: "fillColor=#d5e8d4;strokeColor=#82b366;",
        orange: "fillColor=#ffe6cc;strokeColor=#d79b00;",
        red: "fillColor=#f8cecc;strokeColor=#b85450;",
        purple: "fillColor=#e1d5e7;strokeColor=#9673a6;",
        yellow: "fillColor=#fff2cc;strokeColor=#d6b656;",
        gray: "fillColor=#f5f5f5;strokeColor=#666666;",
      },
      edges: {
        solid: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;",
        dashed: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;",
        curved: "edgeStyle=entityRelationEdgeStyle;rounded=1;html=1;",
        arrow: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;",
      },
    };
    return successResult({ presets });
  },

  "search-shapes": async (args: {
    query?: string;
    queries?: string[];
    limit?: number;
  }): Promise<CallToolResult> => {
    const limit = args.limit ?? 10;

    // Validate input: must have either query or queries, but not both
    if (!args.query && !args.queries) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide either 'query' (string) or 'queries' (array of strings)",
      });
    }
    if (args.query && args.queries) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Cannot provide both 'query' and 'queries'. Use one or the other.",
      });
    }

    // Handle single query (backward compatible)
    if (args.query) {
      const results = searchAzureIcons(args.query, limit);
      return successResult({
        query: args.query,
        matches: results.map(r => ({
          name: r.title,
          id: r.id,
          category: r.category,
          width: r.width,
          height: r.height,
          confidence: r.score,
        })),
        total: results.length,
      });
    }

    // args.queries is guaranteed truthy here by the guards above
    const batchResults = args.queries!.map(q => {
      const results = searchAzureIcons(q, limit);
      return {
        query: q,
        matches: results.map(r => ({
          name: r.title,
          id: r.id,
          category: r.category,
          width: r.width,
          height: r.height,
          confidence: r.score,
        })),
        total: results.length,
      };
    });

    return successResult({
      batch: true,
      results: batchResults,
      totalQueries: args.queries!.length,
    });
  },
};
