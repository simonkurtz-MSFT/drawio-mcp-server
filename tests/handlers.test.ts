import { describe, it, expect, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers } from "../src/tools.js";
import { diagram } from "../src/diagram_model.js";

/**
 * Extract and parse the JSON text payload from a CallToolResult.
 * All handlers return text content, so this narrows the union type safely.
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

describe("tool handlers", () => {
  describe("add-rectangle", () => {
    it("should create a rectangle with defaults", async () => {
      const result = await handlers["add-rectangle"]({});
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
    });

    it("should accept custom parameters", async () => {
      const result = await handlers["add-rectangle"]({
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
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;

      const result = await handlers["add-edge"]({
        source_id: cell1.id,
        target_id: cell2.id,
        text: "connects",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("edge");
    });

    it("should return error for non-existent source", async () => {
      await handlers["add-rectangle"]({ text: "B" });
      const result = await handlers["add-edge"]({
        source_id: "nonexistent",
        target_id: "cell-2",
      });
      expect(result.isError).toBe(true);
    });

    it("should return error for non-existent target", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const cell1 = parseResult(r1).data.cell;
      const result = await handlers["add-edge"]({
        source_id: cell1.id,
        target_id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("TARGET_NOT_FOUND");
    });
  });

  describe("delete-cell-by-id", () => {
    it("should delete an existing cell", async () => {
      const r = await handlers["add-rectangle"]({ text: "ToDelete" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["delete-cell-by-id"]({ cell_id: cellId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.deleted).toBe(cellId);
    });

    it("should return error for non-existent cell", async () => {
      const result = await handlers["delete-cell-by-id"]({ cell_id: "nope" });
      expect(result.isError).toBe(true);
    });
  });

  describe("edit-cell", () => {
    it("should update cell properties", async () => {
      const r = await handlers["add-rectangle"]({ text: "Original" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["edit-cell"]({
        cell_id: cellId,
        text: "Updated",
        x: 500,
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.value).toBe("Updated");
      expect(parsed.data.cell.x).toBe(500);
    });

    it("should return error for non-existent cell", async () => {
      const result = await handlers["edit-cell"]({
        cell_id: "nonexistent",
        text: "X",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("CELL_NOT_FOUND");
    });

    it("should return error when editing an edge as a vertex", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;
      const edgeResult = await handlers["add-edge"]({
        source_id: cell1.id,
        target_id: cell2.id,
      });
      const edgeId = parseResult(edgeResult).data.cell.id;

      const result = await handlers["edit-cell"]({
        cell_id: edgeId,
        text: "X",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("WRONG_CELL_TYPE");
    });
  });

  describe("edit-edge", () => {
    it("should update edge text", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;

      const edgeResult = await handlers["add-edge"]({
        source_id: cell1.id,
        target_id: cell2.id,
        text: "old",
      });
      const edgeId = parseResult(edgeResult).data.cell.id;

      const result = await handlers["edit-edge"]({
        cell_id: edgeId,
        text: "new label",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.value).toBe("new label");
    });

    it("should return error for non-existent edge", async () => {
      const result = await handlers["edit-edge"]({
        cell_id: "nonexistent",
        text: "X",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("CELL_NOT_FOUND");
    });

    it("should return error when editing a vertex as an edge", async () => {
      const r = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["edit-edge"]({
        cell_id: cellId,
        text: "X",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("WRONG_CELL_TYPE");
    });
  });

  describe("list-paged-model", () => {
    it("should return empty page for empty diagram", async () => {
      const result = await handlers["list-paged-model"]({});
      const parsed = parseResult(result);
      expect(parsed.data.totalCells).toBe(0);
      expect(parsed.data.cells).toHaveLength(0);
    });

    it("should paginate cells", async () => {
      for (let i = 0; i < 5; i++) {
        await handlers["add-rectangle"]({ text: `Cell ${i}` });
      }

      const page0 = await handlers["list-paged-model"]({ page: 0, page_size: 2 });
      const parsed0 = parseResult(page0);
      expect(parsed0.data.cells).toHaveLength(2);
      expect(parsed0.data.totalPages).toBe(3);

      const page2 = await handlers["list-paged-model"]({ page: 2, page_size: 2 });
      const parsed2 = parseResult(page2);
      expect(parsed2.data.cells).toHaveLength(1);
    });

    it("should filter by cell type", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;
      await handlers["add-edge"]({ source_id: cell1.id, target_id: cell2.id });

      const vertexResult = await handlers["list-paged-model"]({
        filter: { cell_type: "vertex" },
      });
      const parsed = parseResult(vertexResult);
      expect(parsed.data.totalCells).toBe(2);
    });

    it("should filter by edge type", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const cell1 = parseResult(r1).data.cell;
      const cell2 = parseResult(r2).data.cell;
      await handlers["add-edge"]({ source_id: cell1.id, target_id: cell2.id });

      const edgeResult = await handlers["list-paged-model"]({
        filter: { cell_type: "edge" },
      });
      const parsed = parseResult(edgeResult);
      expect(parsed.data.totalCells).toBe(1);
    });
  });

  describe("layer operations", () => {
    it("should create, list, set, and get active layer", async () => {
      const createResult = await handlers["create-layer"]({ name: "Network" });
      const created = parseResult(createResult);
      expect(created.data.layer.name).toBe("Network");

      const listResult = await handlers["list-layers"]();
      const layers = parseResult(listResult).data.layers;
      expect(layers.length).toBe(2); // Default + Network

      await handlers["set-active-layer"]({ layer_id: created.data.layer.id });
      const activeResult = await handlers["get-active-layer"]();
      const active = parseResult(activeResult).data.layer;
      expect(active.name).toBe("Network");
    });

    it("should move cell to different layer", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;

      const cellResult = await handlers["add-rectangle"]({ text: "Movable" });
      const cellId = parseResult(cellResult).data.cell.id;

      const moveResult = await handlers["move-cell-to-layer"]({
        cell_id: cellId,
        target_layer_id: layerId,
      });
      const moved = parseResult(moveResult);
      expect(moved.data.cell.parent).toBe(layerId);
    });

    it("should return error for set-active-layer with non-existent layer", async () => {
      const result = await handlers["set-active-layer"]({ layer_id: "nonexistent" });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("LAYER_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent cell", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;

      const result = await handlers["move-cell-to-layer"]({
        cell_id: "nonexistent",
        target_layer_id: layerId,
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("CELL_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent layer", async () => {
      const cellResult = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(cellResult).data.cell.id;

      const result = await handlers["move-cell-to-layer"]({
        cell_id: cellId,
        target_layer_id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("LAYER_NOT_FOUND");
    });
  });

  describe("export-diagram", () => {
    it("should return valid XML", async () => {
      await handlers["add-rectangle"]({ text: "Test" });
      const result = await handlers["export-diagram"]();
      const parsed = parseResult(result);
      expect(parsed.data.xml).toContain("<mxfile");
      expect(parsed.data.xml).toContain("Test");
    });
  });

  describe("clear-diagram", () => {
    it("should clear all cells", async () => {
      await handlers["add-rectangle"]({ text: "A" });
      await handlers["add-rectangle"]({ text: "B" });
      await handlers["clear-diagram"]();

      const stats = await handlers["get-diagram-stats"]();
      const parsed = parseResult(stats);
      expect(parsed.data.stats.total_cells).toBe(0);
    });
  });

  describe("get-diagram-stats", () => {
    it("should return correct stats", async () => {
      await handlers["add-rectangle"]({ text: "A" });
      await handlers["add-rectangle"]({ text: "B" });

      const result = await handlers["get-diagram-stats"]();
      const parsed = parseResult(result);
      expect(parsed.data.stats.total_cells).toBe(2);
      expect(parsed.data.stats.vertices).toBe(2);
      expect(parsed.data.stats.edges).toBe(0);
    });
  });

  describe("get-shape-categories", () => {
    it("should include basic and Azure categories", async () => {
      const result = await handlers["get-shape-categories"]();
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
      const result = await handlers["get-shapes-in-category"]({ category_id: "general" });
      const parsed = parseResult(result);
      expect(parsed.data.total).toBeGreaterThan(0);
    });

    it("should return error for unknown category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should return shapes for an Azure category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "compute" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.total).toBeGreaterThan(0);
      expect(parsed.data.shapes[0]).toHaveProperty("name");
      expect(parsed.data.shapes[0]).toHaveProperty("id");
    });

    it("should return shapes for flowchart category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "flowchart" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.total).toBeGreaterThan(0);
    });
  });

  describe("get-shape-by-name", () => {
    it("should find basic shapes", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "rectangle" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.shape.name).toBe("rectangle");
    });

    it("should return error for unknown shape", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "xyznonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should find Azure shapes by exact title", async () => {
      // Use a well-known Azure shape from the icon library
      const searchResult = await handlers["search-shapes"]({ query: "virtual machine", limit: 1 });
      const shapeName = parseResult(searchResult).data.matches[0].name;

      const result = await handlers["get-shape-by-name"]({ shape_name: shapeName });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.shape.name).toBe(shapeName);
    });

    it("should find Azure shapes via fuzzy search", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "storage account" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.shape).toHaveProperty("style");
    });

    it("should prioritize basic shapes over Azure fuzzy matches", async () => {
      // "start" and "end" are basic shape names that could fuzzy-match Azure icons
      const startResult = await handlers["get-shape-by-name"]({ shape_name: "start" });
      const startParsed = parseResult(startResult);
      expect(startParsed.success).toBe(true);
      expect(startParsed.data.shape.name).toBe("start");
      // Verify it's the basic flowchart shape, not an Azure icon
      expect(startParsed.data.shape.style).toContain("ellipse");

      const endResult = await handlers["get-shape-by-name"]({ shape_name: "end" });
      const endParsed = parseResult(endResult);
      expect(endParsed.success).toBe(true);
      expect(endParsed.data.shape.name).toBe("end");
      expect(endParsed.data.shape.style).toContain("ellipse");
    });
  });

  describe("add-cell-of-shape", () => {
    it("should add a basic shape cell", async () => {
      const result = await handlers["add-cell-of-shape"]({
        shape_name: "decision",
        x: 200,
        y: 200,
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
    });

    it("should return error for unknown shape", async () => {
      const result = await handlers["add-cell-of-shape"]({
        shape_name: "xyznonexistent",
      });
      expect(result.isError).toBe(true);
    });

    it("should add an Azure shape by exact name and include info", async () => {
      // Get a real Azure shape name via search
      const searchResult = await handlers["search-shapes"]({ query: "virtual machine", limit: 1 });
      const shapeName = parseResult(searchResult).data.matches[0].name;

      const result = await handlers["add-cell-of-shape"]({ shape_name: shapeName });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
      // Azure exact match should include info
      expect(parsed.data.info).toContain("Azure icon");
    });

    it("should add an Azure shape via fuzzy match and include info", async () => {
      const result = await handlers["add-cell-of-shape"]({ shape_name: "storage account" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
      expect(parsed.data.info).toContain("Azure icon");
    });

    it("should use custom dimensions over shape defaults", async () => {
      const result = await handlers["add-cell-of-shape"]({
        shape_name: "decision",
        width: 500,
        height: 300,
        text: "Custom Size",
        style: "fillColor=#ff0000;",
      });
      const parsed = parseResult(result);
      expect(parsed.data.cell.width).toBe(500);
      expect(parsed.data.cell.height).toBe(300);
      expect(parsed.data.cell.value).toBe("Custom Size");
      expect(parsed.data.cell.style).toBe("fillColor=#ff0000;");
    });

    it("should not include info field for basic shapes", async () => {
      const result = await handlers["add-cell-of-shape"]({ shape_name: "rectangle" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.type).toBe("vertex");
      expect(parsed.data.info).toBeUndefined();
    });
  });

  describe("batch-add-cells", () => {
    it("should add multiple cells and resolve temp IDs", async () => {
      const result = await handlers["batch-add-cells"]({
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
      const result = await handlers["batch-add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "DryRun" },
        ],
        dry_run: true,
      });
      const parsed = parseResult(result);
      expect(parsed.data.dry_run).toBe(true);
      expect(parsed.data.summary.succeeded).toBe(1);

      // Diagram should still be empty
      const stats = await handlers["get-diagram-stats"]();
      const statsParsed = parseResult(stats);
      expect(statsParsed.data.stats.total_cells).toBe(0);
    });

    it("should fail when edge references non-existent source", async () => {
      const result = await handlers["batch-add-cells"]({
        cells: [
          { type: "edge", source_id: "nonexistent", target_id: "also-nonexistent" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.failed).toBeGreaterThan(0);
    });

    it("should resolve temp IDs for edges referencing earlier batch items", async () => {
      const result = await handlers["batch-add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "tmp-a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "tmp-b" },
          { type: "edge", source_id: "tmp-a", target_id: "tmp-b", temp_id: "tmp-e" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(3);
      // Edge should have resolved real cell IDs
      const edgeResult = parsed.data.results[2];
      expect(edgeResult.success).toBe(true);
    });
  });

  describe("batch-edit-cells", () => {
    it("should edit multiple cells", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const id1 = parseResult(r1).data.cell.id;
      const id2 = parseResult(r2).data.cell.id;

      const result = await handlers["batch-edit-cells"]({
        cells: [
          { cell_id: id1, text: "Updated A" },
          { cell_id: id2, x: 999 },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
    });

    it("should report failure for non-existent cell in batch", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const id1 = parseResult(r1).data.cell.id;

      const result = await handlers["batch-edit-cells"]({
        cells: [
          { cell_id: id1, text: "Updated" },
          { cell_id: "nonexistent", text: "Fail" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.summary.failed).toBe(1);
    });
  });

  describe("batch-add-cells-of-shape", () => {
    it("should add multiple shape cells", async () => {
      const result = await handlers["batch-add-cells-of-shape"]({
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
      const result = await handlers["batch-add-cells-of-shape"]({
        cells: [],
      });
      expect(result.isError).toBe(true);
    });

    it("should add Azure shape cells with info", async () => {
      const searchResult = await handlers["search-shapes"]({ query: "virtual machine", limit: 1 });
      const azureName = parseResult(searchResult).data.matches[0].name;

      const result = await handlers["batch-add-cells-of-shape"]({
        cells: [
          { shape_name: azureName, x: 100, y: 100 },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.results[0].info).toContain("Azure icon");
    });

    it("should handle mixed success and failure in batch", async () => {
      const result = await handlers["batch-add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 100, y: 100 },
          { shape_name: "xyznonexistent_shape", x: 200, y: 200 },
          { shape_name: "decision", x: 300, y: 300 },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
      expect(parsed.data.summary.failed).toBe(1);
      expect(parsed.data.success).toBe(false);
      expect(parsed.data.results[1].success).toBe(false);
      expect(parsed.data.results[1].error).toContain("Unknown shape");
    });

    it("should use custom dimensions over shape defaults", async () => {
      const result = await handlers["batch-add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 50, y: 50, width: 400, height: 200, text: "Big", style: "fillColor=#ff0000;" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.results[0].cell.width).toBe(400);
      expect(parsed.data.results[0].cell.height).toBe(200);
      expect(parsed.data.results[0].cell.value).toBe("Big");
      expect(parsed.data.results[0].cell.style).toBe("fillColor=#ff0000;");
    });
  });

  describe("search-shapes", () => {
    it("should find shapes with single query", async () => {
      const result = await handlers["search-shapes"]({ query: "storage" });
      const parsed = parseResult(result);
      expect(parsed.data.matches.length).toBeGreaterThan(0);
    });

    it("should support batch queries", async () => {
      const result = await handlers["search-shapes"]({
        queries: ["storage", "compute"],
      });
      const parsed = parseResult(result);
      expect(parsed.data.batch).toBe(true);
      expect(parsed.data.results).toHaveLength(2);
    });

    it("should error when neither query nor queries provided", async () => {
      const result = await handlers["search-shapes"]({});
      expect(result.isError).toBe(true);
    });

    it("should error when both query and queries provided", async () => {
      const result = await handlers["search-shapes"]({
        query: "x",
        queries: ["y"],
      });
      expect(result.isError).toBe(true);
    });

    it("should respect custom limit", async () => {
      const result = await handlers["search-shapes"]({ query: "azure", limit: 3 });
      const parsed = parseResult(result);
      expect(parsed.data.matches.length).toBeLessThanOrEqual(3);
    });
  });

  describe("get-style-presets", () => {
    it("should return preset categories", async () => {
      const result = await handlers["get-style-presets"]();
      const parsed = parseResult(result);
      expect(parsed.data.presets).toHaveProperty("azure");
      expect(parsed.data.presets).toHaveProperty("flowchart");
      expect(parsed.data.presets).toHaveProperty("general");
      expect(parsed.data.presets).toHaveProperty("edges");
    });
  });

  describe("set-cell-shape", () => {
    it("should update a cell's style to match a shape", async () => {
      const r = await handlers["add-rectangle"]({ text: "Test" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["set-cell-shape"]({
        cell_id: cellId,
        shape_name: "decision",
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.style).toContain("rhombus");
    });

    it("should support batch cell-shape updates", async () => {
      const r1 = await handlers["add-rectangle"]({ text: "A" });
      const r2 = await handlers["add-rectangle"]({ text: "B" });
      const id1 = parseResult(r1).data.cell.id;
      const id2 = parseResult(r2).data.cell.id;

      const result = await handlers["set-cell-shape"]({
        cells: [
          { cell_id: id1, shape_name: "ellipse" },
          { cell_id: id2, shape_name: "circle" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(2);
    });

    it("should error when no arguments provided", async () => {
      const result = await handlers["set-cell-shape"]({});
      expect(result.isError).toBe(true);
    });

    it("should error when both single and batch params provided", async () => {
      const r = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["set-cell-shape"]({
        cell_id: cellId,
        shape_name: "decision",
        cells: [{ cell_id: cellId, shape_name: "ellipse" }],
      });
      expect(result.isError).toBe(true);
    });

    it("should error for unknown single shape name", async () => {
      const r = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["set-cell-shape"]({
        cell_id: cellId,
        shape_name: "xyznonexistent",
      });
      expect(result.isError).toBe(true);
    });

    it("should report errors for unknown shapes in batch", async () => {
      const r = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(r).data.cell.id;

      const result = await handlers["set-cell-shape"]({
        cells: [
          { cell_id: cellId, shape_name: "xyznonexistent" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.failed).toBe(1);
    });

    it("should report errors for non-existent cell in batch", async () => {
      const result = await handlers["set-cell-shape"]({
        cells: [
          { cell_id: "nonexistent", shape_name: "rectangle" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.failed).toBe(1);
    });

    it("should error for non-existent cell in single mode", async () => {
      const result = await handlers["set-cell-shape"]({
        cell_id: "nonexistent",
        shape_name: "rectangle",
      });
      expect(result.isError).toBe(true);
    });
  });
});
