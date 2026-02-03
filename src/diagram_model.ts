/**
 * Standalone Draw.io diagram model that generates XML without requiring
 * the browser extension or Draw.io application.
 */

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
  }): Cell | { error: string } {
    // Validate source and target exist
    if (!this.cells.has(params.sourceId)) {
      return { error: `Source cell '${params.sourceId}' not found` };
    }
    if (!this.cells.has(params.targetId)) {
      return { error: `Target cell '${params.targetId}' not found` };
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
  }): Cell | { error: string } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return { error: `Cell '${cellId}' not found` };
    }
    if (cell.type !== "vertex") {
      return { error: `Cell '${cellId}' is not a vertex` };
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
  }): Cell | { error: string } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return { error: `Edge '${cellId}' not found` };
    }
    if (cell.type !== "edge") {
      return { error: `Cell '${cellId}' is not an edge` };
    }

    if (params.text !== undefined) cell.value = params.text;
    if (params.sourceId !== undefined) {
      if (!this.cells.has(params.sourceId)) {
        return { error: `Source cell '${params.sourceId}' not found` };
      }
      cell.sourceId = params.sourceId;
    }
    if (params.targetId !== undefined) {
      if (!this.cells.has(params.targetId)) {
        return { error: `Target cell '${params.targetId}' not found` };
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

  setActiveLayer(layerId: string): Layer | { error: string } {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) {
      return { error: `Layer '${layerId}' not found` };
    }
    this.activeLayerId = layerId;
    return layer;
  }

  getActiveLayer(): Layer {
    return this.layers.find(l => l.id === this.activeLayerId) ?? this.layers[0];
  }

  moveCellToLayer(cellId: string, targetLayerId: string): Cell | { error: string } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return { error: `Cell '${cellId}' not found` };
    }
    const layer = this.layers.find(l => l.id === targetLayerId);
    if (!layer) {
      return { error: `Layer '${targetLayerId}' not found` };
    }
    cell.parent = targetLayerId;
    return cell;
  }

  /**
   * Export the diagram as Draw.io XML format
   */
  toXml(): string {
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
${cellsXml}
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
}

// Singleton instance for the standalone diagram
export const diagram = new DiagramModel();
