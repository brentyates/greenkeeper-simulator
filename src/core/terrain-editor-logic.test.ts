import { describe, it, expect } from 'vitest';
import {
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  isVertexSelected,
  selectAll,
  deselectAll,
  applySculptTool,
} from './terrain-editor-logic';
import { Vec3 } from './mesh-topology';

function createTestTopology(
  positions: Array<{ id: number; x: number; y: number; z: number }>
): { vertices: Map<number, { position: Vec3 }> } {
  const vertices = new Map<number, { position: Vec3 }>();
  for (const p of positions) {
    vertices.set(p.id, { position: { x: p.x, y: p.y, z: p.z } });
  }
  return { vertices };
}

function createGridTopology(width: number, height: number, elevation: number = 0) {
  const positions: Array<{ id: number; x: number; y: number; z: number }> = [];
  let id = 0;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      positions.push({ id, x, y: elevation, z });
      id++;
    }
  }
  return createTestTopology(positions);
}

describe('Editor State', () => {
  it('creates initial editor state with defaults', () => {
    const state = createInitialEditorState();
    expect(state.enabled).toBe(false);
    expect(state.activeTool).toBe('raise');
    expect(state.brushSize).toBe(1);
    expect(state.isDragging).toBe(false);
    expect(state.hoverTile).toBe(null);
  });
});

describe('Tool Type Detection', () => {
  it('identifies sculpt tools', () => {
    expect(isSculptTool('raise')).toBe(true);
    expect(isSculptTool('lower')).toBe(true);
    expect(isSculptTool('flatten')).toBe(true);
    expect(isSculptTool('smooth')).toBe(true);
    expect(isSculptTool('level')).toBe(true);
    expect(isSculptTool('terrain_fairway')).toBe(false);
  });

  it('identifies terrain brushes', () => {
    expect(isTerrainBrush('terrain_fairway')).toBe(true);
    expect(isTerrainBrush('terrain_rough')).toBe(true);
    expect(isTerrainBrush('terrain_green')).toBe(true);
    expect(isTerrainBrush('terrain_bunker')).toBe(true);
    expect(isTerrainBrush('terrain_water')).toBe(true);
    expect(isTerrainBrush('raise')).toBe(false);
  });

  it('converts terrain brush to terrain type', () => {
    expect(getTerrainTypeFromBrush('terrain_fairway')).toBe('fairway');
    expect(getTerrainTypeFromBrush('terrain_rough')).toBe('rough');
    expect(getTerrainTypeFromBrush('terrain_green')).toBe('green');
    expect(getTerrainTypeFromBrush('terrain_bunker')).toBe('bunker');
    expect(getTerrainTypeFromBrush('terrain_water')).toBe('water');
  });
});

describe('applySculptTool', () => {
  it('applies raise tool', () => {
    const topo = createTestTopology([{ id: 0, x: 0, y: 0, z: 0 }]);
    const mods = applySculptTool('raise', [0], topo, 1);

    expect(mods.length).toBe(1);
    expect(mods[0].newY).toBe(1);
  });

  it('applies lower tool', () => {
    const topo = createTestTopology([{ id: 0, x: 0, y: 2, z: 0 }]);
    const mods = applySculptTool('lower', [0], topo, 1);

    expect(mods.length).toBe(1);
    expect(mods[0].newY).toBe(1);
  });

  it('applies with multiple vertices', () => {
    const topo = createGridTopology(5, 5, 0);
    const ids = Array.from(topo.vertices.keys()).slice(0, 5);
    const mods = applySculptTool('raise', ids, topo, 1);

    expect(mods.length).toBe(5);
  });
});

describe('Vertex Selection', () => {
  describe('isVertexSelected', () => {
    it('returns true for selected vertex', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(5);

      expect(isVertexSelected(state, 5)).toBe(true);
    });

    it('returns false for unselected vertex', () => {
      const state = createInitialEditorState();

      expect(isVertexSelected(state, 5)).toBe(false);
    });
  });

  describe('selectAll', () => {
    it('selects all vertices in topology', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(3, 2);

      selectAll(state, topo);

      expect(state.selectedVertices.size).toBe(6);
      expect(state.selectedVertices.has(0)).toBe(true);
      expect(state.selectedVertices.has(5)).toBe(true);
    });
  });

  describe('deselectAll', () => {
    it('clears all selections', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(1);
      state.selectedVertices.add(2);
      state.selectedVertices.add(3);

      deselectAll(state);

      expect(state.selectedVertices.size).toBe(0);
    });
  });
});
