export type TerrainType = 'fairway' | 'rough' | 'green' | 'bunker' | 'water';
export type ObstacleType = 'none' | 'tree' | 'pine_tree' | 'shrub' | 'bush';

export interface CellState {
  x: number;
  y: number;
  type: TerrainType;
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
  elevation: number;
  obstacle: ObstacleType;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
}

export interface CourseLayout {
  width: number;
  height: number;
  layout: number[][];
  elevation?: number[][];
  obstacles?: Array<{ x: number; y: number; type: number }>;
}

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const ELEVATION_HEIGHT = 16;

export const TERRAIN_CODES = {
  FAIRWAY: 0,
  ROUGH: 1,
  GREEN: 2,
  BUNKER: 3,
  WATER: 4,
} as const;

export const OBSTACLE_CODES = {
  NONE: 0,
  TREE: 1,
  PINE_TREE: 2,
  SHRUB: 3,
  BUSH: 4,
} as const;

export function getTerrainType(code: number): TerrainType {
  switch (code) {
    case 0: return 'fairway';
    case 1: return 'rough';
    case 2: return 'green';
    case 3: return 'bunker';
    case 4: return 'water';
    default: return 'rough';
  }
}

export function getObstacleType(code: number): ObstacleType {
  switch (code) {
    case 0: return 'none';
    case 1: return 'tree';
    case 2: return 'pine_tree';
    case 3: return 'shrub';
    case 4: return 'bush';
    default: return 'none';
  }
}

export function getInitialValues(type: TerrainType): { height: number; moisture: number; nutrients: number } {
  switch (type) {
    case 'fairway':
      return { height: 30, moisture: 60, nutrients: 70 };
    case 'rough':
      return { height: 70, moisture: 50, nutrients: 50 };
    case 'green':
      return { height: 10, moisture: 70, nutrients: 80 };
    case 'bunker':
      return { height: 0, moisture: 20, nutrients: 0 };
    case 'water':
      return { height: 0, moisture: 100, nutrients: 0 };
    default:
      return { height: 50, moisture: 50, nutrients: 50 };
  }
}

export function gridToScreen(gridX: number, gridY: number, elevation: number, mapWidth: number): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + (mapWidth * TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) - elevation * ELEVATION_HEIGHT;
  return { x: screenX, y: screenY };
}

export function screenToGrid(screenX: number, screenY: number, mapWidth: number): { x: number; y: number } {
  const offsetX = screenX - (mapWidth * TILE_WIDTH / 2);
  const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(isoX), y: Math.floor(isoY) };
}

export function isGrassTerrain(type: TerrainType): boolean {
  return type === 'fairway' || type === 'rough' || type === 'green';
}

export function calculateHealth(cell: Pick<CellState, 'type' | 'moisture' | 'nutrients' | 'height'>): number {
  if (!isGrassTerrain(cell.type)) {
    return 100;
  }
  const moistureScore = cell.moisture * 0.3;
  const nutrientScore = cell.nutrients * 0.3;
  const heightScore = (100 - Math.min(cell.height, 100)) * 0.4;
  return Math.max(0, Math.min(100, moistureScore + nutrientScore + heightScore));
}

export function isWalkable(cell: CellState | null): boolean {
  if (!cell) return false;
  if (cell.type === 'water') return false;
  if (cell.obstacle !== 'none') return false;
  return true;
}

export function canMoveFromTo(fromCell: CellState | null, toCell: CellState | null): boolean {
  if (!fromCell || !toCell) return false;
  if (!isWalkable(toCell)) return false;

  const elevationDiff = Math.abs(toCell.elevation - fromCell.elevation);
  if (elevationDiff > 1) return false;

  return true;
}

