/**
 * Basic shape definitions used across multiple handlers.
 * Single source of truth for non-Azure shape names and styles.
 */

export interface BasicShape {
  name: string;
  style: string;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * All supported basic shapes, keyed by lowercase canonical name.
 */
export const BASIC_SHAPES: Record<string, BasicShape> = {
  rectangle: {
    name: "rectangle",
    style: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
    defaultWidth: 200,
    defaultHeight: 100,
  },
  rounded: {
    name: "rounded",
    style: "whiteSpace=wrap;html=1;rounded=1;fillColor=#d5e8d4;strokeColor=#82b366;",
    defaultWidth: 200,
    defaultHeight: 100,
  },
  ellipse: {
    name: "ellipse",
    style: "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  diamond: {
    name: "diamond",
    style: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  circle: {
    name: "circle",
    style: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;",
    defaultWidth: 80,
    defaultHeight: 80,
  },
  process: {
    name: "process",
    style: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
    defaultWidth: 200,
    defaultHeight: 100,
  },
  decision: {
    name: "decision",
    style: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  start: {
    name: "start",
    style: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
    defaultWidth: 120,
    defaultHeight: 80,
  },
  end: {
    name: "end",
    style: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
    defaultWidth: 120,
    defaultHeight: 80,
  },
};

/**
 * Shape categories for discoverability via get-shapes-in-category.
 */
export const BASIC_SHAPE_CATEGORIES: Record<string, string[]> = {
  general: ["rectangle", "rounded", "ellipse", "diamond", "circle"],
  flowchart: ["process", "decision", "start", "end"],
};

/**
 * Look up a basic shape by name (case-insensitive).
 * Returns undefined if no match, so callers can fall through to Azure search.
 */
export function getBasicShape(name: string): BasicShape | undefined {
  return BASIC_SHAPES[name.toLowerCase()];
}
