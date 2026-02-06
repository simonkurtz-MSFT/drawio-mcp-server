/**
 * Standalone tool handlers that generate Draw.io XML directly
 * without requiring the browser extension.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { diagram, StructuredError } from "./diagram_model.js";
import {
  getAzureCategories,
  getShapesInCategory,
  getAzureShapeByName,
  searchAzureIcons,
} from "./azure_icon_library.js";
import { BASIC_SHAPES, BASIC_SHAPE_CATEGORIES, getBasicShape } from "./basic_shapes.js";

function successResult(data: any): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
  };
}

function errorResult(error: StructuredError | string): CallToolResult {
  const errorObj = typeof error === "string" ? { code: "UNKNOWN_ERROR", message: error } : error;
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error: errorObj }) }],
    isError: true,
  };
}

export const standaloneHandlers = {
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
    const deleted = diagram.deleteCell(args.cell_id);
    if (!deleted) {
      return errorResult({
        code: "CELL_NOT_FOUND",
        message: `Cell '${args.cell_id}' not found`,
        cell_id: args.cell_id,
        suggestion: "Use list-paged-model to see available cells",
      });
    }
    return successResult({ deleted: args.cell_id });
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
    return successResult({ xml });
  },

  "get-diagram-stats": async (): Promise<CallToolResult> => {
    const stats = diagram.getStats();
    return successResult({ stats });
  },

  "clear-diagram": async (): Promise<CallToolResult> => {
    diagram.clear();
    return successResult({ message: "Diagram cleared" });
  },

  "get-selected-cell": async (): Promise<CallToolResult> => {
    return successResult({
      info: "Standalone mode - no UI selection available. Use list-paged-model to see all cells.",
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

    return errorResult(`Category '${args.category_id}' not found. Use get-shape-categories to list available categories.`);
  },

  "get-shape-by-name": async (args: {
    shape_name: string;
  }): Promise<CallToolResult> => {
    // Check basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
    const basic = getBasicShape(args.shape_name);
    if (basic) {
      return successResult({
        shape: { name: basic.name, style: basic.style, width: basic.defaultWidth, height: basic.defaultHeight },
      });
    }

    // Try Azure exact match
    const azureShape = getAzureShapeByName(args.shape_name);
    if (azureShape) {
      return successResult({
        shape: { name: azureShape.title, id: azureShape.id, width: azureShape.width, height: azureShape.height },
      });
    }

    // Try Azure fuzzy search as last resort
    const searchResults = searchAzureIcons(args.shape_name, 1);
    if (searchResults.length > 0) {
      const shape = searchResults[0];
      return successResult({
        shape: { name: shape.title, id: shape.id, width: shape.width, height: shape.height },
      });
    }

    return errorResult(`Shape '${args.shape_name}' not found. Use search-shapes to find available shapes.`);
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
    // Check basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
    const basic = getBasicShape(args.shape_name);
    if (basic) {
      const cell = diagram.addRectangle({
        x: args.x,
        y: args.y,
        width: args.width ?? basic.defaultWidth,
        height: args.height ?? basic.defaultHeight,
        text: args.text,
        style: args.style ?? basic.style,
      });
      return successResult({ success: true, cell });
    }

    // Try Azure exact match
    const azureShape = getAzureShapeByName(args.shape_name);
    if (azureShape) {
      const cell = diagram.addRectangle({
        x: args.x,
        y: args.y,
        width: args.width ?? azureShape.width,
        height: args.height ?? azureShape.height,
        text: args.text ?? azureShape.title,
        style: args.style ?? azureShape.style,
      });
      return successResult({
        success: true,
        cell,
        info: `Added Azure icon: ${azureShape.title}`,
      });
    }

    // Try Azure fuzzy search as last resort
    const searchResults = searchAzureIcons(args.shape_name, 1);
    if (searchResults.length > 0) {
      const shape = searchResults[0];
      const cell = diagram.addRectangle({
        x: args.x,
        y: args.y,
        width: args.width ?? shape.width,
        height: args.height ?? shape.height,
        text: args.text ?? shape.title,
        style: args.style ?? shape.style,
      });
      return successResult({
        success: true,
        cell,
        info: `Added Azure icon (matched from search): ${shape.title}`,
      });
    }

    return errorResult(`Unknown shape '${args.shape_name}'. Use search-shapes to find available shapes, or try basic names like 'rectangle', 'ellipse', 'decision'.`);
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
      return errorResult("Must provide a non-empty 'cells' array");
    }

    const results = args.cells.map((item) => {
      // Check basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
      const basic = getBasicShape(item.shape_name);
      if (basic) {
        const cell = diagram.addRectangle({
          x: item.x,
          y: item.y,
          width: item.width ?? basic.defaultWidth,
          height: item.height ?? basic.defaultHeight,
          text: item.text,
          style: item.style ?? basic.style,
        });
        return { success: true, cell, temp_id: item.temp_id };
      }

      // Try Azure exact match
      let shape = getAzureShapeByName(item.shape_name);

      // Try Azure fuzzy search as last resort
      if (!shape) {
        const searchResults = searchAzureIcons(item.shape_name, 1);
        if (searchResults.length > 0) {
          shape = searchResults[0];
        }
      }

      if (shape) {
        const cell = diagram.addRectangle({
          x: item.x,
          y: item.y,
          width: item.width ?? shape.width,
          height: item.height ?? shape.height,
          text: item.text ?? shape.title,
          style: item.style ?? shape.style,
        });
        return {
          success: true,
          cell,
          temp_id: item.temp_id,
          info: `Added Azure icon: ${shape.title}`,
        };
      }

      return {
        success: false,
        temp_id: item.temp_id,
        shape_name: item.shape_name,
        error: `Unknown shape '${item.shape_name}'. Use search-shapes to find available shapes.`,
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
      return errorResult(
        "Must provide either 'cell_id' and 'shape_name' OR 'cells' array"
      );
    }
    if (hasSingleParams && hasBatchParams) {
      return errorResult(
        "Cannot provide both single parameters (cell_id/shape_name) and batch parameter (cells)"
      );
    }

    // Helper function to get style for a shape name
    const getShapeStyle = (shapeName: string): string | null => {
      // Check basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
      const basic = getBasicShape(shapeName);
      if (basic) return basic.style;

      // Then check Azure shapes
      const azureShape = getAzureShapeByName(shapeName);
      if (azureShape) return azureShape.style ?? null;

      return null;
    };

    // Handle single operation (backward compatible)
    if (hasSingleParams) {
      const style = getShapeStyle(args.shape_name!);
      if (!style) {
        return errorResult(`Unknown shape '${args.shape_name}'`);
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

    // Handle batch operation
    if (hasBatchParams) {
      const results = args.cells!.map((item) => {
        const style = getShapeStyle(item.shape_name);
        if (!style) {
          return {
            success: false,
            cell_id: item.cell_id,
            shape_name: item.shape_name,
            error: `Unknown shape '${item.shape_name}'`,
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
    }

    // Should never reach here
    return errorResult("Invalid set-cell-shape arguments");
  },

  "set-cell-data": async (args: {
    cell_id: string;
    key: string;
    value: string | number | boolean;
  }): Promise<CallToolResult> => {
    // Standalone mode does not support custom data attributes on cells
    return successResult({
      acknowledged: true,
      info: "Standalone mode does not persist custom data attributes to XML. Use edit-cell to modify cell properties (text, position, size, style) instead.",
      cell_id: args.cell_id,
      key: args.key,
      value: args.value,
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
      return errorResult("Must provide either 'query' (string) or 'queries' (array of strings)");
    }
    if (args.query && args.queries) {
      return errorResult("Cannot provide both 'query' and 'queries'. Use one or the other.");
    }

    // Handle single query (backward compatible)
    if (args.query) {
      const results = searchAzureIcons(args.query, limit);
      return successResult({
        query: args.query,
        matches: results.map(r => ({
          name: r.title,
          id: r.id,
          width: r.width,
          height: r.height,
          confidence: r.score,
        })),
        total: results.length,
      });
    }

    // Handle batch queries
    if (args.queries) {
      const batchResults = args.queries.map(q => {
        const results = searchAzureIcons(q, limit);
        return {
          query: q,
          matches: results.map(r => ({
            name: r.title,
            id: r.id,
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
        totalQueries: args.queries.length,
      });
    }

    // Should never reach here
    return errorResult("Invalid search-shapes arguments");
  },
};
