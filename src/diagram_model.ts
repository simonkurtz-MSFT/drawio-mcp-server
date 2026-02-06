/**
 * Standalone Draw.io diagram model that generates XML without requiring
 * the browser extension or Draw.io application.
 */

export interface StructuredError {
  code: string;
  message: string;
  cell_id?: string;
  index?: number;
  suggestion?: string;
}

export interface Cell {
  id: string;
  type: "vertex" | "edge";
  value: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: string;
  sourceId?: string;
  targetId?: string;
  parent?: string;
}

export interface Layer {
  id: string;
  name: string;
}

export class DiagramModel {
  private cells: Map<string, Cell> = new Map();
  private layers: Layer[] = [{ id: "1", name: "Default Layer" }];
  private activeLayerId: string = "1";
  private nextId: number = 2;

  constructor() {
    // Initialize with root cell (id=0) and default layer (id=1)
  }

  private generateId(): string {
    return `cell-${this.nextId++}`;
  }

  addRectangle(params: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Cell {
    const id = this.generateId();
    const cell: Cell = {
      id,
      type: "vertex",
      value: params.text ?? "New Cell",
      x: params.x ?? 100,
      y: params.y ?? 100,
      width: params.width ?? 200,
      height: params.height ?? 100,
      style: params.style ?? "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      parent: this.activeLayerId,
    };
    this.cells.set(id, cell);
    return cell;
  }

  addEdge(params: {
    sourceId: string;
    targetId: string;
    text?: string;
    style?: string;
  }): Cell | { error: StructuredError } {
    // Validate source and target exist
    if (!this.cells.has(params.sourceId)) {
      return {
        error: {
          code: "SOURCE_NOT_FOUND",
          message: `Source cell '${params.sourceId}' not found`,
          cell_id: params.sourceId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (!this.cells.has(params.targetId)) {
      return {
        error: {
          code: "TARGET_NOT_FOUND",
          message: `Target cell '${params.targetId}' not found`,
          cell_id: params.targetId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }

    const id = this.generateId();
    const cell: Cell = {
      id,
      type: "edge",
      value: params.text ?? "",
      style: params.style ?? "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;",
      sourceId: params.sourceId,
      targetId: params.targetId,
      parent: this.activeLayerId,
    };
    this.cells.set(id, cell);
    return cell;
  }

  deleteCell(cellId: string): boolean {
    return this.cells.delete(cellId);
  }

  editCell(cellId: string, params: {
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: string;
  }): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (cell.type !== "vertex") {
      return {
        error: {
          code: "WRONG_CELL_TYPE",
          message: `Cell '${cellId}' is not a vertex`,
          cell_id: cellId,
          suggestion: `This cell is a ${cell.type}. Use edit-edge for edge cells.`,
        },
      };
    }

    if (params.text !== undefined) cell.value = params.text;
    if (params.x !== undefined) cell.x = params.x;
    if (params.y !== undefined) cell.y = params.y;
    if (params.width !== undefined) cell.width = params.width;
    if (params.height !== undefined) cell.height = params.height;
    if (params.style !== undefined) cell.style = params.style;

    return cell;
  }

  editEdge(cellId: string, params: {
    text?: string;
    sourceId?: string;
    targetId?: string;
    style?: string;
  }): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Edge '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (cell.type !== "edge") {
      return {
        error: {
          code: "WRONG_CELL_TYPE",
          message: `Cell '${cellId}' is not an edge`,
          cell_id: cellId,
          suggestion: `This cell is a ${cell.type}. Use edit-cell for vertex cells.`,
        },
      };
    }

    if (params.text !== undefined) cell.value = params.text;
    if (params.sourceId !== undefined) {
      if (!this.cells.has(params.sourceId)) {
        return {
          error: {
            code: "SOURCE_NOT_FOUND",
            message: `Source cell '${params.sourceId}' not found`,
            cell_id: params.sourceId,
            suggestion: "Use list-paged-model to see available cells",
          },
        };
      }
      cell.sourceId = params.sourceId;
    }
    if (params.targetId !== undefined) {
      if (!this.cells.has(params.targetId)) {
        return {
          error: {
            code: "TARGET_NOT_FOUND",
            message: `Target cell '${params.targetId}' not found`,
            cell_id: params.targetId,
            suggestion: "Use list-paged-model to see available cells",
          },
        };
      }
      cell.targetId = params.targetId;
    }
    if (params.style !== undefined) cell.style = params.style;

    return cell;
  }

  getCell(cellId: string): Cell | undefined {
    return this.cells.get(cellId);
  }

  listCells(filter?: { cellType?: "vertex" | "edge" }): Cell[] {
    let cells = Array.from(this.cells.values());
    if (filter?.cellType) {
      cells = cells.filter(c => c.type === filter.cellType);
    }
    return cells;
  }

  createLayer(name: string): Layer {
    const id = `layer-${this.layers.length + 1}`;
    const layer: Layer = { id, name };
    this.layers.push(layer);
    return layer;
  }

  listLayers(): Layer[] {
    return [...this.layers];
  }

  setActiveLayer(layerId: string): Layer | { error: StructuredError } {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) {
      return {
        error: {
          code: "LAYER_NOT_FOUND",
          message: `Layer '${layerId}' not found`,
          suggestion: "Use list-layers to see available layers",
        },
      };
    }
    this.activeLayerId = layerId;
    return layer;
  }

  getActiveLayer(): Layer {
    return this.layers.find(l => l.id === this.activeLayerId) ?? this.layers[0];
  }

  moveCellToLayer(cellId: string, targetLayerId: string): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    const layer = this.layers.find(l => l.id === targetLayerId);
    if (!layer) {
      return {
        error: {
          code: "LAYER_NOT_FOUND",
          message: `Layer '${targetLayerId}' not found`,
          suggestion: "Use list-layers to see available layers",
        },
      };
    }
    cell.parent = targetLayerId;
    return cell;
  }

  /**
   * Export the diagram as Draw.io XML format
   */
  toXml(): string {
    // Emit custom layer cells (skip the default layer id="1" which is always present)
    const layerCellsXml = this.layers
      .filter(l => l.id !== "1")
      .map(l => `                <mxCell id="${this.escapeXml(l.id)}" value="${this.escapeXml(l.name)}" style="" parent="0"/>`)
      .join("\n");

    const cellsXml = Array.from(this.cells.values())
      .map(cell => {
        if (cell.type === "vertex") {
          return `                <mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(cell.style ?? "")}" vertex="1" parent="${cell.parent ?? "1"}">
                    <mxGeometry x="${cell.x ?? 0}" y="${cell.y ?? 0}" width="${cell.width ?? 100}" height="${cell.height ?? 60}" as="geometry"/>
                </mxCell>`;
        } else {
          return `                <mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(cell.style ?? "")}" edge="1" parent="${cell.parent ?? "1"}" source="${cell.sourceId ?? ""}" target="${cell.targetId ?? ""}">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>`;
        }
      })
      .join("\n");

    return `<mxfile host="drawio-mcp-server">
    <diagram id="diagram1" name="Page-1">
        <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
${layerCellsXml ? layerCellsXml + "\n" : ""}${cellsXml}
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Clear all cells and reset the diagram
   */
  clear(): void {
    this.cells.clear();
    this.nextId = 2;
  }

  /**
   * Get statistics about the current diagram
   */
  getStats(): {
    total_cells: number;
    vertices: number;
    edges: number;
    layers: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
    cells_with_text: number;
    cells_without_text: number;
    cells_by_layer: Record<string, number>;
  } {
    const cells = Array.from(this.cells.values());
    const vertices = cells.filter(c => c.type === "vertex");
    const edges = cells.filter(c => c.type === "edge");

    // Calculate bounding box
    let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    if (vertices.length > 0) {
      const positions = vertices.filter(v => v.x !== undefined && v.y !== undefined);
      if (positions.length > 0) {
        const minX = Math.min(...positions.map(v => v.x!));
        const minY = Math.min(...positions.map(v => v.y!));
        const maxX = Math.max(...positions.map(v => (v.x ?? 0) + (v.width ?? 0)));
        const maxY = Math.max(...positions.map(v => (v.y ?? 0) + (v.height ?? 0)));
        bounds = { minX, minY, maxX, maxY };
      }
    }

    // Count cells with/without text
    const cellsWithText = cells.filter(c => c.value && c.value.trim().length > 0).length;
    const cellsWithoutText = cells.length - cellsWithText;

    // Count cells by layer
    const cellsByLayer: Record<string, number> = {};
    cells.forEach(c => {
      const layer = c.parent ?? "1";
      cellsByLayer[layer] = (cellsByLayer[layer] ?? 0) + 1;
    });

    return {
      total_cells: cells.length,
      vertices: vertices.length,
      edges: edges.length,
      layers: this.layers.length,
      bounds,
      cells_with_text: cellsWithText,
      cells_without_text: cellsWithoutText,
      cells_by_layer: cellsByLayer,
    };
  }

/**
 * Batch add multiple cells (vertices and edges) in a single operation.
 * Validates entire batch before executing to fail fast.
 * Returns an array of results with created cells or errors.
 */
batchAddCells(
  items: Array<{
    type: "vertex" | "edge";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
    sourceId?: string;
    targetId?: string;
    tempId?: string;
  }>,
  options?: { dryRun?: boolean },
): Array<{ success: boolean; cell?: Cell; error?: StructuredError; tempId?: string }> {
  // Pre-validate entire batch
  const validationErrors = this.validateBatchCells(items);
  if (validationErrors.length > 0) {
    return validationErrors;
  }

  // If dry-run, return success without persisting
  if (options?.dryRun) {
    return items.map((item, index) => ({
      success: true,
      tempId: item.tempId,
      cell: {
        id: `temp-cell-${index}`,
        type: item.type,
        value: item.text ?? "",
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        style: item.style,
        sourceId: item.sourceId,
        targetId: item.targetId,
      } as Cell,
    }));
  }

  // Execute batch operations
  const results: Array<{ success: boolean; cell?: Cell; error?: StructuredError; tempId?: string }> =
    [];
  const tempIdMap = new Map<string, string>();

  for (const item of items) {
    if (item.type === "vertex") {
      const cell = this.addRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        text: item.text,
        style: item.style,
      });
      if (item.tempId) {
        tempIdMap.set(item.tempId, cell.id);
      }
      results.push({ success: true, cell, tempId: item.tempId });
    } else if (item.type === "edge") {
      const sourceId = item.sourceId ? tempIdMap.get(item.sourceId) ?? item.sourceId : "";
      const targetId = item.targetId ? tempIdMap.get(item.targetId) ?? item.targetId : "";

      const result = this.addEdge({
        sourceId,
        targetId,
        text: item.text,
        style: item.style,
      });

      if ("error" in result) {
        results.push({
          success: false,
          error: result.error,
          tempId: item.tempId,
        });
      } else {
        if (item.tempId) {
          tempIdMap.set(item.tempId, result.id);
        }
        results.push({ success: true, cell: result, tempId: item.tempId });
      }
    }
  }

  return results;
}

private validateBatchCells(
  items: Array<{
    type: "vertex" | "edge";
    sourceId?: string;
    targetId?: string;
    tempId?: string;
  }>,
): Array<{ success: boolean; error: StructuredError; tempId?: string }> {
  const errors: Array<{ success: boolean; error: StructuredError; tempId?: string }> = [];
  const createdTempIds = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === "edge") {
      // Validate source exists (check temp IDs from earlier items and existing cells)
      const sourceExists =
        (item.sourceId && (createdTempIds.has(item.sourceId) || this.cells.has(item.sourceId))) ??
        false;
      if (!sourceExists) {
        errors.push({
          success: false,
          tempId: item.tempId,
          error: {
            code: "INVALID_SOURCE",
            message: `Edge at index ${i}: source cell '${item.sourceId}' not found`,
            index: i,
            suggestion: "Ensure source_id references an existing cell or a temp_id defined earlier in the batch",
          },
        });
      }

      // Validate target exists
      const targetExists =
        (item.targetId && (createdTempIds.has(item.targetId) || this.cells.has(item.targetId))) ??
        false;
      if (!targetExists) {
        errors.push({
          success: false,
          tempId: item.tempId,
          error: {
            code: "INVALID_TARGET",
            message: `Edge at index ${i}: target cell '${item.targetId}' not found`,
            index: i,
            suggestion:
              "Ensure target_id references an existing cell or a temp_id defined earlier in the batch",
          },
        });
      }
    }

    // Track temp IDs for validation
    if (item.tempId) {
      createdTempIds.add(item.tempId);
    }
  }

  return errors;
}

/**
 * Batch edit multiple cells in a single operation.
 */
batchEditCells(
  updates: Array<{
    cell_id: string;
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: string;
  }>,
): Array<{ success: boolean; cell?: Cell; error?: StructuredError; cell_id: string }> {
  return updates.map((update) => {
    const result = this.editCell(update.cell_id, {
      text: update.text,
      x: update.x,
      y: update.y,
      width: update.width,
      height: update.height,
      style: update.style,
    });

    if ("error" in result) {
      return {
        success: false,
        cell_id: update.cell_id,
        error: result.error,
      };
    }

    return {
      success: true,
      cell_id: update.cell_id,
      cell: result,
    };
  });
}
}

// Singleton instance for the standalone diagram
export const diagram = new DiagramModel();
