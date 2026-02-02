/**
 * VectorTerrainDemo - Demonstrates the new SDF-based vector terrain system
 *
 * This module provides a standalone demo to test the vector terrain rendering
 * without modifying the main game. It can be used to:
 * - Preview the vector terrain rendering
 * - Test shape editing
 * - Compare with the tile-based system
 */

import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { VectorTerrainSystem, VectorTerrainOptions } from "./VectorTerrainSystem";
import { CourseData } from "../../data/courseData";
import {
  VectorShape,
  ControlPoint,
  createCircleShape,
  createEllipseShape,
  generateShapeId,
} from "../../core/vector-shapes";

export interface DemoControls {
  setEdgeBlend: (value: number) => void;
  toggleStripes: () => void;
  toggleNoise: () => void;
  toggleWaterAnim: () => void;
  addGreen: (x: number, y: number, radius: number) => string;
  addBunker: (x: number, y: number, rx: number, ry: number) => string;
  addFairway: (x1: number, y1: number, x2: number, y2: number, width: number) => string;
  removeShape: (id: string) => boolean;
  getShapes: () => readonly VectorShape[];
  setTerrainColor: (type: string, r: number, g: number, b: number) => void;
}

/**
 * Create a demo vector terrain system with sample shapes
 */
export function createVectorTerrainDemo(
  scene: Scene,
  courseData: CourseData,
  options?: Partial<VectorTerrainOptions>
): { system: VectorTerrainSystem; controls: DemoControls } {
  // Create the vector terrain system
  const system = new VectorTerrainSystem(scene, courseData, {
    sdfResolution: 4,
    edgeBlend: 0.3,
    enableStripes: true,
    enableNoise: true,
    enableWaterAnim: true,
    meshResolution: 1,
    ...options,
  });

  // Build the terrain
  system.build();

  // Create control interface
  const controls: DemoControls = {
    setEdgeBlend: (value: number) => {
      system.setEdgeBlend(value);
    },

    toggleStripes: () => {
      const current = (system as any).options?.enableStripes ?? true;
      system.setStripesEnabled(!current);
      (system as any).options.enableStripes = !current;
    },

    toggleNoise: () => {
      const current = (system as any).options?.enableNoise ?? true;
      system.setNoiseEnabled(!current);
      (system as any).options.enableNoise = !current;
    },

    toggleWaterAnim: () => {
      const current = (system as any).options?.enableWaterAnim ?? true;
      system.setWaterAnimEnabled(!current);
      (system as any).options.enableWaterAnim = !current;
    },

    addGreen: (x: number, y: number, radius: number) => {
      return system.createGreen(x, y, radius);
    },

    addBunker: (x: number, y: number, rx: number, ry: number) => {
      return system.createBunker(x, y, rx, ry);
    },

    addFairway: (x1: number, y1: number, x2: number, y2: number, width: number) => {
      return system.createFairway(x1, y1, x2, y2, width);
    },

    removeShape: (id: string) => {
      return system.removeShape(id);
    },

    getShapes: () => {
      return system.getShapes();
    },

    setTerrainColor: (type: string, r: number, g: number, b: number) => {
      system.setTerrainColor(type as any, new Color3(r, g, b));
    },
  };

  return { system, controls };
}

/**
 * Create a sample golf hole with vector shapes
 * Returns the shapes that make up a Par 4 hole
 */