export function getRampDirection(
  elevation: number,
  northElev: number | null,
  southElev: number | null,
  eastElev: number | null,
  westElev: number | null
): 'north' | 'south' | 'east' | 'west' | null {
  const n = northElev ?? elevation;
  const s = southElev ?? elevation;
  const e = eastElev ?? elevation;
  const w = westElev ?? elevation;

  if (n > elevation && n - elevation === 1 && s <= elevation) {
    return 'north';
  }
  if (s > elevation && s - elevation === 1 && n <= elevation) {
    return 'south';
  }
  if (e > elevation && e - elevation === 1 && w <= elevation) {
    return 'east';
  }
  if (w > elevation && w - elevation === 1 && e <= elevation) {
    return 'west';
  }

  return null;
}

export function getTextureForCell(cell: CellState, rampDir: 'north' | 'south' | 'east' | 'west' | null): string {
  if (rampDir && isGrassTerrain(cell.type)) {
    return `iso_ramp_${rampDir}`;
  }

  if (cell.type === 'bunker') return 'iso_bunker';
  if (cell.type === 'water') return 'iso_water';

  if (isGrassTerrain(cell.type)) {
    if (cell.health < 20) return 'iso_grass_dead';
    if (cell.health < 40) return 'iso_grass_dry';

    const thresholds = getTerrainThresholds(cell.type);
    if (cell.height <= thresholds.mownHeight) return `iso_${cell.type}_mown`;
    if (cell.height <= thresholds.growingHeight) return `iso_${cell.type}_growing`;
    return `iso_${cell.type}_unmown`;
  }

  return 'iso_rough_unmown';
}

export function getCellsInRadius(centerX: number, centerY: number, radius: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        cells.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }
  return cells;
}

export interface CornerHeights {
  n: number;
  e: number;
  s: number;
  w: number;
}

export type SlopeType =
  | 'flat'
  | 'slope_n'      // N vertex raised (slopes up to north)
  | 'slope_e'      // E vertex raised
  | 'slope_s'      // S vertex raised
  | 'slope_w'      // W vertex raised
  | 'slope_ne'     // NE edge raised (N and E vertices high)
  | 'slope_se'     // SE edge raised
  | 'slope_sw'     // SW edge raised
  | 'slope_nw'     // NW edge raised
  | 'valley_n'     // N vertex lowered (all others high)
  | 'valley_e'     // E vertex lowered
  | 'valley_s'     // S vertex lowered
  | 'valley_w'     // W vertex lowered
  | 'saddle_ns'    // N and S high, E and W low
  | 'saddle_ew';   // E and W high, N and S low

export function getCornerHeights(
  elevation: number,
  nElev: number | null,
  eElev: number | null,
  sElev: number | null,
  wElev: number | null,
  _neElev: number | null,
  _seElev: number | null,
  _swElev: number | null,
  _nwElev: number | null
): CornerHeights {
  const n = nElev ?? elevation;
  const e = eElev ?? elevation;
  const s = sElev ?? elevation;
  const w = wElev ?? elevation;

  return {
    n: n > elevation ? 1 : 0,
    e: e > elevation ? 1 : 0,
    s: s > elevation ? 1 : 0,
    w: w > elevation ? 1 : 0
  };
}

export function getSlopeType(corners: CornerHeights): SlopeType {
  const { n, e, s, w } = corners;
  const highCount = n + e + s + w;

  if (highCount === 0) return 'flat';

  if (highCount === 1) {
    if (n === 1) return 'slope_n';
    if (e === 1) return 'slope_e';
    if (s === 1) return 'slope_s';
    return 'slope_w';
  }

  if (highCount === 3) {
    if (n === 0) return 'valley_n';
    if (e === 0) return 'valley_e';
    if (s === 0) return 'valley_s';
    return 'valley_w';
  }

  if (highCount === 2) {
    if (n === 1 && e === 1) return 'slope_ne';
    if (e === 1 && s === 1) return 'slope_se';
    if (s === 1 && w === 1) return 'slope_sw';
    if (w === 1 && n === 1) return 'slope_nw';
    if (n === 1 && s === 1) return 'saddle_ns';
    return 'saddle_ew';
  }

  return 'flat';
}

