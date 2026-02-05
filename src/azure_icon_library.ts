/**
 * Azure Icon Library Loader
 * Loads and parses the complete Azure architecture icons from the dwarfered repository
 * https://github.com/dwarfered/azure-architecture-icons-for-drawio
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Define __dirname for ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AzureIconShape {
  id: string;
  title: string;
  width: number;
  height: number;
  xml: string; // Full mxGraphModel XML
  style?: string; // Draw.io style string (if extracted)
}

export interface AzureIconLibrary {
  shapes: AzureIconShape[];
  categories: Map<string, AzureIconShape[]>;
  indexByTitle: Map<string, AzureIconShape>;
}

/**
 * Parse the Azure icon library XML file
 * The library format is: <mxlibrary>[{xml, title, ...}, ...]</mxlibrary>
 */
function parseLibraryXml(xmlContent: string): AzureIconShape[] {
  try {
    // Extract JSON array from mxlibrary XML
    const match = xmlContent.match(/<mxlibrary>\[(.*)\]<\/mxlibrary>/s);
    if (!match) {
      console.warn("No mxlibrary found in XML");
      return [];
    }

    const jsonStr = "[" + match[1] + "]";
    const parsed = JSON.parse(jsonStr) as any[];

    return parsed.map((item, index) => {
      // Decode the embedded XML if it's URL-encoded
      let xml = item.xml || "";
      if (xml.startsWith("&lt;")) {
        xml = xml
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&");
      }

      // Sanitize title - remove null bytes and extra whitespace
      const rawTitle = (item.title || `shape-${index}`).trim();
      const title = rawTitle.replace(/[^\x20-\x7E]/g, "").trim() || `shape-${index}`;

      // Generate a safe ID from the title
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || `shape-${index}`;

      return {
        id,
        title,
        width: item.w || 48,
        height: item.h || 48,
        xml,
        style: extractStyle(xml),
      };
    });
  } catch (error) {
    console.error("Error parsing library XML:", error);
    return [];
  }
}

/**
 * Extract style string from embedded SVG data URL in the XML
 * The XML contains image attributes with base64-encoded SVG data
 */
function extractStyle(xml: string): string | undefined {
  // Look for image data in the style attribute
  // Pattern: style="...image=data:image/svg+xml,[encoded]..."
  const match = xml.match(/image=(data:image\/svg\+xml[^;")]*)/);

  if (match) {
    const imageData = match[1];
    // Build a style string that includes the image as a data URL
    // with proper escaping for use in Draw.io
    const style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=${imageData}`;
    return style;
  }
  return undefined;
}

/**
 * Categorize icons based on their title patterns
 */
function categorizeShapes(shapes: AzureIconShape[]): Map<string, AzureIconShape[]> {
  const categories = new Map<string, AzureIconShape[]>();

  const categoryKeywords: Record<string, RegExp> = {
    "AI + Machine Learning": /^(cognitive|bot|openai|machine learning|text|speech|vision|anomaly)/i,
    Analytics: /^(synapse|databricks|data factory|stream analytics|event hub)/i,
    "App Services": /^(app service|web app|api app|function)/i,
    Blockchain: /^(blockchain|cosmos db ledger)/i,
    Compute: /^(virtual machine|vm|batch|app service|function|container instance|aks)/i,
    Containers: /^(container|aks|kubernetes|registry)/i,
    Databases: /^(sql|mysql|postgresql|cosmos|cache|redis|database)/i,
    DevOps: /^(azure devops|pipelines|repos|artifacts)/i,
    General: /^(resource group|subscription|management group|azure)/i,
    "Hybrid + Multicloud": /^(azure stack|hybrid|arc)/i,
    Identity: /^(active directory|entra|access|authentication|identity)/i,
    Integration: /^(service bus|logic app|api management|event grid)/i,
    IoT: /^(iot|device|edge)/i,
    "Management + Governance": /^(monitor|log analytics|automation|policy|backup)/i,
    Networking: /^(virtual network|load balancer|application gateway|vpn|firewall|dns|front door|cdn|traffic|network)/i,
    "New Icons": /^(new|latest)/i,
    Security: /^(security|key vault|sentinel|defender)/i,
    Storage: /^(storage|blob|file|disk|queue|table)/i,
    Web: /^(web|app service|static web)/i,
  };

  shapes.forEach((shape) => {
    let categorized = false;

    for (const [category, pattern] of Object.entries(categoryKeywords)) {
      if (pattern.test(shape.title)) {
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(shape);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      if (!categories.has("Other")) {
        categories.set("Other", []);
      }
      categories.get("Other")!.push(shape);
    }
  });

  return categories;
}

/**
 * Load and parse the Azure icon library
 */
export function loadAzureIconLibrary(libraryPath?: string): AzureIconLibrary {
  // Try multiple possible paths to locate the icon library
  const possiblePaths = [
    // ESM __dirname based path (from src/)
    path.join(__dirname, "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From build/ directory
    path.join(__dirname, "..", "..", "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
    // From project root (cwd)
    path.join(process.cwd(), "assets", "azure-public-service-icons", "000 all azure public service icons.xml"),
  ];

  const filePath = libraryPath || possiblePaths.find(p => fs.existsSync(p));

  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`Azure icon library not found. Tried paths:`, possiblePaths);
    console.warn(`Current working directory: ${process.cwd()}`);
    console.warn(`__dirname: ${__dirname}`);
    return {
      shapes: [],
      categories: new Map(),
      indexByTitle: new Map(),
    };
  }

  console.log(`Loading Azure icon library from: ${filePath}`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const shapes = parseLibraryXml(content);
    const categories = categorizeShapes(shapes);

    const indexByTitle = new Map<string, AzureIconShape>();
    shapes.forEach((shape) => {
      indexByTitle.set(shape.title.toLowerCase(), shape);
      indexByTitle.set(shape.id.toLowerCase(), shape);
    });

    return {
      shapes,
      categories,
      indexByTitle,
    };
  } catch (error) {
    console.error(`Error loading Azure icon library from ${filePath}:`, error);
    return {
      shapes: [],
      categories: new Map(),
      indexByTitle: new Map(),
    };
  }
}

/**
 * Get library from cache (singleton pattern)
 */
let cachedLibrary: AzureIconLibrary | null = null;

export function getAzureIconLibrary(): AzureIconLibrary {
  if (!cachedLibrary) {
    cachedLibrary = loadAzureIconLibrary();
  }
  return cachedLibrary;
}

/**
 * Search for icons by title or keyword
 */
export function searchAzureIcons(query: string, limit = 10): AzureIconShape[] {
  const library = getAzureIconLibrary();
  const lowerQuery = query.toLowerCase();

  return library.shapes
    .filter((shape) => shape.title.toLowerCase().includes(lowerQuery) || shape.id.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}

/**
 * Get all categories
 */
export function getAzureCategories(): string[] {
  const library = getAzureIconLibrary();
  return Array.from(library.categories.keys()).sort();
}

/**
 * Get shapes in a category
 */
export function getShapesInCategory(category: string): AzureIconShape[] {
  const library = getAzureIconLibrary();
  return library.categories.get(category) || [];
}

/**
 * Get a specific shape by title or ID
 */
export function getAzureShapeByName(name: string): AzureIconShape | undefined {
  const library = getAzureIconLibrary();
  return library.indexByTitle.get(name.toLowerCase());
}
