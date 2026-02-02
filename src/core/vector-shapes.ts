/**
 * Vector Shapes - Catmull-Rom spline-based terrain boundaries
 *
 * Provides smooth, resolution-independent terrain shapes for golf courses.
 * Uses Catmull-Rom splines with adjustable tension for intuitive editing.
 */

export interface ControlPoint {
  x: number;           // World position (not grid-locked)
  y: number;           // World position
  tension: number;     // 0 = sharp corner, 1 = ultra smooth curve
}

export type TerrainShapeType = 'fairway' | 'green' | 'tee' | 'bunker' | 'water';

export interface VectorShape {
  id: string;
  type: TerrainShapeType;
  points: ControlPoint[];
  closed: boolean;      // True for closed polygons (greens, bunkers), false for paths
  zIndex: number;       // Rendering order (higher = on top)
}

export interface VectorCourseData {
  width: number;        // Course width in world units
  height: number;       // Course height in world units
  shapes: VectorShape[];
  elevation: number[][]; // Keep grid-based elevation for now
}

/**
 * Catmull-Rom spline interpolation with tension control
 *
 * @param p0 - Previous control point
 * @param p1 - Start point of segment
 * @param p2 - End point of segment
 * @param p3 - Next control point
 * @param t - Interpolation parameter [0, 1]
 * @param tension - Curve tension (0 = sharp, 1 = smooth)
 */
export function catmullRom(
  p0: ControlPoint,
  p1: ControlPoint,
  p2: ControlPoint,
  p3: ControlPoint,
  t: number,
  tension: number = 0.5
): { x: number; y: number } {
  // Tension affects the tangent magnitude
  // tension = 0 gives sharp corners, tension = 1 gives maximum smoothness
  const alpha = 1 - tension;

  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom basis functions with tension
  const m1x = alpha * (p2.x - p0.x);
  const m1y = alpha * (p2.y - p0.y);
  const m2x = alpha * (p3.x - p1.x);
  const m2y = alpha * (p3.y - p1.y);

  // Hermite interpolation
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return {
    x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
    y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
  };
}

/**
 * Sample points along a Catmull-Rom spline
 *
 * @param points - Array of control points
 * @param closed - Whether the spline is closed
 * @param samplesPerSegment - Number of samples between each control point
 */
export function sampleSpline(
  points: ControlPoint[],
  closed: boolean,
  samplesPerSegment: number = 20
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points.map(p => ({ x: p.x, y: p.y }));

  const result: Array<{ x: number; y: number }> = [];
  const n = points.length;

  const getPoint = (i: number): ControlPoint => {
    if (closed) {
      return points[((i % n) + n) % n];
    }
    // Clamp for open splines
    return points[Math.max(0, Math.min(n - 1, i))];
  };

  const segmentCount = closed ? n : n - 1;

  for (let i = 0; i < segmentCount; i++) {
    const p0 = getPoint(i - 1);
    const p1 = getPoint(i);
    const p2 = getPoint(i + 1);
    const p3 = getPoint(i + 2);

    // Use average tension of the two segment endpoints
    const tension = (p1.tension + p2.tension) / 2;

    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      result.push(catmullRom(p0, p1, p2, p3, t, tension));
    }
  }

  // Add final point for open splines
  if (!closed && points.length > 0) {
    const last = points[points.length - 1];
    result.push({ x: last.x, y: last.y });
  }

  return result;
}

/**
 * Check if a point is inside a polygon using ray casting
 */
export function pointInPolygon(
  x: number,
  y: number,
  polygon: Array<{ x: number; y: number }>
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate signed distance from a point to a polygon edge
 * Positive = outside, Negative = inside, Zero = on edge
 */
export function signedDistanceToPolygon(
  x: number,
  y: number,
  polygon: Array<{ x: number; y: number }>
): number {
  const n = polygon.length;
  if (n < 3) return Infinity;

  let minDist = Infinity;

  // Find minimum distance to any edge
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dist = distanceToLineSegment(x, y, polygon[i], polygon[j]);
    minDist = Math.min(minDist, dist);
  }

  // Sign based on inside/outside
  const inside = pointInPolygon(x, y, polygon);
  return inside ? -minDist : minDist;
}

/**
 * Distance from point to line segment
 */