export function getSlopeTexture(slopeType: SlopeType): string {
  if (slopeType === 'flat') return '';
  return `iso_${slopeType}`;
}

export function getBaseElevationForSlope(corners: CornerHeights): number {
  return Math.min(corners.n, corners.e, corners.s, corners.w);
}

export interface RCTCornerHeights {
  nw: number;
  ne: number;
  se: number;
  sw: number;
}

export function getOptimalDiagonal(corners: RCTCornerHeights): 'nwse' | 'nesw' {
  const diagNWSE = Math.abs(corners.nw - corners.se);
  const diagNESW = Math.abs(corners.ne - corners.sw);
  return diagNWSE <= diagNESW ? 'nwse' : 'nesw';
}

export function validateSlopeConstraint(corners: RCTCornerHeights, maxDelta: number = 2): boolean {
  const heights = [corners.nw, corners.ne, corners.se, corners.sw];
  for (let i = 0; i < heights.length; i++) {
    for (let j = i + 1; j < heights.length; j++) {
      if (Math.abs(heights[i] - heights[j]) > maxDelta) {
        return false;
      }
    }
  }
  return true;
}

export interface SurfacePhysics {
  friction: number;
  bounciness: number;
  rollResistance: number;
}

export function getSurfacePhysics(type: TerrainType): SurfacePhysics {
  switch (type) {
    case 'fairway':
      return { friction: 0.4, bounciness: 0.3, rollResistance: 0.02 };
    case 'green':
      return { friction: 0.3, bounciness: 0.25, rollResistance: 0.01 };
    case 'rough':
      return { friction: 0.7, bounciness: 0.2, rollResistance: 0.08 };
    case 'bunker':
      return { friction: 0.9, bounciness: 0.1, rollResistance: 0.15 };
    case 'water':
      return { friction: 0.1, bounciness: 0.0, rollResistance: 1.0 };
    default:
      return { friction: 0.5, bounciness: 0.2, rollResistance: 0.05 };
  }
}

export function getSlopeFrictionModifier(slopeAngle: number): number {
  const normalizedAngle = Math.abs(slopeAngle) / 45;
  return 1.0 + normalizedAngle * 0.3;
}

export function calculateSlopeAngle(corners: RCTCornerHeights, heightStep: number = ELEVATION_HEIGHT): number {
  const avgNorth = (corners.nw + corners.ne) / 2;
  const avgSouth = (corners.sw + corners.se) / 2;
  const avgEast = (corners.ne + corners.se) / 2;
  const avgWest = (corners.nw + corners.sw) / 2;

  const nsSlope = (avgNorth - avgSouth) * heightStep;
  const ewSlope = (avgEast - avgWest) * heightStep;

  const maxSlope = Math.max(Math.abs(nsSlope), Math.abs(ewSlope));
  return Math.atan2(maxSlope, TILE_WIDTH) * (180 / Math.PI);
}

export interface SlopeVector {
  angle: number;
  direction: number;
  magnitude: number;
}

export function getSlopeVector(corners: RCTCornerHeights, heightStep: number = ELEVATION_HEIGHT): SlopeVector {
  const avgNorth = (corners.nw + corners.ne) / 2;
  const avgSouth = (corners.sw + corners.se) / 2;
  const avgEast = (corners.ne + corners.se) / 2;
  const avgWest = (corners.nw + corners.sw) / 2;

  const nsSlope = (avgSouth - avgNorth) * heightStep;
  const ewSlope = (avgEast - avgWest) * heightStep;

  const magnitude = Math.sqrt(nsSlope * nsSlope + ewSlope * ewSlope);
  const direction = Math.atan2(nsSlope, ewSlope) * (180 / Math.PI);
  const angle = Math.atan2(magnitude, TILE_WIDTH) * (180 / Math.PI);

  return { angle, direction, magnitude };
}