export function createSampleHoleShapes(
  startX: number,
  startY: number,
  length: number = 30,
  angle: number = 0
): VectorShape[] {
  const shapes: VectorShape[] = [];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Helper to rotate a point around start
  const rotate = (x: number, y: number) => ({
    x: startX + x * cos - y * sin,
    y: startY + x * sin + y * cos,
  });

  // Tee box
  const tee = createEllipseShape(
    'tee',
    startX,
    startY,
    2,
    1.5,
    angle,
    8,
    0.4
  );
  shapes.push(tee);

  // Fairway - curved path
  const fairwayPoints: ControlPoint[] = [];
  const fairwayWidth = 4;

  // Left side of fairway
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const dist = t * length;
    const curve = Math.sin(t * Math.PI) * 3; // Slight dogleg
    const pos = rotate(dist, -fairwayWidth / 2 + curve);
    fairwayPoints.push({
      x: pos.x,
      y: pos.y,
      tension: 0.8,
    });
  }

  // Right side of fairway (reverse)
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    const dist = t * length;
    const curve = Math.sin(t * Math.PI) * 3;
    const pos = rotate(dist, fairwayWidth / 2 + curve);
    fairwayPoints.push({
      x: pos.x,
      y: pos.y,
      tension: 0.8,
    });
  }

  shapes.push({
    id: generateShapeId(),
    type: 'fairway',
    points: fairwayPoints,
    closed: true,
    zIndex: 1,
  });

  // Green at the end
  const greenPos = rotate(length, 0);
  const green = createEllipseShape(
    'green',
    greenPos.x,
    greenPos.y,
    3,
    2.5,
    angle + Math.PI / 6,
    12,
    1.0
  );
  shapes.push(green);

  // Bunkers
  // Left greenside bunker
  const bunker1Pos = rotate(length - 2, -4);
  const bunker1 = createEllipseShape(
    'bunker',
    bunker1Pos.x,
    bunker1Pos.y,
    1.5,
    1,
    angle + Math.PI / 4,
    8,
    0.7
  );
  shapes.push(bunker1);

  // Right fairway bunker
  const bunker2Pos = rotate(length * 0.6, 5);
  const bunker2 = createEllipseShape(
    'bunker',
    bunker2Pos.x,
    bunker2Pos.y,
    2,
    1.2,
    angle - Math.PI / 6,
    8,
    0.6
  );
  shapes.push(bunker2);

  // Water hazard (optional, on long holes)
  if (length > 25) {
    const waterPos = rotate(length * 0.4, -6);
    const water = createCircleShape('water', waterPos.x, waterPos.y, 3, 10, 0.9);
    shapes.push(water);
  }

  return shapes;
}

/**
 * Debug overlay for visualizing SDF values
 */
export function createSDFDebugOverlay(
  _system: VectorTerrainSystem,
  container: HTMLElement
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  canvas.style.position = 'absolute';
  canvas.style.top = '10px';
  canvas.style.right = '10px';
  canvas.style.border = '1px solid white';
  canvas.style.backgroundColor = 'black';
  container.appendChild(canvas);

  return canvas;
}

/**
 * Print shape info to console for debugging
 */
export function debugPrintShapes(system: VectorTerrainSystem): void {
  const shapes = system.getShapes();
  console.log(`=== Vector Terrain Shapes (${shapes.length}) ===`);

  for (const shape of shapes) {
    console.log(`  ${shape.id}: ${shape.type} (${shape.points.length} points, z=${shape.zIndex})`);
    if (shape.points.length <= 6) {
      for (let i = 0; i < shape.points.length; i++) {
        const p = shape.points[i];
        console.log(`    [${i}] (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) tension=${p.tension.toFixed(2)}`);
      }
    }
  }
}

/**
 * Interactive shape editor state
 */
export interface ShapeEditorState {
  selectedShapeId: string | null;
  selectedPointIndex: number;
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
}

export function createShapeEditorState(): ShapeEditorState {
  return {
    selectedShapeId: null,
    selectedPointIndex: -1,
    isDragging: false,
    dragStart: null,
  };
}

/**
 * Handle click for shape/point selection
 */
export function handleEditorClick(
  system: VectorTerrainSystem,
  state: ShapeEditorState,
  worldX: number,
  worldY: number,
  selectRadius: number = 0.5
): boolean {
  const shapes = system.getShapes();

  // First try to select a control point
  for (const shape of shapes) {
    for (let i = 0; i < shape.points.length; i++) {
      const p = shape.points[i];
      const dist = Math.sqrt((p.x - worldX) ** 2 + (p.y - worldY) ** 2);

      if (dist < selectRadius) {
        state.selectedShapeId = shape.id;
        state.selectedPointIndex = i;
        return true;
      }
    }
  }

  // Deselect if clicking empty space
  state.selectedShapeId = null;
  state.selectedPointIndex = -1;
  return false;
}

/**
 * Handle drag for moving control points
 */
export function handleEditorDrag(
  system: VectorTerrainSystem,
  state: ShapeEditorState,
  worldX: number,
  worldY: number
): boolean {
  if (state.selectedShapeId && state.selectedPointIndex >= 0) {
    return system.moveControlPoint(
      state.selectedShapeId,
      state.selectedPointIndex,
      worldX,
      worldY
    );
  }
  return false;
}

/**
 * Adjust tension of selected point with scroll
 */
export function handleEditorScroll(
  system: VectorTerrainSystem,
  state: ShapeEditorState,
  delta: number
): boolean {
  if (!state.selectedShapeId || state.selectedPointIndex < 0) return false;

  const shape = system.getShape(state.selectedShapeId);
  if (!shape) return false;

  const point = shape.points[state.selectedPointIndex];
  if (!point) return false;

  const newTension = Math.max(0, Math.min(1, point.tension + delta * 0.1));
  return system.setControlPointTension(
    state.selectedShapeId,
    state.selectedPointIndex,
    newTension
  );
}
