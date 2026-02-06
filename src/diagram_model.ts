/**
 * Draw.io diagram model that generates XML without requiring
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
  /** When true, this vertex acts as a container/group for other cells */
  isGroup?: boolean;
  /** IDs of child cells contained in this group */
  children?: string[];
}

export interface Layer {
  id: string;
  name: string;
}

export interface Page {
  id: string;
  name: string;
}

export class DiagramModel {
  private cells: Map<string, Cell> = new Map();
  private layers: Layer[] = [{ id: "1", name: "Default Layer" }];
  private activeLayerId: string = "1";
  private nextId: number = 2;
  private pages: Page[] = [{ id: "page-1", name: "Page-1" }];
  private activePageId: string = "page-1";
  /** Per-page storage: pageId → { cells, layers, activeLayerId, nextId } */
  private pageData: Map<string, { cells: Map<string, Cell>; layers: Layer[]; activeLayerId: string; nextId: number }> = new Map();

  constructor() {
    // Initialize with root cell (id=0) and default layer (id=1)
    // Store initial page data
    this.pageData.set("page-1", {
      cells: this.cells,
      layers: this.layers,
      activeLayerId: this.activeLayerId,
      nextId: this.nextId,
    });
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
      width: Math.max(1, params.width ?? 200),
      height: Math.max(1, params.height ?? 100),
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

  deleteCell(cellId: string): { deleted: boolean; cascadedEdgeIds: string[] } {
    const cell = this.cells.get(cellId);
    if (!cell) return { deleted: false, cascadedEdgeIds: [] };

    // If deleting a vertex, also remove any edges that reference it
    const cascadedEdgeIds: string[] = [];
    if (cell.type === "vertex") {
      for (const [id, c] of this.cells) {
        if (c.type === "edge" && (c.sourceId === cellId || c.targetId === cellId)) {
          cascadedEdgeIds.push(id);
        }
      }
      for (const id of cascadedEdgeIds) {
        this.cells.delete(id);
      }
    }

    this.cells.delete(cellId);
    return { deleted: true, cascadedEdgeIds };
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
    return this.layers.find(l => l.id === this.activeLayerId)!;
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

  // ─── Multi-Page Support ──────────────────────────────────────────

  /**
   * Save current page state into pageData before switching away.
   */
  private saveCurrentPageState(): void {
    this.pageData.set(this.activePageId, {
      cells: this.cells,
      layers: this.layers,
      activeLayerId: this.activeLayerId,
      nextId: this.nextId,
    });
  }

  /**
   * Load a page's state from pageData into the active fields.
   */
  private loadPageState(pageId: string): void {
    const data = this.pageData.get(pageId);
    if (data) {
      this.cells = data.cells;
      this.layers = data.layers;
      this.activeLayerId = data.activeLayerId;
      this.nextId = data.nextId;
    }
  }

  /**
   * Create a new page in the diagram.
   */
  createPage(name: string): Page {
    const id = `page-${this.pages.length + 1}`;
    const page: Page = { id, name };
    this.pages.push(page);
    // Initialize empty page data
    this.pageData.set(id, {
      cells: new Map(),
      layers: [{ id: "1", name: "Default Layer" }],
      activeLayerId: "1",
      nextId: 2,
    });
    return page;
  }

  /**
   * List all pages.
   */
  listPages(): Page[] {
    return [...this.pages];
  }

  /**
   * Get the currently active page.
   */
  getActivePage(): Page {
    return this.pages.find(p => p.id === this.activePageId)!;
  }

  /**
   * Switch to a different page.
   */
  setActivePage(pageId: string): Page | { error: StructuredError } {
    const page = this.pages.find(p => p.id === pageId);
    if (!page) {
      return {
        error: {
          code: "PAGE_NOT_FOUND",
          message: `Page '${pageId}' not found`,
          suggestion: "Use list-pages to see available pages",
        },
      };
    }
    if (pageId === this.activePageId) {
      return page;
    }
    // Save current page state and load the target page
    this.saveCurrentPageState();
    this.activePageId = pageId;
    this.loadPageState(pageId);
    return page;
  }

  /**
   * Rename a page.
   */
  renamePage(pageId: string, newName: string): Page | { error: StructuredError } {
    const page = this.pages.find(p => p.id === pageId);
    if (!page) {
      return {
        error: {
          code: "PAGE_NOT_FOUND",
          message: `Page '${pageId}' not found`,
          suggestion: "Use list-pages to see available pages",
        },
      };
    }
    page.name = newName;
    return page;
  }

  /**
   * Delete a page. Cannot delete the last remaining page.
   */
  deletePage(pageId: string): { deleted: boolean; error?: StructuredError } {
    if (this.pages.length <= 1) {
      return {
        deleted: false,
        error: {
          code: "CANNOT_DELETE_LAST_PAGE",
          message: "Cannot delete the last remaining page",
          suggestion: "Create another page before deleting this one",
        },
      };
    }
    const index = this.pages.findIndex(p => p.id === pageId);
    if (index === -1) {
      return {
        deleted: false,
        error: {
          code: "PAGE_NOT_FOUND",
          message: `Page '${pageId}' not found`,
          suggestion: "Use list-pages to see available pages",
        },
      };
    }
    this.pages.splice(index, 1);
    this.pageData.delete(pageId);
    // If deleting the active page, switch to the first remaining page
    if (this.activePageId === pageId) {
      this.activePageId = this.pages[0].id;
      this.loadPageState(this.activePageId);
    }
    return { deleted: true };
  }

  // ─── Group / Container Support ───────────────────────────────────

  /**
   * Create a group (container) cell that can hold child cells.
   */
  createGroup(params: {
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
      value: params.text ?? "",
      x: params.x ?? 0,
      y: params.y ?? 0,
      width: params.width ?? 400,
      height: params.height ?? 300,
      style: params.style ?? "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;dashed=1;container=1;collapsible=0;",
      parent: this.activeLayerId,
      isGroup: true,
      children: [],
    };
    this.cells.set(id, cell);
    return cell;
  }

  /**
   * Add a cell to a group. The child cell's parent is set to the group.
   */
  addCellToGroup(cellId: string, groupId: string): Cell | { error: StructuredError } {
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
    const group = this.cells.get(groupId);
    if (!group) {
      return {
        error: {
          code: "GROUP_NOT_FOUND",
          message: `Group '${groupId}' not found`,
          cell_id: groupId,
          suggestion: "Use list-paged-model to see available groups",
        },
      };
    }
    if (!group.isGroup) {
      return {
        error: {
          code: "NOT_A_GROUP",
          message: `Cell '${groupId}' is not a group/container`,
          cell_id: groupId,
          suggestion: "Use create-group to create a group first",
        },
      };
    }
    if (cellId === groupId) {
      return {
        error: {
          code: "SELF_REFERENCE",
          message: "Cannot add a group to itself",
          cell_id: cellId,
          suggestion: "Provide a different cell_id and group_id",
        },
      };
    }
    cell.parent = groupId;
    if (!group.children) {
      group.children = [];
    }
    if (!group.children.includes(cellId)) {
      group.children.push(cellId);
    }
    return cell;
  }

  /**
   * Remove a cell from its group, returning it to the active layer.
   */
  removeCellFromGroup(cellId: string): Cell | { error: StructuredError } {
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
    // Check if the cell is currently in a group (parent is a cell, not a layer)
    const parentCell = this.cells.get(cell.parent!);
    if (!parentCell || !parentCell.isGroup) {
      return {
        error: {
          code: "NOT_IN_GROUP",
          message: `Cell '${cellId}' is not inside a group`,
          cell_id: cellId,
          suggestion: "Cell is already at the layer level",
        },
      };
    }
    // Remove from parent's children list
    if (parentCell.children) {
      parentCell.children = parentCell.children.filter(id => id !== cellId);
    }
    // Return to the active layer
    cell.parent = this.activeLayerId;
    return cell;
  }

  /**
   * List the children of a group.
   */
  listGroupChildren(groupId: string): Cell[] | { error: StructuredError } {
    const group = this.cells.get(groupId);
    if (!group) {
      return {
        error: {
          code: "GROUP_NOT_FOUND",
          message: `Group '${groupId}' not found`,
          cell_id: groupId,
          suggestion: "Use list-paged-model to see available groups",
        },
      };
    }
    if (!group.isGroup) {
      return {
        error: {
          code: "NOT_A_GROUP",
          message: `Cell '${groupId}' is not a group/container`,
          cell_id: groupId,
          suggestion: "Use create-group to create a group first",
        },
      };
    }
    return group.children!
      .map(id => this.cells.get(id))
      .filter((c): c is Cell => c !== undefined);
  }

  // ─── Import / Load XML ───────────────────────────────────────────

  /**
   * Unescape XML entities back to plain text.
   */
  private unescapeXml(str: string): string {
    return str
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }

  /**
   * Import a Draw.io XML string, replacing the current diagram state.
   * Supports single-page and multi-page documents.
   * Returns the number of imported pages, cells, and layers.
   */
  importXml(xml: string): { pages: number; cells: number; layers: number } | { error: StructuredError } {
    // Basic validation
    if (!xml || !xml.trim()) {
      return {
        error: {
          code: "EMPTY_XML",
          message: "XML string is empty",
          suggestion: "Provide a valid Draw.io XML string",
        },
      };
    }

    if (!xml.includes("<mxfile") && !xml.includes("<mxGraphModel")) {
      return {
        error: {
          code: "INVALID_XML",
          message: "XML does not appear to be a Draw.io file",
          suggestion: "Provide XML that contains <mxfile> or <mxGraphModel> elements",
        },
      };
    }

    // Extract diagram elements (multi-page support)
    const diagramRegex = /<diagram\s+([^>]*)>([\s\S]*?)<\/diagram>/gi;
    const diagrams: Array<{ id: string; name: string; content: string }> = [];
    let diagramMatch;

    while ((diagramMatch = diagramRegex.exec(xml)) !== null) {
      const attrs = diagramMatch[1];
      const content = diagramMatch[2];
      const idMatch = attrs.match(/id="([^"]*)"/);
      const nameMatch = attrs.match(/name="([^"]*)"/);
      diagrams.push({
        id: idMatch ? idMatch[1] : `page-${diagrams.length + 1}`,
        name: nameMatch ? this.unescapeXml(nameMatch[1]) : `Page-${diagrams.length + 1}`,
        content,
      });
    }

    // If no <diagram> wrapper, treat entire XML as single page
    if (diagrams.length === 0) {
      diagrams.push({ id: "page-1", name: "Page-1", content: xml });
    }

    // Reset state entirely
    this.pages = [];
    this.pageData.clear();
    this.activePageId = "";

    let totalCells = 0;
    let totalLayers = 0;

    for (let di = 0; di < diagrams.length; di++) {
      const diag = diagrams[di];
      const pageId = `page-${di + 1}`;
      this.pages.push({ id: pageId, name: diag.name });

      const { cells, layers, nextId } = this.parseMxGraphContent(diag.content);
      totalCells += cells.size;
      totalLayers += layers.length;

      this.pageData.set(pageId, {
        cells,
        layers,
        activeLayerId: layers[0].id,
        nextId,
      });
    }

    // Activate the first page
    this.activePageId = this.pages[0].id;
    this.loadPageState(this.activePageId);

    return {
      pages: this.pages.length,
      cells: totalCells,
      layers: totalLayers,
    };
  }

