import type { PathPoint, TraversalRule } from './navigation';
import { findPath as findPathJS } from './navigation';
import { getWasmModule } from './navigation-backend';

const PATH_GRID_STEP = 1;
const PATH_MAX_NODES = 10000;
const MIN_PADDING = 20;
const PADDING_FACTOR = 1.5;

export function findPathWasm<TEntity>(
  entity: TEntity,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  canTraverse: TraversalRule<TEntity>,
  gridStep: number = PATH_GRID_STEP,
  maxNodes: number = PATH_MAX_NODES,
): PathPoint[] | null {
  const wasm = getWasmModule();
  if (!wasm) {
    return findPathJS(entity, startX, startZ, goalX, goalZ, canTraverse, gridStep, maxNodes);
  }

  const snappedSX = Math.round(startX / gridStep) * gridStep;
  const snappedSZ = Math.round(startZ / gridStep) * gridStep;
  const snappedGX = Math.round(goalX / gridStep) * gridStep;
  const snappedGZ = Math.round(goalZ / gridStep) * gridStep;

  if (snappedSX === snappedGX && snappedSZ === snappedGZ) {
    return [{ x: goalX, z: goalZ }];
  }

  const distance = Math.hypot(goalX - startX, goalZ - startZ);
  const padding = Math.max(MIN_PADDING, distance * PADDING_FACTOR);

  const minX = Math.floor((Math.min(snappedSX, snappedGX) - padding) / gridStep) * gridStep;
  const minZ = Math.floor((Math.min(snappedSZ, snappedGZ) - padding) / gridStep) * gridStep;
  const maxX = Math.ceil((Math.max(snappedSX, snappedGX) + padding) / gridStep) * gridStep;
  const maxZ = Math.ceil((Math.max(snappedSZ, snappedGZ) + padding) / gridStep) * gridStep;

  const gridWidth = Math.round((maxX - minX) / gridStep) + 1;
  const gridHeight = Math.round((maxZ - minZ) / gridStep) + 1;

  const grid = new Uint8Array(gridWidth * gridHeight);

  for (let gz = 0; gz < gridHeight; gz++) {
    const worldZ = minZ + gz * gridStep;
    for (let gx = 0; gx < gridWidth; gx++) {
      const worldX = minX + gx * gridStep;
      grid[gz * gridWidth + gx] = canTraverse(entity, worldX, worldZ) ? 1 : 0;
    }
  }

  const result = wasm.find_path(
    grid,
    gridWidth,
    gridHeight,
    gridStep,
    minX,
    minZ,
    startX,
    startZ,
    goalX,
    goalZ,
    maxNodes,
  );

  if (!result || result.length === 0) {
    return null;
  }

  const path: PathPoint[] = [];
  for (let i = 0; i < result.length; i += 2) {
    path.push({ x: result[i], z: result[i + 1] });
  }
  return path;
}