export function getTileNormal(corners: RCTCornerHeights, heightStep: number = ELEVATION_HEIGHT): { x: number; y: number; z: number } {
  const v1x = TILE_WIDTH;
  const v1y = 0;
  const v1z = ((corners.ne + corners.se) / 2 - (corners.nw + corners.sw) / 2) * heightStep;

  const v2x = 0;
  const v2y = TILE_HEIGHT;
  const v2z = ((corners.sw + corners.se) / 2 - (corners.nw + corners.ne) / 2) * heightStep;

  const nx = v1y * v2z - v1z * v2y;
  const ny = v1z * v2x - v1x * v2z;
  const nz = v1x * v2y - v1y * v2x;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return { x: 0, y: 0, z: 1 };

  return { x: nx / len, y: ny / len, z: nz / len };
}

export const DEFAULT_WATER_LEVEL = 0;

export function isSubmerged(corners: RCTCornerHeights, waterLevel: number = DEFAULT_WATER_LEVEL): boolean {
  return corners.nw < waterLevel && corners.ne < waterLevel &&
         corners.se < waterLevel && corners.sw < waterLevel;
}

export function isPartiallySubmerged(corners: RCTCornerHeights, waterLevel: number = DEFAULT_WATER_LEVEL): boolean {
  const below = [corners.nw, corners.ne, corners.se, corners.sw].filter(h => h < waterLevel).length;
  return below > 0 && below < 4;
}

export function getWaterDepth(corners: RCTCornerHeights, waterLevel: number = DEFAULT_WATER_LEVEL): number {
  const minHeight = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
  return Math.max(0, waterLevel - minHeight);
}

export function getEffectiveTerrainType(
  type: TerrainType,
  corners: RCTCornerHeights,
  waterLevel: number = DEFAULT_WATER_LEVEL
): TerrainType {
  if (isSubmerged(corners, waterLevel)) {
    return 'water';
  }
  return type;
}

export function getTerrainSpeedModifier(type: TerrainType): number {
  switch (type) {
    case 'fairway': return 1.0;
    case 'green': return 1.0;
    case 'rough': return 0.7;
    case 'bunker': return 0.5;
    case 'water': return 0.0;
    default: return 1.0;
  }
}

export function getTerrainMowable(type: TerrainType): boolean {
  return type === 'fairway' || type === 'rough' || type === 'green';
}

export function getTerrainWaterable(type: TerrainType): boolean {
  return type === 'fairway' || type === 'rough' || type === 'green';
}

export function getTerrainFertilizable(type: TerrainType): boolean {
  return type === 'fairway' || type === 'rough' || type === 'green';
}

export function clampToGrid(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max - 1, Math.floor(value)));
}

export function getTerrainDisplayName(type: TerrainType): string {
  switch (type) {
    case 'fairway': return 'Fairway';
    case 'rough': return 'Rough';
    case 'green': return 'Green';
    case 'bunker': return 'Bunker';
    case 'water': return 'Water';
    default: return 'Unknown';
  }
}

export function getObstacleDisplayName(type: ObstacleType): string {
  switch (type) {
    case 'none': return 'None';
    case 'tree': return 'Tree';
    case 'pine_tree': return 'Pine Tree';
    case 'shrub': return 'Shrub';
    case 'bush': return 'Bush';
    default: return 'Unknown';
  }
}

export interface TerrainThresholds {
  mownHeight: number;
  growingHeight: number;
}

export function getTerrainThresholds(type: TerrainType): TerrainThresholds {
  switch (type) {
    case 'fairway': return { mownHeight: 20, growingHeight: 45 };
    case 'rough': return { mownHeight: 30, growingHeight: 60 };
    case 'green': return { mownHeight: 10, growingHeight: 22 };
    default: return { mownHeight: 30, growingHeight: 60 };
  }
}

export function getGrassState(cell: CellState): 'mown' | 'growing' | 'unmown' {
  if (!isGrassTerrain(cell.type)) {
    return 'mown';
  }
  const thresholds = getTerrainThresholds(cell.type);
  if (cell.height <= thresholds.mownHeight) return 'mown';
  if (cell.height <= thresholds.growingHeight) return 'growing';
  return 'unmown';
}

