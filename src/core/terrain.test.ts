import { describe, it, expect } from 'vitest';
import {
  getTerrainType,
  getInitialValues,
  calculateHealth,
  getTerrainSpeedModifier,
  isGrassTerrain,
  getTerrainDisplayName,
  getTerrainCode,
  isFaceWalkableBySlope,
  TerrainType,
  TERRAIN_CODES,
} from './terrain';
import { deserializeTopology, Vec3 } from './mesh-topology';

describe('Terrain Type Mapping', () => {
  it('maps code 0 to fairway', () => {
    expect(getTerrainType(0)).toBe('fairway');
  });

  it('maps code 1 to rough', () => {
    expect(getTerrainType(1)).toBe('rough');
  });

  it('maps code 2 to green', () => {
    expect(getTerrainType(2)).toBe('green');
  });

  it('maps code 3 to bunker', () => {
    expect(getTerrainType(3)).toBe('bunker');
  });

  it('maps code 4 to water', () => {
    expect(getTerrainType(4)).toBe('water');
  });

  it('maps code 5 to tee', () => {
    expect(getTerrainType(5)).toBe('tee');
  });

  it('maps unknown codes to rough', () => {
    expect(getTerrainType(99)).toBe('rough');
    expect(getTerrainType(-1)).toBe('rough');
  });
});

describe('Initial Values', () => {
  it('sets fairway with medium height and good moisture/nutrients', () => {
    const values = getInitialValues('fairway');
    expect(values.height).toBe(30);
    expect(values.moisture).toBe(60);
    expect(values.nutrients).toBe(70);
  });

  it('sets rough with tall height and moderate stats', () => {
    const values = getInitialValues('rough');
    expect(values.height).toBe(70);
    expect(values.moisture).toBe(50);
    expect(values.nutrients).toBe(50);
  });

  it('sets green with very short height and high stats', () => {
    const values = getInitialValues('green');
    expect(values.height).toBe(10);
    expect(values.moisture).toBe(70);
    expect(values.nutrients).toBe(80);
  });

  it('sets bunker with no height and low moisture', () => {
    const values = getInitialValues('bunker');
    expect(values.height).toBe(0);
    expect(values.moisture).toBe(20);
    expect(values.nutrients).toBe(0);
  });

  it('sets water with full moisture', () => {
    const values = getInitialValues('water');
    expect(values.height).toBe(0);
    expect(values.moisture).toBe(100);
    expect(values.nutrients).toBe(0);
  });

  it('sets tee with short height and good stats', () => {
    const values = getInitialValues('tee');
    expect(values.height).toBe(15);
    expect(values.moisture).toBe(65);
    expect(values.nutrients).toBe(75);
  });
});

