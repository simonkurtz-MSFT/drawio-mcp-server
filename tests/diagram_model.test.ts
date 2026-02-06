import { DiagramModel } from "../src/diagram_model.js";

describe("DiagramModel", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("toXml", () => {
    it("should include the default layer in XML output", () => {
      const xml = model.toXml();
      expect(xml).toContain('<mxCell id="0"/>');
      expect(xml).toContain('<mxCell id="1" parent="0"/>');
    });

    it("should include custom layers as mxCell elements in XML output", () => {
      const layer = model.createLayer("Network");
      const xml = model.toXml();
      expect(xml).toContain(`<mxCell id="${layer.id}" value="Network" style="" parent="0"/>`);
    });

    it("should include multiple custom layers in XML output", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");
      const xml = model.toXml();
      expect(xml).toContain(`<mxCell id="${layer1.id}" value="Network" style="" parent="0"/>`);
      expect(xml).toContain(`<mxCell id="${layer2.id}" value="Security" style="" parent="0"/>`);
    });

    it("should render cells assigned to custom layers with correct parent", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      const cell = model.addRectangle({ text: "In Custom Layer" });
      const xml = model.toXml();
      expect(xml).toContain(`parent="${layer.id}"`);
      expect(xml).toContain(`id="${cell.id}"`);
    });

    it("should escape special characters in layer names", () => {
      model.createLayer("Layer <1> & \"test\"");
      const xml = model.toXml();
      expect(xml).toContain("Layer &lt;1&gt; &amp; &quot;test&quot;");
    });

    it("should produce valid XML with no custom layers", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      expect(xml).toContain('<mxCell id="0"/>');
      expect(xml).toContain('<mxCell id="1" parent="0"/>');
      expect(xml).toContain('value="Hello"');
    });
  });

  describe("addRectangle", () => {
    it("should create a cell with defaults", () => {
      const cell = model.addRectangle({});
      expect(cell.type).toBe("vertex");
      expect(cell.value).toBe("New Cell");
      expect(cell.width).toBe(200);
      expect(cell.height).toBe(100);
    });

    it("should accept custom dimensions", () => {
      const cell = model.addRectangle({ width: 48, height: 48, text: "Icon" });
      expect(cell.width).toBe(48);
      expect(cell.height).toBe(48);
      expect(cell.value).toBe("Icon");
    });
  });

  describe("addEdge", () => {
    it("should error when source does not exist", () => {
      model.addRectangle({ text: "Target" });
      const result = model.addEdge({ sourceId: "nonexistent", targetId: "cell-2" });
      expect("error" in result).toBe(true);
    });

    it("should create edge between existing cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        expect(edge.type).toBe("edge");
      }
    });
  });

  describe("batchAddCells", () => {
    it("should resolve temp IDs for edges within the batch", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });
  });

  describe("clear", () => {
    it("should remove all cells", () => {
      model.addRectangle({ text: "A" });
      model.addRectangle({ text: "B" });
      expect(model.listCells()).toHaveLength(2);
      model.clear();
      expect(model.listCells()).toHaveLength(0);
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty diagram", () => {
      const stats = model.getStats();
      expect(stats.total_cells).toBe(0);
      expect(stats.vertices).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.layers).toBe(1); // Default layer
      expect(stats.bounds).toBeNull();
      expect(stats.cells_with_text).toBe(0);
      expect(stats.cells_without_text).toBe(0);
    });

    it("should return correct stats for diagram with cells", () => {
      model.addRectangle({ text: "A", x: 100, y: 100, width: 200, height: 100 });
      model.addRectangle({ text: "B", x: 400, y: 200, width: 150, height: 80 });
      model.addRectangle({ text: "", x: 50, y: 50, width: 100, height: 100 }); // No text

      const stats = model.getStats();
      expect(stats.total_cells).toBe(3);
      expect(stats.vertices).toBe(3);
      expect(stats.edges).toBe(0);
      expect(stats.cells_with_text).toBe(2);
      expect(stats.cells_without_text).toBe(1);
      expect(stats.bounds).toEqual({
        minX: 50,
        minY: 50,
        maxX: 550, // 400 + 150
        maxY: 280, // 200 + 80
      });
    });

    it("should count edges correctly", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });

      const stats = model.getStats();
      expect(stats.total_cells).toBe(3);
      expect(stats.vertices).toBe(2);
      expect(stats.edges).toBe(1);
      expect(stats.cells_with_text).toBe(3);
    });

    it("should track cells by layer", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");

      model.addRectangle({ text: "Default" }); // Added to default layer

      model.setActiveLayer(layer1.id);
      model.addRectangle({ text: "Net1" });
      model.addRectangle({ text: "Net2" });

      model.setActiveLayer(layer2.id);
      model.addRectangle({ text: "Sec1" });

      const stats = model.getStats();
      expect(stats.total_cells).toBe(4);
      expect(stats.layers).toBe(3);
      expect(stats.cells_by_layer["1"]).toBe(1); // Default layer
      expect(stats.cells_by_layer[layer1.id]).toBe(2);
      expect(stats.cells_by_layer[layer2.id]).toBe(1);
    });
  });
});