export interface RCTTileFlags {
  water: boolean;
  protected: boolean;
}

export interface RCTTileData {
  pos: [number, number];
  heights: [number, number, number, number];
  type: TerrainType;
  flags: RCTTileFlags;
}

export interface RCTTerrainData {
  gridSize: [number, number];
  heightStep: number;
  tiles: RCTTileData[];
}

export function createRCTTileData(
  x: number,
  y: number,
  corners: RCTCornerHeights,
  type: TerrainType,
  waterLevel: number = DEFAULT_WATER_LEVEL
): RCTTileData {
  return {
    pos: [x, y],
    heights: [corners.nw, corners.ne, corners.se, corners.sw],
    type,
    flags: {
      water: isSubmerged(corners, waterLevel),
      protected: type === 'green'
    }
  };
}

export function parseRCTTileHeights(heights: [number, number, number, number]): RCTCornerHeights {
  return {
    nw: heights[0],
    ne: heights[1],
    se: heights[2],
    sw: heights[3]
  };
}

export function exportToRCTFormat(
  layout: number[][],
  elevation: number[][] | undefined,
  heightStep: number = ELEVATION_HEIGHT,
  waterLevel: number = DEFAULT_WATER_LEVEL
): RCTTerrainData {
  const height = layout.length;
  const width = height > 0 ? layout[0].length : 0;
  const tiles: RCTTileData[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrainCode = layout[y][x];
      const type = getTerrainType(terrainCode);
      const baseElev = elevation?.[y]?.[x] ?? 0;

      const nElev = elevation?.[y - 1]?.[x] ?? baseElev;
      const sElev = elevation?.[y + 1]?.[x] ?? baseElev;
      const eElev = elevation?.[y]?.[x + 1] ?? baseElev;
      const wElev = elevation?.[y]?.[x - 1] ?? baseElev;
      const neElev = elevation?.[y - 1]?.[x + 1] ?? baseElev;
      const nwElev = elevation?.[y - 1]?.[x - 1] ?? baseElev;
      const seElev = elevation?.[y + 1]?.[x + 1] ?? baseElev;
      const swElev = elevation?.[y + 1]?.[x - 1] ?? baseElev;

      const corners: RCTCornerHeights = {
        nw: Math.max(baseElev, nElev, wElev, nwElev),
        ne: Math.max(baseElev, nElev, eElev, neElev),
        se: Math.max(baseElev, sElev, eElev, seElev),
        sw: Math.max(baseElev, sElev, wElev, swElev)
      };

      tiles.push(createRCTTileData(x, y, corners, type, waterLevel));
    }
  }

  return {
    gridSize: [width, height],
    heightStep,
    tiles
  };
}

export function importFromRCTFormat(data: RCTTerrainData): CourseLayout {
  const [width, height] = data.gridSize;
  const layout: number[][] = [];
  const elevation: number[][] = [];

  for (let y = 0; y < height; y++) {
    layout[y] = [];
    elevation[y] = [];
    for (let x = 0; x < width; x++) {
      layout[y][x] = TERRAIN_CODES.ROUGH;
      elevation[y][x] = 0;
    }
  }

  for (const tile of data.tiles) {
    const [x, y] = tile.pos;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const corners = parseRCTTileHeights(tile.heights);
      const avgElev = Math.round((corners.nw + corners.ne + corners.se + corners.sw) / 4);

      layout[y][x] = getTerrainCode(tile.type);
      elevation[y][x] = avgElev;
    }
  }

  return { width, height, layout, elevation };
}

export function getTerrainCode(type: TerrainType): number {
  switch (type) {
    case 'fairway': return TERRAIN_CODES.FAIRWAY;
    case 'rough': return TERRAIN_CODES.ROUGH;
    case 'green': return TERRAIN_CODES.GREEN;
    case 'bunker': return TERRAIN_CODES.BUNKER;
    case 'water': return TERRAIN_CODES.WATER;
    default: return TERRAIN_CODES.ROUGH;
  }
}
