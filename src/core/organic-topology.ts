import Delaunator from 'delaunator';
import { SerializedTopology, SerializedVertex, SerializedTriangle } from './mesh-topology';

export interface TerrainRegion {
  terrainCode: number;
  boundary: Array<{ x: number; z: number }>;
  elevation?: number;
  elevationFn?: (x: number, z: number) => number;
}

export interface OrganicTopologyOptions {
  worldWidth: number;
  worldHeight: number;
  regions: TerrainRegion[];
  backgroundTerrainCode: number;
  backgroundElevationFn?: (x: number, z: number) => number;
  boundaryPointSpacing?: number;
  fillPointSpacing?: number;
}

export function buildOrganicTopology(options: OrganicTopologyOptions): SerializedTopology {
  const {
    worldWidth,
    worldHeight,
    regions,
    backgroundTerrainCode,
    boundaryPointSpacing = 1.0,
    fillPointSpacing = 2.0,
  } = options;

  const points: Array<{ x: number; z: number; regionIdx: number }> = [];

  for (let ri = 0; ri < regions.length; ri++) {
    const region = regions[ri];
    const boundary = region.boundary;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const steps = Math.max(1, Math.ceil(len / boundaryPointSpacing));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        points.push({
          x: a.x + dx * t,
          z: a.z + dz * t,
          regionIdx: ri,
        });
      }
    }
  }

  const borderSpacing = boundaryPointSpacing;
  for (let x = 0; x <= worldWidth; x += borderSpacing) {
    points.push({ x, z: 0, regionIdx: -1 });
    points.push({ x, z: worldHeight, regionIdx: -1 });
  }
  for (let z = borderSpacing; z < worldHeight; z += borderSpacing) {
    points.push({ x: 0, z, regionIdx: -1 });
    points.push({ x: worldWidth, z, regionIdx: -1 });
  }

  const occupiedCells = new Set<string>();
  const cellSize = fillPointSpacing;
  for (const p of points) {
    const cx = Math.floor(p.x / cellSize);
    const cz = Math.floor(p.z / cellSize);
    occupiedCells.add(`${cx},${cz}`);
  }

  const cols = Math.ceil(worldWidth / cellSize);
  const rows = Math.ceil(worldHeight / cellSize);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${row}`;
      if (occupiedCells.has(key)) continue;

      const jitterX = (pseudoRandom(col, row, 0) - 0.5) * cellSize * 0.4;
      const jitterZ = (pseudoRandom(col, row, 1) - 0.5) * cellSize * 0.4;
      const x = Math.max(0, Math.min(worldWidth, (col + 0.5) * cellSize + jitterX));
      const z = Math.max(0, Math.min(worldHeight, (row + 0.5) * cellSize + jitterZ));

      points.push({ x, z, regionIdx: -1 });
    }
  }

  const coords = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].z;
  }

  const delaunay = new Delaunator(coords);

  const vertices: SerializedVertex[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let y = 0;
    const regionIdx = findContainingRegion(p.x, p.z, regions);
    if (regionIdx >= 0) {
      const region = regions[regionIdx];
      if (region.elevationFn) {
        y = region.elevationFn(p.x, p.z);
      } else if (region.elevation !== undefined) {
        y = region.elevation;
      }
    } else if (options.backgroundElevationFn) {
      y = options.backgroundElevationFn(p.x, p.z);
    }

    vertices.push({
      id: i,
      position: { x: p.x, y, z: p.z },
      gridUV: { u: p.x / worldWidth, v: p.z / worldHeight },
    });
  }

  const triangles: SerializedTriangle[] = [];
  let triId = 0;
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const i0 = delaunay.triangles[i];
    const i1 = delaunay.triangles[i + 1];
    const i2 = delaunay.triangles[i + 2];

    const cx = (points[i0].x + points[i1].x + points[i2].x) / 3;
    const cz = (points[i0].z + points[i1].z + points[i2].z) / 3;

    let terrainCode = backgroundTerrainCode;
    const regionIdx = findContainingRegion(cx, cz, regions);
    if (regionIdx >= 0) {
      terrainCode = regions[regionIdx].terrainCode;
    }

    triangles.push({
      id: triId++,
      vertices: [i0, i1, i2],
      terrainCode,
    });
  }

  return { vertices, triangles, worldWidth, worldHeight };
}

function findContainingRegion(x: number, z: number, regions: TerrainRegion[]): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(x, z, regions[i].boundary)) {
      return i;
    }
  }
  return -1;
}

export function pointInPolygon(x: number, z: number, polygon: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;

    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pseudoRandom(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1103515245;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}
