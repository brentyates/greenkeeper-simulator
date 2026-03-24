type FindPathFn = (
  grid: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  gridStep: number,
  originX: number,
  originZ: number,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  maxNodes: number,
) => Float32Array | null | undefined;

interface WasmExports {
  find_path: FindPathFn;
}

let wasmModule: WasmExports | null = null;
let initAttempted = false;

export async function initWasmPathfinding(): Promise<boolean> {
  if (initAttempted) return wasmModule !== null;
  initAttempted = true;
  try {
    const mod = await import('../wasm/pathfinding/greenkeeper_pathfinding.js');
    await mod.default();
    wasmModule = mod as unknown as WasmExports;
    return true;
  } catch {
    return false;
  }
}

export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}

export function getWasmModule(): WasmExports | null {
  return wasmModule;
}
