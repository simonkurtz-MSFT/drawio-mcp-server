import { describe, it, expect, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { standaloneHandlers } from "../src/standalone_tools.js";
import { diagram } from "../src/diagram_model.js";

/**
 * Extract and parse the JSON text payload from a CallToolResult.
 * All standalone handlers return text content, so this narrows the union type safely.
 */
function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return JSON.parse(content.text);
}

// Reset diagram state between tests
beforeEach(() => {
  diagram.clear();
});

describe("standalone_tools handlers", () => {
  describe("add-rectangle", () => {
    it("should create a rectangle with defaults", async () => {
      const result = await standaloneHandlers["add-rectangle"]({});
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
    });

    it("should accept custom parameters", async () => {
      const result = await standaloneHandlers["add-rectangle"]({
        x: 50,
        y: 75,
        width: 300,
        height: 150,
        text: "Custom",
      });
      const parsed = parseResult(result);
      expect(parsed.data.cell.value).toBe("Custom");
      expect(parsed.data.cell.x).toBe(50);
      expect(parsed.data.cell.width).toBe(300);
    });
  });

  describe("add-edge", () => {
    it("should create an edge between two cells", async () => {
      const r1 = await standaloneHandlers["add-rectangle"]({ text: "A" });
      const r2 = await standaloneHandlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;

      const result = await standaloneHandlers["add-edge"]({
        source_id: cell1.id,
        target_id: cell2.id,
        text: "connects",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("edge");
    });

    it("should return error for non-existent source", async () => {
      await standaloneHandlers["add-rectangle"]({ text: "B" });
      const result = await standaloneHandlers["add-edge"]({
        source_id: "nonexistent",
        target_id: "cell-2",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete-cell-by-id", () => {
    it("should delete an existing cell", async () => {
      const r = await standaloneHandlers["add-rectangle"]({ text: "ToDelete" });
      const cellId = parseResult(r).data.cell.id;

      const result = await standaloneHandlers["delete-cell-by-id"]({ cell_id: cellId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.deleted).toBe(cellId);
    });

    it("should return error for non-existent cell", async () => {
      const result = await standaloneHandlers["delete-cell-by-id"]({ cell_id: "nope" });
      expect(result.isError).toBe(true);
    });
  });

  describe("edit-cell", () => {
    it("should update cell properties", async () => {
      const r = await standaloneHandlers["add-rectangle"]({ text: "Original" });
      const cellId = parseResult(r).data.cell.id;

      const result = await standaloneHandlers["edit-cell"]({
        cell_id: cellId,
        text: "Updated",
        x: 500,
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.value).toBe("Updated");
      expect(parsed.data.cell.x).toBe(500);
    });
  });

  describe("edit-edge", () => {
    it("should update edge text", async () => {
      const r1 = await standaloneHandlers["add-rectangle"]({ text: "A" });
      const r2 = await standaloneHandlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;

      const edgeResult = await standaloneHandlers["add-edge"]({
        source_id: cell1.id,
        target_id: cell2.id,
        text: "old",
      });
      const edgeId = parseResult(edgeResult).data.cell.id;

      const result = await standaloneHandlers["edit-edge"]({
        cell_id: edgeId,
        text: "new label",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.value).toBe("new label");
    });
  });

  describe("list-paged-model", () => {
    it("should return empty page for empty diagram", async () => {
      const result = await standaloneHandlers["list-paged-model"]({});
      const parsed = parseResult(result);
      expect(parsed.data.totalCells).toBe(0);
      expect(parsed.data.cells).toHaveLength(0);
    });

    it("should paginate cells", async () => {
      for (let i = 0; i < 5; i++) {
        await standaloneHandlers["add-rectangle"]({ text: `Cell ${i}` });
      }

      const page0 = await standaloneHandlers["list-paged-model"]({ page: 0, page_size: 2 });
      const parsed0 = parseResult(page0);
      expect(parsed0.data.cells).toHaveLength(2);
      expect(parsed0.data.totalPages).toBe(3);

      const page2 = await standaloneHandlers["list-paged-model"]({ page: 2, page_size: 2 });
      const parsed2 = parseResult(page2);
      expect(parsed2.data.cells).toHaveLength(1);
    });

    it("should filter by cell type", async () => {
      const r1 = await standaloneHandlers["add-rectangle"]({ text: "A" });
      const r2 = await standaloneHandlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;
      await standaloneHandlers["add-edge"]({ source_id: cell1.id, target_id: cell2.id });

      const vertexResult = await standaloneHandlers["list-paged-model"]({
        filter: { cell_type: "vertex" },
      });
      const parsed = parseResult(vertexResult);
      expect(parsed.data.totalCells).toBe(2);
    });
  });

  describe("layer operations", () => {
    it("should create, list, set, and get active layer", async () => {
      const createResult = await standaloneHandlers["create-layer"]({ name: "Network" });
      const created = parseResult(createResult);
      expect(created.data.layer.name).toBe("Network");

      const listResult = await standaloneHandlers["list-layers"]({});
      const layers = parseResult(listResult).data.layers;
      expect(layers.length).toBe(2); // Default + Network

      await standaloneHandlers["set-active-layer"]({ layer_id: created.data.layer.id });
      const activeResult = await standaloneHandlers["get-active-layer"]({});
      const active = parseResult(activeResult).data.layer;
      expect(active.name).toBe("Network");
    });

    it("should move cell to different layer", async () => {
      const layerResult = await standaloneHandlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;

      const cellResult = await standaloneHandlers["add-rectangle"]({ text: "Movable" });
      const cellId = parseResult(cellResult).data.cell.id;

      const moveResult = await standaloneHandlers["move-cell-to-layer"]({
        cell_id: cellId,
        target_layer_id: layerId,
      });
      const moved = parseResult(moveResult);
      expect(moved.data.cell.parent).toBe(layerId);
    });
  });

  describe("export-diagram", () => {
    it("should return valid XML", async () => {
      await standaloneHandlers["add-rectangle"]({ text: "Test" });
      const result = await standaloneHandlers["export-diagram"]({});
      const parsed = parseResult(result);
      expect(parsed.data.xml).toContain("<mxfile");
      expect(parsed.data.xml).toContain("Test");
    });
  });

  describe("clear-diagram", () => {
    it("should clear all cells", async () => {
      await standaloneHandlers["add-rectangle"]({ text: "A" });
      await standaloneHandlers["add-rectangle"]({ text: "B" });
      await standaloneHandlers["clear-diagram"]({});

      const stats = await standaloneHandlers["get-diagram-stats"]({});
      const parsed = parseResult(stats);
      expect(parsed.data.stats.total_cells).toBe(0);
    });
  });

  describe("get-diagram-stats", () => {
    it("should return correct stats", async () => {
      await standaloneHandlers["add-rectangle"]({ text: "A" });
      await standaloneHandlers["add-rectangle"]({ text: "B" });

      const result = await standaloneHandlers["get-diagram-stats"]({});
      const parsed = parseResult(result);
      expect(parsed.data.stats.total_cells).toBe(2);
      expect(parsed.data.stats.vertices).toBe(2);
      expect(parsed.data.stats.edges).toBe(0);
    });
  });

  describe("get-shape-categories", () => {
    it("should include basic and Azure categories", async () => {
      const result = await standaloneHandlers["get-shape-categories"]({});
      const parsed = parseResult(result);
      const categoryIds = parsed.data.categories.map((c: any) => c.id);
      expect(categoryIds).toContain("general");
      expect(categoryIds).toContain("flowchart");
      // Should have Azure categories
      expect(parsed.data.categories.length).toBeGreaterThan(5);
    });
  });

  describe("get-shapes-in-category", () => {
    it("should return shapes for general category", async () => {
      const result = await standaloneHandlers["get-shapes-in-category"]({ category_id: "general" });
      const parsed = parseResult(result);
      expect(parsed.data.total).toBeGreaterThan(0);
    });

    it("should return error for unknown category", async () => {
      const result = await standaloneHandlers["get-shapes-in-category"]({ category_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });
  });

  describe("get-shape-by-name", () => {
    it("should find basic shapes", async () => {
      const result = await standaloneHandlers["get-shape-by-name"]({ shape_name: "rectangle" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.shape.name).toBe("rectangle");
    });

    it("should return error for unknown shape", async () => {
      const result = await standaloneHandlers["get-shape-by-name"]({ shape_name: "xyznonexistent" });
      expect(result.isError).toBe(true);
    });
  });

  describe("add-cell-of-shape", () => {
    it("should add a basic shape cell", async () => {
      const result = await standaloneHandlers["add-cell-of-shape"]({
        shape_name: "decision",
        x: 200,
        y: 200,
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
    });

    it("should return error for unknown shape", async () => {
      const result = await standaloneHandlers["add-cell-of-shape"]({
        shape_name: "xyznonexistent",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("batch-add-cells", () => {
    it("should add multiple cells and resolve temp IDs", async () => {
      const result = await standaloneHandlers["batch-add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "b" },
          { type: "edge", source_id: "a", target_id: "b", text: "link" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(3);
      expect(parsed.data.summary.failed).toBe(0);
    });

    it("should support dry_run mode", async () => {
      const result = await standaloneHandlers["batch-add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "DryRun" },
        ],
        dry_run: true,
      });
      const parsed = parseResult(result);
      expect(parsed.data.dry_run).toBe(true);
      expect(parsed.data.summary.succeeded).toBe(1);

      // Diagram should still be empty
      const stats = await standaloneHandlers["get-diagram-stats"]({});
      const statsParsed = parseResult(stats);
      expect(statsParsed.data.stats.total_cells).toBe(0);
    });
  });

  describe("batch-edit-cells", () => {
    it("should edit multiple cells", async () => {
      const r1 = await standaloneHandlers["add-rectangle"]({ text: "A" });
      const r2 = await standaloneHandlers["add-rectangle"]({ text: "B" });
      const id1 = parseResult(r1).data.cell.id;
      const id2 = parseResult(r2).data.cell.id;

      const result = await standaloneHandlers["batch-edit-cells"]({
        cells: [
          { cell_id: id1, text: "Updated A" },
          { cell_id: id2, x: 999 },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
    });
  });

  describe("batch-add-cells-of-shape", () => {
    it("should add multiple shape cells", async () => {
      const result = await standaloneHandlers["batch-add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 100, y: 100, temp_id: "r1" },
          { shape_name: "decision", x: 300, y: 100, temp_id: "d1" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
      expect(parsed.data.summary.failed).toBe(0);
    });

    it("should return error for empty cells array", async () => {
      const result = await standaloneHandlers["batch-add-cells-of-shape"]({
        cells: [],
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("search-shapes", () => {
    it("should find shapes with single query", async () => {
      const result = await standaloneHandlers["search-shapes"]({ query: "storage" });
      const parsed = parseResult(result);
      expect(parsed.data.matches.length).toBeGreaterThan(0);
    });

    it("should support batch queries", async () => {
      const result = await standaloneHandlers["search-shapes"]({
        queries: ["storage", "compute"],
      });
      const parsed = parseResult(result);
      expect(parsed.data.batch).toBe(true);
      expect(parsed.data.results).toHaveLength(2);
    });

    it("should error when neither query nor queries provided", async () => {
      const result = await standaloneHandlers["search-shapes"]({});
      expect(result.isError).toBe(true);
    });

    it("should error when both query and queries provided", async () => {
      const result = await standaloneHandlers["search-shapes"]({
        query: "x",
        queries: ["y"],
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get-style-presets", () => {
    it("should return preset categories", async () => {
      const result = await standaloneHandlers["get-style-presets"]({});
      const parsed = parseResult(result);
      expect(parsed.data.presets).toHaveProperty("azure");
      expect(parsed.data.presets).toHaveProperty("flowchart");
      expect(parsed.data.presets).toHaveProperty("general");
      expect(parsed.data.presets).toHaveProperty("edges");
    });
  });

  describe("set-cell-shape", () => {
    it("should update a cell's style to match a shape", async () => {
      const r = await standaloneHandlers["add-rectangle"]({ text: "Test" });
      const cellId = parseResult(r).data.cell.id;

      const result = await standaloneHandlers["set-cell-shape"]({
        cell_id: cellId,
        shape_name: "decision",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.style).toContain("rhombus");
    });

    it("should support batch cell-shape updates", async () => {
      const r1 = await standaloneHandlers["add-rectangle"]({ text: "A" });
      const r2 = await standaloneHandlers["add-rectangle"]({ text: "B" });
      const id1 = parseResult(r1).data.cell.id;
      const id2 = parseResult(r2).data.cell.id;

      const result = await standaloneHandlers["set-cell-shape"]({
        cells: [
          { cell_id: id1, shape_name: "ellipse" },
          { cell_id: id2, shape_name: "circle" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
    });

    it("should error when no arguments provided", async () => {
      const result = await standaloneHandlers["set-cell-shape"]({});
      expect(result.isError).toBe(true);
    });
  });
});