function distanceToLineSegment(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

/**
 * Generate a unique ID for shapes
 */
export function generateShapeId(): string {
  return `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a simple circular shape (useful for greens, bunkers)
 */
export function createCircleShape(
  type: TerrainShapeType,
  centerX: number,
  centerY: number,
  radius: number,
  pointCount: number = 8,
  tension: number = 1.0
): VectorShape {
  const points: ControlPoint[] = [];

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      tension,
    });
  }

  return {
    id: generateShapeId(),
    type,
    points,
    closed: true,
    zIndex: getDefaultZIndex(type),
  };
}

/**
 * Create an ellipse shape
 */
export function createEllipseShape(
  type: TerrainShapeType,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rotation: number = 0,
  pointCount: number = 12,
  tension: number = 1.0
): VectorShape {
  const points: ControlPoint[] = [];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const lx = Math.cos(angle) * radiusX;
    const ly = Math.sin(angle) * radiusY;

    // Rotate
    points.push({
      x: centerX + lx * cos - ly * sin,
      y: centerY + lx * sin + ly * cos,
      tension,
    });
  }

  return {
    id: generateShapeId(),
    type,
    points,
    closed: true,
    zIndex: getDefaultZIndex(type),
  };
}

/**
 * Create a fairway-like elongated shape
 */
export function createFairwayShape(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  tension: number = 0.8
): VectorShape {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular vector
  const px = -dy / length * width / 2;
  const py = dx / length * width / 2;

  const points: ControlPoint[] = [
    { x: startX + px, y: startY + py, tension },
    { x: endX + px, y: endY + py, tension },
    { x: endX - px, y: endY - py, tension },
    { x: startX - px, y: startY - py, tension },
  ];

  return {
    id: generateShapeId(),
    type: 'fairway',
    points,
    closed: true,
    zIndex: getDefaultZIndex('fairway'),
  };
}

/**
 * Get default z-index for terrain types (rendering order)
 */
export function getDefaultZIndex(type: TerrainShapeType): number {
  switch (type) {
    case 'water': return 0;    // Bottom layer
    case 'fairway': return 1;
    case 'tee': return 2;
    case 'bunker': return 3;
    case 'green': return 4;    // Top layer
    default: return 1;
  }
}

/**
 * Convert legacy grid-based layout to vector shapes
 * This is a migration helper - creates approximate vector shapes from the tile grid
 */
export function gridToVectorShapes(
  layout: number[][],
  gridCellSize: number = 1
): VectorShape[] {
  // This is a simplified version - a full implementation would use
  // marching squares or contour tracing to extract smooth boundaries
  const shapes: VectorShape[] = [];
  const height = layout.length;
  const width = layout[0]?.length || 0;

  // For now, just create simple rectangular regions
  // A full implementation would trace contours and simplify them

  const terrainCodes: Record<number, TerrainShapeType> = {
    0: 'fairway',
    2: 'green',
    3: 'bunker',
    4: 'water',
    5: 'tee',
  };

  // Find connected regions of each terrain type
  const visited = new Set<string>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const code = layout[y][x];
      const key = `${x},${y}`;

      if (visited.has(key) || code === 1) continue; // Skip rough and visited

      const type = terrainCodes[code];
      if (!type) continue;

      // Flood fill to find connected region
      const region = floodFill(layout, x, y, code, visited);

      if (region.length > 0) {
        // Create convex hull or bounding shape
        const shape = createShapeFromRegion(region, type, gridCellSize);
        if (shape) shapes.push(shape);
      }
    }
  }

  return shapes;
}

function floodFill(
  layout: number[][],
  startX: number,
  startY: number,
  targetCode: number,
  visited: Set<string>
): Array<{ x: number; y: number }> {
  const height = layout.length;
  const width = layout[0]?.length || 0;
  const result: Array<{ x: number; y: number }> = [];
  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (layout[y][x] !== targetCode) continue;

    visited.add(key);
    result.push({ x, y });

    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }

  return result;
}

function createShapeFromRegion(
  region: Array<{ x: number; y: number }>,
  type: TerrainShapeType,
  cellSize: number
): VectorShape | null {
  if (region.length === 0) return null;

  // Find boundary cells and create a simplified polygon
  const boundary = extractBoundary(region);
  if (boundary.length < 3) return null;

  // Simplify and convert to control points
  const simplified = simplifyPolygon(boundary, 0.5);

  const points: ControlPoint[] = simplified.map(p => ({
    x: (p.x + 0.5) * cellSize,
    y: (p.y + 0.5) * cellSize,
    tension: 0.7, // Default smooth tension
  }));

  return {
    id: generateShapeId(),
    type,
    points,
    closed: true,
    zIndex: getDefaultZIndex(type),
  };
}

function extractBoundary(
  region: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  // Simple boundary extraction - find cells with at least one non-region neighbor
  const regionSet = new Set(region.map(p => `${p.x},${p.y}`));
  const boundary: Array<{ x: number; y: number }> = [];

  for (const { x, y } of region) {
    const neighbors = [
      `${x + 1},${y}`,
      `${x - 1},${y}`,
      `${x},${y + 1}`,
      `${x},${y - 1}`,
    ];

    if (neighbors.some(n => !regionSet.has(n))) {
      boundary.push({ x, y });
    }
  }

  // Sort boundary points to form a polygon (simple angular sort from centroid)
  if (boundary.length > 0) {
    const cx = boundary.reduce((s, p) => s + p.x, 0) / boundary.length;
    const cy = boundary.reduce((s, p) => s + p.y, 0) / boundary.length;

    boundary.sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });
  }

  return boundary;
}

function simplifyPolygon(
  points: Array<{ x: number; y: number }>,
  tolerance: number
): Array<{ x: number; y: number }> {
  // Douglas-Peucker simplification
  if (points.length <= 3) return points;

  // Find the point with the maximum distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    // Recursively simplify
    const left = simplifyPolygon(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolygon(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}
