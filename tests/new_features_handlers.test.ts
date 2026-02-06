import { describe, it, expect, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers } from "../src/tools.js";
import { diagram } from "../src/diagram_model.js";

function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return JSON.parse(content.text);
}

beforeEach(() => {
  diagram.clear();
});

describe("multi-page tool handlers", () => {
  describe("create-page", () => {
    it("should create a new page", async () => {
      const result = await handlers["create-page"]({ name: "Details" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("Details");
      expect(parsed.data.page.id).toBe("page-2");
    });
  });

  describe("list-pages", () => {
    it("should list all pages including active", async () => {
      await handlers["create-page"]({ name: "Extra" });
      const result = await handlers["list-pages"]();
      const parsed = parseResult(result);
      expect(parsed.data.pages).toHaveLength(2);
      expect(parsed.data.active_page.id).toBe("page-1");
    });
  });

  describe("get-active-page", () => {
    it("should return the active page", async () => {
      const result = await handlers["get-active-page"]();
      const parsed = parseResult(result);
      expect(parsed.data.page.name).toBe("Page-1");
    });
  });

  describe("set-active-page", () => {
    it("should switch pages", async () => {
      const createResult = await handlers["create-page"]({ name: "P2" });
      const pageId = parseResult(createResult).data.page.id;

      const result = await handlers["set-active-page"]({ page_id: pageId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("P2");
    });

    it("should return error for non-existent page", async () => {
      const result = await handlers["set-active-page"]({ page_id: "nonexistent" });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("PAGE_NOT_FOUND");
    });

    it("should isolate cells between pages", async () => {
      await handlers["add-rectangle"]({ text: "P1 Cell" });

      const createResult = await handlers["create-page"]({ name: "P2" });
      const pageId = parseResult(createResult).data.page.id;
      await handlers["set-active-page"]({ page_id: pageId });

      // Page 2 should be empty
      const statsResult = await handlers["get-diagram-stats"]();
      const stats = parseResult(statsResult).data.stats;
      expect(stats.total_cells).toBe(0);

      // Add to page 2
      await handlers["add-rectangle"]({ text: "P2 Cell" });

      // Switch back to page 1
      await handlers["set-active-page"]({ page_id: "page-1" });
      const statsResult2 = await handlers["get-diagram-stats"]();
      const stats2 = parseResult(statsResult2).data.stats;
      expect(stats2.total_cells).toBe(1);
    });
  });

  describe("rename-page", () => {
    it("should rename a page", async () => {
      const result = await handlers["rename-page"]({ page_id: "page-1", name: "Overview" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("Overview");
    });

    it("should return error for non-existent page", async () => {
      const result = await handlers["rename-page"]({ page_id: "nonexistent", name: "X" });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete-page", () => {
    it("should delete a page", async () => {
      await handlers["create-page"]({ name: "Deletable" });
      const result = await handlers["delete-page"]({ page_id: "page-2" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.deleted).toBe(true);
      expect(parsed.data.remaining_pages).toHaveLength(1);
    });

    it("should error when deleting the last page", async () => {
      const result = await handlers["delete-page"]({ page_id: "page-1" });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("CANNOT_DELETE_LAST_PAGE");
    });

    it("should error for non-existent page", async () => {
      await handlers["create-page"]({ name: "Extra" });
      const result = await handlers["delete-page"]({ page_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });
  });
});

describe("group tool handlers", () => {
  describe("create-group", () => {
    it("should create a group with defaults", async () => {
      const result = await handlers["create-group"]({});
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.isGroup).toBe(true);
      expect(parsed.data.cell.width).toBe(400);
    });

    it("should create a group with custom properties", async () => {
      const result = await handlers["create-group"]({
        x: 50,
        y: 75,
        width: 600,
        height: 400,
        text: "VNet",
        style: "fillColor=#e6f2fa;",
      });
      const parsed = parseResult(result);
      expect(parsed.data.cell.value).toBe("VNet");
      expect(parsed.data.cell.width).toBe(600);
    });
  });

  describe("batch-create-groups", () => {
    it("should create multiple groups in one call", async () => {
      const result = await handlers["batch-create-groups"]({
        groups: [
          { text: "VNet", width: 600, height: 400, temp_id: "vnet" },
          { text: "Subnet A", x: 50, y: 50, width: 250, height: 200, temp_id: "subnet-a" },
          { text: "Subnet B", x: 320, y: 50, width: 250, height: 200, temp_id: "subnet-b" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.total).toBe(3);
      expect(parsed.data.summary.succeeded).toBe(3);
      expect(parsed.data.summary.failed).toBe(0);
      expect(parsed.data.results).toHaveLength(3);
      expect(parsed.data.results[0].cell.isGroup).toBe(true);
      expect(parsed.data.results[0].cell.value).toBe("VNet");
      expect(parsed.data.results[0].temp_id).toBe("vnet");
      expect(parsed.data.results[1].temp_id).toBe("subnet-a");
    });

    it("should return error for empty groups array", async () => {
      const result = await handlers["batch-create-groups"]({
        groups: [],
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("INVALID_INPUT");
    });

    it("should create groups with default properties", async () => {
      const result = await handlers["batch-create-groups"]({
        groups: [{}],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.results[0].cell.width).toBe(400);
      expect(parsed.data.results[0].cell.height).toBe(300);
    });
  });

  describe("add-cell-to-group", () => {
    it("should add a cell to a group", async () => {
      const groupResult = await handlers["create-group"]({ text: "VNet" });
      const groupId = parseResult(groupResult).data.cell.id;

      const cellResult = await handlers["add-rectangle"]({ text: "Subnet" });
      const cellId = parseResult(cellResult).data.cell.id;

      const result = await handlers["add-cell-to-group"]({
        cell_id: cellId,
        group_id: groupId,
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.parent).toBe(groupId);
    });

    it("should error for non-existent cell", async () => {
      const groupResult = await handlers["create-group"]({ text: "G" });
      const groupId = parseResult(groupResult).data.cell.id;

      const result = await handlers["add-cell-to-group"]({
        cell_id: "nonexistent",
        group_id: groupId,
      });
      expect(result.isError).toBe(true);
    });

    it("should error for non-existent group", async () => {
      const cellResult = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(cellResult).data.cell.id;

      const result = await handlers["add-cell-to-group"]({
        cell_id: cellId,
        group_id: "nonexistent",
      });
      expect(result.isError).toBe(true);
    });

    it("should error when target is not a group", async () => {
      const cellResult = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(cellResult).data.cell.id;
      const cell2Result = await handlers["add-rectangle"]({ text: "B" });
      const cell2Id = parseResult(cell2Result).data.cell.id;

      const result = await handlers["add-cell-to-group"]({
        cell_id: cellId,
        group_id: cell2Id,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("batch-add-cells-to-group", () => {
    it("should assign multiple cells to groups in one call", async () => {
      const g1 = await handlers["create-group"]({ text: "Group 1" });
      const g1Id = parseResult(g1).data.cell.id;
      const g2 = await handlers["create-group"]({ text: "Group 2" });
      const g2Id = parseResult(g2).data.cell.id;

      const c1 = await handlers["add-rectangle"]({ text: "A" });
      const c1Id = parseResult(c1).data.cell.id;
      const c2 = await handlers["add-rectangle"]({ text: "B" });
      const c2Id = parseResult(c2).data.cell.id;
      const c3 = await handlers["add-rectangle"]({ text: "C" });
      const c3Id = parseResult(c3).data.cell.id;

      const result = await handlers["batch-add-cells-to-group"]({
        assignments: [
          { cell_id: c1Id, group_id: g1Id },
          { cell_id: c2Id, group_id: g1Id },
          { cell_id: c3Id, group_id: g2Id },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.total).toBe(3);
      expect(parsed.data.summary.succeeded).toBe(3);
      expect(parsed.data.summary.failed).toBe(0);
      expect(parsed.data.results[0].cell.parent).toBe(g1Id);
      expect(parsed.data.results[2].cell.parent).toBe(g2Id);
    });

    it("should return error for empty assignments array", async () => {
      const result = await handlers["batch-add-cells-to-group"]({
        assignments: [],
      });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("INVALID_INPUT");
    });

    it("should handle mixed success and failure", async () => {
      const g = await handlers["create-group"]({ text: "Group" });
      const gId = parseResult(g).data.cell.id;
      const c = await handlers["add-rectangle"]({ text: "A" });
      const cId = parseResult(c).data.cell.id;

      const result = await handlers["batch-add-cells-to-group"]({
        assignments: [
          { cell_id: cId, group_id: gId },
          { cell_id: "nonexistent", group_id: gId },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.summary.failed).toBe(1);
      expect(parsed.data.results[0].success).toBe(true);
      expect(parsed.data.results[1].success).toBe(false);
      expect(parsed.data.results[1].error.code).toBe("CELL_NOT_FOUND");
    });

    it("should report cell_id and group_id in results", async () => {
      const g = await handlers["create-group"]({ text: "G" });
      const gId = parseResult(g).data.cell.id;
      const c = await handlers["add-rectangle"]({ text: "A" });
      const cId = parseResult(c).data.cell.id;

      const result = await handlers["batch-add-cells-to-group"]({
        assignments: [{ cell_id: cId, group_id: gId }],
      });
      const parsed = parseResult(result);
      expect(parsed.data.results[0].cell_id).toBe(cId);
      expect(parsed.data.results[0].group_id).toBe(gId);
    });
  });

  describe("remove-cell-from-group", () => {
    it("should remove a cell from its group", async () => {
      const groupResult = await handlers["create-group"]({ text: "G" });
      const groupId = parseResult(groupResult).data.cell.id;
      const cellResult = await handlers["add-rectangle"]({ text: "C" });
      const cellId = parseResult(cellResult).data.cell.id;
      await handlers["add-cell-to-group"]({ cell_id: cellId, group_id: groupId });

      const result = await handlers["remove-cell-from-group"]({ cell_id: cellId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.parent).toBe("1"); // Back to default layer
    });

    it("should error for non-existent cell", async () => {
      const result = await handlers["remove-cell-from-group"]({ cell_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should error when cell is not in a group", async () => {
      const cellResult = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(cellResult).data.cell.id;

      const result = await handlers["remove-cell-from-group"]({ cell_id: cellId });
      expect(result.isError).toBe(true);
    });
  });

  describe("list-group-children", () => {
    it("should list children of a group", async () => {
      const groupResult = await handlers["create-group"]({ text: "G" });
      const groupId = parseResult(groupResult).data.cell.id;
      const c1 = await handlers["add-rectangle"]({ text: "A" });
      const c2 = await handlers["add-rectangle"]({ text: "B" });
      const c1Id = parseResult(c1).data.cell.id;
      const c2Id = parseResult(c2).data.cell.id;
      await handlers["add-cell-to-group"]({ cell_id: c1Id, group_id: groupId });
      await handlers["add-cell-to-group"]({ cell_id: c2Id, group_id: groupId });

      const result = await handlers["list-group-children"]({ group_id: groupId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.total).toBe(2);
      expect(parsed.data.children).toHaveLength(2);
    });

    it("should error for non-existent group", async () => {
      const result = await handlers["list-group-children"]({ group_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should error when cell is not a group", async () => {
      const cellResult = await handlers["add-rectangle"]({ text: "A" });
      const cellId = parseResult(cellResult).data.cell.id;

      const result = await handlers["list-group-children"]({ group_id: cellId });
      expect(result.isError).toBe(true);
    });
  });
});

describe("import-diagram handler", () => {
  it("should import valid Draw.io XML", async () => {
    const xml = `<mxfile host="test">
    <diagram id="d1" name="Test">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="2" value="Imported" style="" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    const result = await handlers["import-diagram"]({ xml });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.pages).toBe(1);
    expect(parsed.data.cells).toBe(1);
    expect(parsed.data.message).toContain("Imported");
  });

  it("should return error for empty XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("EMPTY_XML");
  });

  it("should return error for invalid XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "<html></html>" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("INVALID_XML");
  });

  it("should import multi-page XML", async () => {
    const xml = `<mxfile host="test">
    <diagram id="p1" name="Overview">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="10" value="A" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
    <diagram id="p2" name="Details">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="20" value="B" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    const result = await handlers["import-diagram"]({ xml });
    const parsed = parseResult(result);
    expect(parsed.data.pages).toBe(2);
    expect(parsed.data.cells).toBe(2);
  });

  it("should allow modifications after import", async () => {
    const xml = `<mxfile host="test">
    <diagram id="d1" name="Test">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="2" value="Existing" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    await handlers["import-diagram"]({ xml });

    // Should be able to add new cells after import
    const addResult = await handlers["add-rectangle"]({ text: "New Cell" });
    const parsed = parseResult(addResult);
    expect(parsed.success).toBe(true);

    // Should now have 2 cells
    const statsResult = await handlers["get-diagram-stats"]();
    const stats = parseResult(statsResult).data.stats;
    expect(stats.total_cells).toBe(2);
  });
});

describe("batch-create-groups handler", () => {
  it("should create multiple groups in one call", async () => {
    const result = await handlers["batch-create-groups"]({
      groups: [
        { x: 0, y: 0, width: 400, height: 300, text: "VNet A", temp_id: "vnet-a" },
        { x: 500, y: 0, width: 400, height: 300, text: "VNet B", temp_id: "vnet-b" },
      ],
    });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.summary.total).toBe(2);
    expect(parsed.data.summary.succeeded).toBe(2);
    expect(parsed.data.summary.failed).toBe(0);
    expect(parsed.data.results[0].cell.isGroup).toBe(true);
    expect(parsed.data.results[0].cell.value).toBe("VNet A");
    expect(parsed.data.results[0].temp_id).toBe("vnet-a");
    expect(parsed.data.results[1].cell.value).toBe("VNet B");
    expect(parsed.data.results[1].temp_id).toBe("vnet-b");
  });

  it("should return error for empty groups array", async () => {
    const result = await handlers["batch-create-groups"]({ groups: [] });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("INVALID_INPUT");
  });

  it("should create groups with default properties", async () => {
    const result = await handlers["batch-create-groups"]({
      groups: [{}],
    });
    const parsed = parseResult(result);
    expect(parsed.data.summary.succeeded).toBe(1);
    expect(parsed.data.results[0].cell.isGroup).toBe(true);
    expect(parsed.data.results[0].cell.width).toBe(400);
    expect(parsed.data.results[0].cell.height).toBe(300);
  });
});

describe("batch-add-cells-to-group handler", () => {
  it("should assign multiple cells to groups in one call", async () => {
    const groupResult = await handlers["create-group"]({ text: "G" });
    const groupId = parseResult(groupResult).data.cell.id;

    const c1 = await handlers["add-rectangle"]({ text: "A" });
    const c2 = await handlers["add-rectangle"]({ text: "B" });
    const c1Id = parseResult(c1).data.cell.id;
    const c2Id = parseResult(c2).data.cell.id;

    const result = await handlers["batch-add-cells-to-group"]({
      assignments: [
        { cell_id: c1Id, group_id: groupId },
        { cell_id: c2Id, group_id: groupId },
      ],
    });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.summary.total).toBe(2);
    expect(parsed.data.summary.succeeded).toBe(2);
    expect(parsed.data.summary.failed).toBe(0);
    expect(parsed.data.results[0].success).toBe(true);
    expect(parsed.data.results[0].cell.parent).toBe(groupId);
  });

  it("should return error for empty assignments array", async () => {
    const result = await handlers["batch-add-cells-to-group"]({ assignments: [] });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("INVALID_INPUT");
  });

  it("should report mixed success and failure", async () => {
    const groupResult = await handlers["create-group"]({ text: "G" });
    const groupId = parseResult(groupResult).data.cell.id;
    const c1 = await handlers["add-rectangle"]({ text: "A" });
    const c1Id = parseResult(c1).data.cell.id;

    const result = await handlers["batch-add-cells-to-group"]({
      assignments: [
        { cell_id: c1Id, group_id: groupId },
        { cell_id: "nonexistent", group_id: groupId },
      ],
    });
    const parsed = parseResult(result);
    expect(parsed.data.summary.succeeded).toBe(1);
    expect(parsed.data.summary.failed).toBe(1);
    expect(parsed.data.results[1].success).toBe(false);
    expect(parsed.data.results[1].error.code).toBe("CELL_NOT_FOUND");
  });
});
