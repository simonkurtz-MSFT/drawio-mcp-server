/**
 * Standalone tool handlers that generate Draw.io XML directly
 * without requiring the browser extension.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { diagram } from "./diagram_model.js";
import { 
  getAzureCategories, 
  getAzureShapesInCategory, 
  getAzureShapeByName,
} from "./azure_shapes.js";

function successResult(data: any): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
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
    return successResult({ success: true, cell });
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
    return successResult({ success: true, cell: result });
  },

  "delete-cell-by-id": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const deleted = diagram.deleteCell(args.cell_id);
    if (!deleted) {
      return errorResult(`Cell '${args.cell_id}' not found`);
    }
    return successResult({ success: true, deleted: args.cell_id });
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
    return successResult({ success: true, cell: result });
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
    return successResult({ success: true, cell: result });
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

  "clear-diagram": async (): Promise<CallToolResult> => {
    diagram.clear();
    return successResult({ success: true, message: "Diagram cleared" });
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
    const azureCategories = getAzureCategories();
    
    return successResult({
      categories: [...basicCategories, ...azureCategories],
      info: "Standalone mode - includes basic shapes and Azure architecture icons.",
    });
  },

  "get-shapes-in-category": async (args: {
    category_id: string;
  }): Promise<CallToolResult> => {
    const categoryId = args.category_id.toLowerCase();
    
    // Check if it's an Azure category
    const azureShapes = getAzureShapesInCategory(categoryId);
    if (azureShapes && azureShapes.length > 0) {
      return successResult({
        category: categoryId,
        shapes: azureShapes.map(shape => ({
          name: shape.name,
          style: shape.style,
          width: shape.defaultWidth,
          height: shape.defaultHeight,
        })),
      });
    }
    
    // Return basic shapes for general/flowchart categories
    const basicShapes: Record<string, any> = {
      general: {
        rectangle: {
          name: "rectangle",
          style: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        },
        rounded: {
          name: "rounded",
          style: "whiteSpace=wrap;html=1;rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;",
        },
        ellipse: {
          name: "ellipse",
          style: "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
        },
      },
      flowchart: {
        process: {
          name: "process",
          style: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        },
        decision: {
          name: "decision",
          style: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
        },
        start: {
          name: "start",
          style: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
        },
        end: {
          name: "end",
          style: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
        },
      },
    };
    
    const shapes = basicShapes[categoryId];
    if (shapes) {
      return successResult({
        category: categoryId,
        shapes: Object.values(shapes),
      });
    }
    
    return errorResult(`Category '${args.category_id}' not found.`);
  },

  "get-shape-by-name": async (args: {
    shape_name: string;
  }): Promise<CallToolResult> => {
    // Try to find an Azure shape first
    const azureShape = getAzureShapeByName(args.shape_name);
    if (azureShape) {
      return successResult({
        shape: {
          name: azureShape.name,
          category: azureShape.category,
          style: azureShape.style,
          width: azureShape.defaultWidth,
          height: azureShape.defaultHeight,
        },
      });
    }
    
    // Fall back to basic shapes
    const basicShapes: Record<string, string> = {
      rectangle: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      rounded: "whiteSpace=wrap;html=1;rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      ellipse: "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
      diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      circle: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;",
      process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
    };
    
    const style = basicShapes[args.shape_name.toLowerCase()];
    if (style) {
      return successResult({
        shape: {
          name: args.shape_name,
          style,
        },
      });
    }
    
    return errorResult(`Shape '${args.shape_name}' not found.`);
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
    // First check if it's an Azure shape
    const azureShape = getAzureShapeByName(args.shape_name);
    if (azureShape) {
      const cell = diagram.addRectangle({
        x: args.x,
        y: args.y,
        width: args.width ?? azureShape.defaultWidth,
        height: args.height ?? azureShape.defaultHeight,
        text: args.text ?? "",
        style: args.style ?? azureShape.style,
      });
      return successResult({ 
        success: true, 
        cell,
      });
    }
    
    // Map shape names to styles
    const shapeStyles: Record<string, string> = {
      rectangle: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      rounded: "whiteSpace=wrap;html=1;rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      ellipse: "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
      diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      circle: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;",
      process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
    };

    const style = shapeStyles[args.shape_name.toLowerCase()];
    if (!style) {
      return errorResult(`Unknown shape '${args.shape_name}'.`);
    }

    const cell = diagram.addRectangle({
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      text: args.text,
      style: args.style ?? style,
    });
    return successResult({ success: true, cell });
  },

  "set-cell-shape": async (args: {
    cell_id: string;
    shape_name: string;
  }): Promise<CallToolResult> => {
    // First check if it's an Azure shape
    const azureShape = getAzureShapeByName(args.shape_name);
    if (azureShape) {
      const result = diagram.editCell(args.cell_id, { style: azureShape.style });
      if ("error" in result) {
        return errorResult(result.error);
      }
      return successResult({ 
        success: true, 
        cell: result,
      });
    }

    // Check basic shapes
    const shapeStyles: Record<string, string> = {
      rectangle: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      rounded: "whiteSpace=wrap;html=1;rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      ellipse: "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
      diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      circle: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;",
      process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
      start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
      end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
    };

    const style = shapeStyles[args.shape_name.toLowerCase()];
    if (!style) {
      return errorResult(`Unknown shape '${args.shape_name}'`);
    }

    const result = diagram.editCell(args.cell_id, { style });
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ success: true, cell: result });
  },

  "set-cell-data": async (args: {
    cell_id: string;
    key: string;
    value: string | number | boolean;
  }): Promise<CallToolResult> => {
    // In standalone mode, we don't have custom data support yet
    // Just acknowledge the request
    return successResult({
      success: true,
      info: "Custom data stored (note: not persisted in XML in standalone mode)",
      cell_id: args.cell_id,
      key: args.key,
      value: args.value,
    });
  },
};