describe('Health Calculation', () => {
  function makeCell(overrides: Partial<{ type: TerrainType; height: number; moisture: number; nutrients: number }> = {}) {
    return {
      type: 'fairway' as TerrainType,
      height: 50,
      moisture: 50,
      nutrients: 50,
      ...overrides
    };
  }

  it('bunker always has 100 health', () => {
    const cell = makeCell({ type: 'bunker', moisture: 0, nutrients: 0, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('water always has 100 health', () => {
    const cell = makeCell({ type: 'water', moisture: 100, nutrients: 0, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('perfect conditions yield 100 health', () => {
    const cell = makeCell({ moisture: 100, nutrients: 100, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('worst conditions yield 0 health', () => {
    const cell = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(cell)).toBe(0);
  });

  it('moisture contributes 35% to health', () => {
    const high = makeCell({ moisture: 100, nutrients: 0, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(35);
  });

  it('nutrients contribute 35% to health', () => {
    const high = makeCell({ moisture: 0, nutrients: 100, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(35);
  });

  it('height contributes 30% to health (inverted)', () => {
    const short = makeCell({ moisture: 0, nutrients: 0, height: 0 });
    const tall = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(short) - calculateHealth(tall)).toBe(30);
  });

  it('health is clamped between 0 and 100', () => {
    const overMax = makeCell({ moisture: 150, nutrients: 150, height: -50 });
    const underMin = makeCell({ moisture: -50, nutrients: -50, height: 150 });
    expect(calculateHealth(overMax)).toBe(100);
    expect(calculateHealth(underMin)).toBe(0);
  });
});

describe('Terrain Constants', () => {
  it('TERRAIN_CODES match getTerrainType mappings', () => {
    expect(getTerrainType(TERRAIN_CODES.FAIRWAY)).toBe('fairway');
    expect(getTerrainType(TERRAIN_CODES.ROUGH)).toBe('rough');
    expect(getTerrainType(TERRAIN_CODES.GREEN)).toBe('green');
    expect(getTerrainType(TERRAIN_CODES.BUNKER)).toBe('bunker');
    expect(getTerrainType(TERRAIN_CODES.WATER)).toBe('water');
  });
});

describe('Terrain Speed Modifier', () => {
  it('fairway has full speed', () => {
    expect(getTerrainSpeedModifier('fairway')).toBe(1.0);
  });

  it('green has full speed', () => {
    expect(getTerrainSpeedModifier('green')).toBe(1.0);
  });

  it('rough slows movement', () => {
    expect(getTerrainSpeedModifier('rough')).toBe(0.7);
  });

  it('bunker significantly slows movement', () => {
    expect(getTerrainSpeedModifier('bunker')).toBe(0.5);
  });

  it('water blocks movement', () => {
    expect(getTerrainSpeedModifier('water')).toBe(0.0);
  });

  it('tee has full speed', () => {
    expect(getTerrainSpeedModifier('tee')).toBe(1.0);
  });
});

describe('isGrassTerrain', () => {
  it('returns true for fairway', () => {
    expect(isGrassTerrain('fairway')).toBe(true);
  });

  it('returns true for rough', () => {
    expect(isGrassTerrain('rough')).toBe(true);
  });

  it('returns true for green', () => {
    expect(isGrassTerrain('green')).toBe(true);
  });

  it('returns false for bunker', () => {
    expect(isGrassTerrain('bunker')).toBe(false);
  });

  it('returns false for water', () => {
    expect(isGrassTerrain('water')).toBe(false);
  });
});

describe('getTerrainDisplayName', () => {
  it('returns Fairway for fairway', () => {
    expect(getTerrainDisplayName('fairway')).toBe('Fairway');
  });

  it('returns Rough for rough', () => {
    expect(getTerrainDisplayName('rough')).toBe('Rough');
  });

  it('returns Green for green', () => {
    expect(getTerrainDisplayName('green')).toBe('Green');
  });

  it('returns Bunker for bunker', () => {
    expect(getTerrainDisplayName('bunker')).toBe('Bunker');
  });

  it('returns Water for water', () => {
    expect(getTerrainDisplayName('water')).toBe('Water');
  });

  it('returns Tee Box for tee', () => {
    expect(getTerrainDisplayName('tee')).toBe('Tee Box');
  });
});

describe('getTerrainCode', () => {
  it('returns correct code for fairway', () => {
    expect(getTerrainCode('fairway')).toBe(TERRAIN_CODES.FAIRWAY);
  });

  it('returns correct code for rough', () => {
    expect(getTerrainCode('rough')).toBe(TERRAIN_CODES.ROUGH);
  });

  it('returns correct code for green', () => {
    expect(getTerrainCode('green')).toBe(TERRAIN_CODES.GREEN);
  });

  it('returns correct code for bunker', () => {
    expect(getTerrainCode('bunker')).toBe(TERRAIN_CODES.BUNKER);
  });

  it('returns correct code for water', () => {
    expect(getTerrainCode('water')).toBe(TERRAIN_CODES.WATER);
  });

  it('returns correct code for tee', () => {
    expect(getTerrainCode('tee')).toBe(TERRAIN_CODES.TEE);
  });
});

describe('isFaceWalkableBySlope', () => {
  function makeSimpleTopology(positions: Vec3[][]) {
    const verts: { id: number; position: Vec3 }[] = [];
    const tris: { id: number; vertices: [number, number, number]; terrainCode: number }[] = [];
    let nextV = 0;
    let nextT = 0;
    const ids: number[][] = [];

    for (let gy = 0; gy < positions.length; gy++) {
      const row: number[] = [];
      for (let gx = 0; gx < positions[gy].length; gx++) {
        const id = nextV++;
        verts.push({ id, position: positions[gy][gx] });
        row.push(id);
      }
      ids.push(row);
    }

    for (let gy = 0; gy < ids.length - 1; gy++) {
      for (let gx = 0; gx < ids[0].length - 1; gx++) {
        const tl = ids[gy][gx], tr = ids[gy][gx + 1];
        const bl = ids[gy + 1][gx], br = ids[gy + 1][gx + 1];
        tris.push({ id: nextT++, vertices: [tl, bl, tr], terrainCode: 0 });
        tris.push({ id: nextT++, vertices: [tr, bl, br], terrainCode: 0 });
      }
    }

    return deserializeTopology({ vertices: verts, triangles: tris, worldWidth: 1, worldHeight: 1 });
  }

  it('returns false for water face regardless of slope', () => {
    const topology = makeSimpleTopology([
      [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
    ]);
    const faceId = Array.from(topology.triangles.keys())[0];
    topology.triangles.get(faceId)!.terrainCode = TERRAIN_CODES.WATER;

    expect(isFaceWalkableBySlope(topology, faceId, 1)).toBe(false);
  });

  it('returns true for flat grass face', () => {
    const topology = makeSimpleTopology([
      [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
    ]);
    const faceId = Array.from(topology.triangles.keys())[0];
    topology.triangles.get(faceId)!.terrainCode = TERRAIN_CODES.FAIRWAY;

    expect(isFaceWalkableBySlope(topology, faceId, 1)).toBe(true);
  });

  it('returns false for steep grass face above 45 degrees', () => {
    const topology = makeSimpleTopology([
      [{ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 2, z: 1 }, { x: 1, y: 0, z: 1 }],
    ]);
    const faceId = Array.from(topology.triangles.keys())[0];
    topology.triangles.get(faceId)!.terrainCode = TERRAIN_CODES.FAIRWAY;

    expect(isFaceWalkableBySlope(topology, faceId, 1)).toBe(false);
  });

  it('returns true for bunker below threshold', () => {
    const topology = makeSimpleTopology([
      [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
    ]);
    const faceId = Array.from(topology.triangles.keys())[0];
    topology.triangles.get(faceId)!.terrainCode = TERRAIN_CODES.BUNKER;

    expect(isFaceWalkableBySlope(topology, faceId, 1)).toBe(true);
  });
});
