import { DiagramModel } from "../src/diagram_model.js";

describe("DiagramModel groups", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("createGroup", () => {
    it("should create a group with default properties", () => {
      const group = model.createGroup({});
      expect(group.type).toBe("vertex");
      expect(group.isGroup).toBe(true);
      expect(group.children).toEqual([]);
      expect(group.width).toBe(400);
      expect(group.height).toBe(300);
      expect(group.style).toContain("container=1");
    });

    it("should create a group with custom properties", () => {
      const group = model.createGroup({
        x: 50,
        y: 75,
        width: 600,
        height: 400,
        text: "VNet",
        style: "fillColor=#e6f2fa;strokeColor=#0078d4;",
      });
      expect(group.x).toBe(50);
      expect(group.y).toBe(75);
      expect(group.width).toBe(600);
      expect(group.height).toBe(400);
      expect(group.value).toBe("VNet");
      expect(group.style).toBe("fillColor=#e6f2fa;strokeColor=#0078d4;");
    });

    it("should be retrievable as a regular cell", () => {
      const group = model.createGroup({ text: "My Group" });
      const cell = model.getCell(group.id);
      expect(cell).toBeDefined();
      expect(cell!.isGroup).toBe(true);
    });

    it("should appear in listCells", () => {
      model.createGroup({ text: "G1" });
      model.addRectangle({ text: "R1" });
      const cells = model.listCells();
      expect(cells).toHaveLength(2);
    });
  });

  describe("addCellToGroup", () => {
    it("should add a cell to a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      const result = model.addCellToGroup(cell.id, group.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.parent).toBe(group.id);
      }
    });

    it("should add cell ID to group's children list", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      expect(group.children).toContain(cell.id);
    });

    it("should not duplicate child IDs", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      model.addCellToGroup(cell.id, group.id); // duplicate
      expect(group.children!.filter(id => id === cell.id)).toHaveLength(1);
    });

    it("should return error for non-existent cell", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup("nonexistent", group.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("CELL_NOT_FOUND");
      }
    });

    it("should return error for non-existent group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.addCellToGroup(cell.id, "nonexistent");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("GROUP_NOT_FOUND");
      }
    });

    it("should return error when target is not a group", () => {
      const cell1 = model.addRectangle({ text: "A" });
      const cell2 = model.addRectangle({ text: "B" });
      const result = model.addCellToGroup(cell1.id, cell2.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("NOT_A_GROUP");
      }
    });

    it("should return error when adding group to itself", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup(group.id, group.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("SELF_REFERENCE");
      }
    });

    it("should initialize children array when it is undefined", () => {
      const group = model.createGroup({ text: "G" });
      // Manually delete the children array to test the defensive branch
      delete (group as any).children;
      const cell = model.addRectangle({ text: "A" });

      const result = model.addCellToGroup(cell.id, group.id);
      expect("error" in result).toBe(false);
      // children should have been re-created
      expect(group.children).toContain(cell.id);
    });
  });

  describe("removeCellFromGroup", () => {
    it("should remove a cell from its group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(cell.id, group.id);

      const result = model.removeCellFromGroup(cell.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.parent).toBe("1"); // Back to default layer
      }
      expect(group.children).not.toContain(cell.id);
    });

    it("should return error for non-existent cell", () => {
      const result = model.removeCellFromGroup("nonexistent");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("CELL_NOT_FOUND");
      }
    });

    it("should return error when cell is not in a group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.removeCellFromGroup(cell.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("NOT_IN_GROUP");
      }
    });
  });

  describe("listGroupChildren", () => {
    it("should list children of a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const c1 = model.addRectangle({ text: "Subnet A" });
      const c2 = model.addRectangle({ text: "Subnet B" });
      model.addCellToGroup(c1.id, group.id);
      model.addCellToGroup(c2.id, group.id);

      const result = model.listGroupChildren(group.id);
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
        expect(result.map(c => c.value)).toContain("Subnet A");
        expect(result.map(c => c.value)).toContain("Subnet B");
      }
    });

    it("should return empty array for group with no children", () => {
      const group = model.createGroup({ text: "Empty" });
      const result = model.listGroupChildren(group.id);
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(0);
      }
    });

    it("should return error for non-existent group", () => {
      const result = model.listGroupChildren("nonexistent");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("GROUP_NOT_FOUND");
      }
    });

    it("should return error when cell is not a group", () => {
      const cell = model.addRectangle({ text: "Not a group" });
      const result = model.listGroupChildren(cell.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("NOT_A_GROUP");
      }
    });

    it("should handle removed children gracefully", () => {
      const group = model.createGroup({ text: "G" });
      const cell = model.addRectangle({ text: "C" });
      model.addCellToGroup(cell.id, group.id);
      // Delete the child cell directly
      model.deleteCell(cell.id);

      const result = model.listGroupChildren(group.id);
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        // The child was deleted, so it shouldn't appear
        expect(result).toHaveLength(0);
      }
    });
  });

  describe("toXml with groups", () => {
    it("should render group cells with connectable attribute", () => {
      const group = model.createGroup({ text: "Container" });
      model.addRectangle({ text: "Child" });

      const xml = model.toXml();
      expect(xml).toContain(`id="${group.id}"`);
      expect(xml).toContain('connectable="0"');
      expect(xml).toContain("container=1");
    });

    it("should render children with group as parent", () => {
      const group = model.createGroup({ text: "VNet" });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const xml = model.toXml();
      // The child cell's parent should be the group ID
      expect(xml).toContain(`parent="${group.id}"`);
    });

    it("should not duplicate container=1 in style if already present", () => {
      const group = model.createGroup({}); // default style includes container=1
      const xml = model.toXml();
      const styleMatch = xml.match(new RegExp(`id="${group.id}"[^>]*style="([^"]*)"`));
      expect(styleMatch).not.toBeNull();
      if (styleMatch) {
        const occurrences = (styleMatch[1].match(/container=1/g) || []).length;
        expect(occurrences).toBe(1);
      }
    });

    it("should append container=1 to group style if not present", () => {
      // Custom style without container=1
      model.createGroup({ text: "VNet", style: "fillColor=#e6f2fa;strokeColor=#0078d4;" });
      const xml = model.toXml();
      expect(xml).toContain("fillColor=#e6f2fa;strokeColor=#0078d4;container=1;");
    });
  });

  describe("getStats includes group count", () => {
    it("should report group count", () => {
      model.createGroup({ text: "G1" });
      model.createGroup({ text: "G2" });
      model.addRectangle({ text: "R1" });

      const stats = model.getStats();
      expect(stats.groups).toBe(2);
      expect(stats.vertices).toBe(3); // Groups are also vertices
    });
  });
});
