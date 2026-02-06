import {
  loadAzureIconLibrary,
  getAzureIconLibrary,
  searchAzureIcons,
  getAzureCategories,
  getShapesInCategory,
  getAzureShapeByName,
} from "../src/shapes/azure_icon_library.js";
import type { AzureIconLibrary } from "../src/shapes/azure_icon_library.js";

// Load library once for all tests
let library: AzureIconLibrary;

beforeAll(() => {
  library = loadAzureIconLibrary();
});

describe("loadAzureIconLibrary", () => {
  test("loads shapes from the XML file", () => {
    expect(library.shapes.length).toBeGreaterThan(0);
  });

  test("each shape has required fields", () => {
    for (const shape of library.shapes) {
      expect(shape.id).toBeTruthy();
      expect(shape.title).toBeTruthy();
      expect(shape.width).toBeGreaterThan(0);
      expect(shape.height).toBeGreaterThan(0);
      expect(shape.xml).toBeTruthy();
    }
  });

  test("builds indexByTitle for lookup", () => {
    expect(library.indexByTitle.size).toBeGreaterThan(0);
  });

  test("returns empty library for non-existent path", () => {
    const empty = loadAzureIconLibrary("/non/existent/path.xml");
    expect(empty.shapes).toHaveLength(0);
    expect(empty.categories.size).toBe(0);
    expect(empty.indexByTitle.size).toBe(0);
  });
});

describe("categorizeShapes", () => {
  test("every shape is categorized (no Other category)", () => {
    const otherShapes = library.categories.get("Other") || [];
    expect(otherShapes).toHaveLength(0);
  });

  test("total categorized shapes equals total shapes", () => {
    let total = 0;
    for (const shapes of library.categories.values()) {
      total += shapes.length;
    }
    expect(total).toBe(library.shapes.length);
  });

  test("no shape object appears in more than one category", () => {
    const seen = new Set<object>();
    for (const [, shapes] of library.categories) {
      for (const shape of shapes) {
        expect(seen.has(shape)).toBe(false);
        seen.add(shape);
      }
    }
  });

  test("expected core categories exist", () => {
    const categories = Array.from(library.categories.keys());
    const expected = [
      "AI + Machine Learning",
      "Analytics",
      "Compute",
      "Containers",
      "Databases",
      "DevOps",
      "Identity",
      "Integration",
      "IoT",
      "Management + Governance",
      "Networking",
      "Security",
      "Storage",
      "Web",
    ];
    for (const cat of expected) {
      expect(categories).toContain(cat);
    }
  });

  test("well-known shapes land in expected categories", () => {
    // Clean title helper mirrors the prefix-stripping in categorizeShapes
    const cleanTitle = (title: string) =>
      title.replace(/^\d+-icon-service-/, "").replace(/-/g, " ").trim().toLowerCase();

    const expectations: Record<string, string[]> = {
      Compute: ["virtual machine"],
      Networking: ["virtual network", "load balancer", "firewall"],
      Storage: ["storage", "blob"],
      Databases: ["sql", "cosmos"],
      "AI + Machine Learning": ["cognitive", "machine learning"],
      Containers: ["kubernetes", "container"],
      Security: ["key vault", "sentinel"],
      Web: ["app service"],
    };

    for (const [category, keywords] of Object.entries(expectations)) {
      const shapes = library.categories.get(category);
      expect(shapes).toBeDefined();
      for (const keyword of keywords) {
        const found = shapes!.some((s) => cleanTitle(s.title).includes(keyword));
        expect(found).toBe(true);
      }
    }
  });
});

describe("getAzureIconLibrary (cached singleton)", () => {
  test("returns same instance on repeated calls", () => {
    const a = getAzureIconLibrary();
    const b = getAzureIconLibrary();
    expect(a).toBe(b);
  });
});

describe("getAzureCategories", () => {
  test("returns sorted category names", () => {
    const categories = getAzureCategories();
    expect(categories.length).toBeGreaterThan(0);
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  test("does not include Other", () => {
    const categories = getAzureCategories();
    expect(categories).not.toContain("Other");
  });
});

describe("getShapesInCategory", () => {
  test("returns shapes for a valid category", () => {
    const shapes = getShapesInCategory("Compute");
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0].title).toBeTruthy();
  });

  test("returns empty array for unknown category", () => {
    expect(getShapesInCategory("NonExistentCategory")).toEqual([]);
  });
});

describe("searchAzureIcons", () => {
  test("finds shapes matching a query", () => {
    const results = searchAzureIcons("virtual machine");
    expect(results.length).toBeGreaterThan(0);
  });

  test("respects limit parameter", () => {
    const results = searchAzureIcons("azure", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("returns shapes without internal search fields", () => {
    const results = searchAzureIcons("storage");
    for (const shape of results) {
      expect(shape).not.toHaveProperty("searchTitle");
      expect(shape).not.toHaveProperty("searchId");
    }
  });

  test("returns empty for gibberish query", () => {
    const results = searchAzureIcons("xyzzyqwerty12345");
    expect(results).toHaveLength(0);
  });
});

describe("getAzureShapeByName", () => {
  test("finds shape by exact title (case insensitive)", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.title);
    expect(found).toBeDefined();
    expect(found!.title).toBe(first.title);
  });

  test("finds shape by id", () => {
    const first = library.shapes[0];
    const found = getAzureShapeByName(first.id);
    expect(found).toBeDefined();
  });

  test("returns undefined for unknown name", () => {
    expect(getAzureShapeByName("does-not-exist-at-all")).toBeUndefined();
  });
});