  /**
   * Parse mxGraphModel content and extract cells and layers.
   */
  private parseMxGraphContent(content: string): { cells: Map<string, Cell>; layers: Layer[]; nextId: number } {
    const cells = new Map<string, Cell>();
    const layers: Layer[] = [{ id: "1", name: "Default Layer" }];
    let maxId = 1;

    // Extract mxCell elements
    const cellRegex = /<mxCell\s+([\s\S]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/gi;
    let cellMatch;

    // Collect cells that may be layers (parent="0", no vertex/edge)
    const rawCells: Array<{ attrs: string; innerContent: string }> = [];

    while ((cellMatch = cellRegex.exec(content)) !== null) {
      rawCells.push({ attrs: cellMatch[1], innerContent: cellMatch[2] || "" });
    }

    // Also match UserObject elements (for cells with custom data)
    const userObjRegex = /<UserObject\s+([\s\S]*?)>([\s\S]*?)<\/UserObject>/gi;
    let userObjMatch;
    while ((userObjMatch = userObjRegex.exec(content)) !== null) {
      rawCells.push({ attrs: userObjMatch[1], innerContent: userObjMatch[2] || "" });
    }

    for (const raw of rawCells) {
      const attrs = raw.attrs;
      const innerContent = raw.innerContent;

      const idMatch = attrs.match(/id="([^"]*)"/);
      const valueMatch = attrs.match(/value="([^"]*)"/);
      const styleMatch = attrs.match(/style="([^"]*)"/);
      const parentMatch = attrs.match(/parent="([^"]*)"/);
      const sourceMatch = attrs.match(/source="([^"]*)"/);
      const targetMatch = attrs.match(/target="([^"]*)"/);
      const isVertex = /vertex="1"/.test(attrs);
      const isEdge = /edge="1"/.test(attrs);

      const id = idMatch ? idMatch[1] : "";
      const value = valueMatch ? this.unescapeXml(valueMatch[1]) : "";
      const style = styleMatch ? this.unescapeXml(styleMatch[1]) : "";
      const parent = parentMatch ? parentMatch[1] : "";

      // Skip root cells (id=0 or id=1)
      if (id === "0") continue;
      if (id === "1" && parent === "0") continue;

      // Track numeric IDs for nextId
      const numMatch = id.match(/\d+/);
      if (numMatch) {
        maxId = Math.max(maxId, parseInt(numMatch[0], 10));
      }

      // Layer detection: parent="0", not a vertex or edge
      if (parent === "0" && !isVertex && !isEdge) {
        // It's a layer (unless it's the default one we already added)
        if (id !== "1") {
          layers.push({ id, name: value || id });
        }
        continue;
      }

      // Parse geometry from inner content
      let x: number | undefined;
      let y: number | undefined;
      let width: number | undefined;
      let height: number | undefined;

      const geoMatch = innerContent.match(/<mxGeometry\s+([^>]*)/);
      if (geoMatch) {
        const geoAttrs = geoMatch[1];
        const xMatch = geoAttrs.match(/x="([^"]*)"/);
        const yMatch = geoAttrs.match(/y="([^"]*)"/);
        const wMatch = geoAttrs.match(/width="([^"]*)"/);
        const hMatch = geoAttrs.match(/height="([^"]*)"/);
        if (xMatch) x = parseFloat(xMatch[1]);
        if (yMatch) y = parseFloat(yMatch[1]);
        if (wMatch) width = parseFloat(wMatch[1]);
        if (hMatch) height = parseFloat(hMatch[1]);
      }

      // Determine if it's a group/container
      const isGroup = style.includes("container=1") || /swimlane/i.test(style);

      if (isEdge) {
        const cell: Cell = {
          id,
          type: "edge",
          value,
          style,
          sourceId: sourceMatch ? sourceMatch[1] : undefined,
          targetId: targetMatch ? targetMatch[1] : undefined,
          parent: parent || "1",
        };
        cells.set(id, cell);
      } else {
        const cell: Cell = {
          id,
          type: "vertex",
          value,
          x: x ?? 0,
          y: y ?? 0,
          width: width ?? 200,
          height: height ?? 100,
          style,
          parent: parent || "1",
          ...(isGroup && { isGroup: true, children: [] }),
        };
        cells.set(id, cell);
      }
    }

    // Post-process: populate children arrays for groups
    for (const cell of cells.values()) {
      if (cell.parent && cells.has(cell.parent)) {
        const parentCell = cells.get(cell.parent)!;
        if (parentCell.isGroup) {
          parentCell.children!.push(cell.id);
        }
      }
    }

    return { cells, layers, nextId: maxId + 1 };
  }

  /**
   * Export the diagram as Draw.io XML format (supports multi-page)
   */
  toXml(): string {
    // Save current page state so all pages have up-to-date data
    this.saveCurrentPageState();

    const diagramsXml = this.pages.map(page => {
      const data = this.pageData.get(page.id)!;
      const pageXml = this.renderPageXml(data.cells, data.layers);
      return `    <diagram id="${this.escapeXml(page.id)}" name="${this.escapeXml(page.name)}">
        <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
${pageXml}
            </root>
        </mxGraphModel>
    </diagram>`;
    }).join("\n");

    return `<mxfile host="drawio-mcp-server">
${diagramsXml}
</mxfile>`;
  }

  /**
   * Render cells and layers for a single page.
   */
  private renderPageXml(cells: Map<string, Cell>, layers: Layer[]): string {
    // Emit custom layer cells (skip the default layer id="1" which is always present)
    const layerCellsXml = layers
      .filter(l => l.id !== "1")
      .map(l => `                <mxCell id="${this.escapeXml(l.id)}" value="${this.escapeXml(l.name)}" style="" parent="0"/>`)
      .join("\n");

    const cellsXml = Array.from(cells.values())
      .map(cell => {
        if (cell.type === "vertex") {
          const groupAttrs = cell.isGroup ? ' connectable="0"' : '';
          const containerStyle = cell.isGroup && cell.style && !cell.style.includes("container=1")
            ? cell.style + "container=1;"
            : cell.style;
          return `                <mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(containerStyle!)}" vertex="1"${groupAttrs} parent="${cell.parent!}">
                    <mxGeometry x="${cell.x!}" y="${cell.y!}" width="${cell.width!}" height="${cell.height!}" as="geometry"/>
                </mxCell>`;
        } else {
          const sourceAttr = cell.sourceId ? ` source="${cell.sourceId}"` : "";
          const targetAttr = cell.targetId ? ` target="${cell.targetId}"` : "";
          return `                <mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(cell.style!)}" edge="1" parent="${cell.parent!}"${sourceAttr}${targetAttr}>
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>`;
        }
      })
      .join("\n");

    return `${layerCellsXml ? layerCellsXml + "\n" : ""}${cellsXml}`;
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
   * Clear all cells and reset the diagram (including pages)
   */
  clear(): { vertices: number; edges: number } {
    // Count cells across all pages
    this.saveCurrentPageState();
    let vertices = 0;
    let edges = 0;
    for (const data of this.pageData.values()) {
      for (const c of data.cells.values()) {
        if (c.type === "vertex") vertices++;
        else edges++;
      }
    }

    // Reset to single empty page
    this.cells = new Map();
    this.layers = [{ id: "1", name: "Default Layer" }];
    this.activeLayerId = "1";
    this.nextId = 2;
    this.pages = [{ id: "page-1", name: "Page-1" }];
    this.activePageId = "page-1";
    this.pageData.clear();
    this.pageData.set("page-1", {
      cells: this.cells,
      layers: this.layers,
      activeLayerId: this.activeLayerId,
      nextId: this.nextId,
    });
    return { vertices, edges };
  }

  /**
   * Get statistics about the current diagram (active page)
   */
  getStats(): {
    total_cells: number;
    vertices: number;
    edges: number;
    groups: number;
    layers: number;
    pages: number;
    active_page: string;
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
    cells_with_text: number;
    cells_without_text: number;
    cells_by_layer: Record<string, number>;
  } {
    const cells = Array.from(this.cells.values());
    const vertices = cells.filter(c => c.type === "vertex");
    const edges = cells.filter(c => c.type === "edge");
    const groups = cells.filter(c => c.isGroup).length;

    // Calculate bounding box
    let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    if (vertices.length > 0) {
      const positions = vertices.filter(v => v.x !== undefined && v.y !== undefined);
      if (positions.length > 0) {
        const minX = Math.min(...positions.map(v => v.x!));
        const minY = Math.min(...positions.map(v => v.y!));
        const maxX = Math.max(...positions.map(v => v.x! + v.width!));
        const maxY = Math.max(...positions.map(v => v.y! + v.height!));
        bounds = { minX, minY, maxX, maxY };
      }
    }

    // Count cells with/without text
    const cellsWithText = cells.filter(c => c.value && c.value.trim().length > 0).length;
    const cellsWithoutText = cells.length - cellsWithText;

    // Count cells by layer
    const cellsByLayer: Record<string, number> = {};
    cells.forEach(c => {
      const layer = c.parent!;
      cellsByLayer[layer] = (cellsByLayer[layer] ?? 0) + 1;
    });

    return {
      total_cells: cells.length,
      vertices: vertices.length,
      edges: edges.length,
      groups,
      layers: this.layers.length,
      pages: this.pages.length,
      active_page: this.activePageId,
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
      // Validation guarantees sourceId/targetId are truthy for edges
      const sourceId = tempIdMap.get(item.sourceId!) ?? item.sourceId!;
      const targetId = tempIdMap.get(item.targetId!) ?? item.targetId!;

      const result = this.addEdge({
        sourceId,
        targetId,
        text: item.text,
        style: item.style,
      });

      // Validation guarantees addEdge succeeds — cast safely
      const edge = result as Cell;
      if (item.tempId) {
        tempIdMap.set(item.tempId, edge.id);
      }
      results.push({ success: true, cell: edge, tempId: item.tempId });
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
        !!(item.sourceId && (createdTempIds.has(item.sourceId) || this.cells.has(item.sourceId)));
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
        !!(item.targetId && (createdTempIds.has(item.targetId) || this.cells.has(item.targetId)));
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

// Singleton instance for the diagram
export const diagram = new DiagramModel();
