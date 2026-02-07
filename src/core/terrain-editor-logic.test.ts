import { describe, it, expect } from 'vitest';
import {
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  selectVertex,
  toggleVertex,
  isVertexSelected,
  selectAll,
  deselectAll,
  invertSelection,
  selectVerticesInBox,
  selectVerticesInBrush,
  getSelectedVerticesList,
  applyRaiseVertex,
  applyLowerVertex,
  applySmoothVertices,
  applyFlattenVertices,
  applyLevelVertices,
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

describe('Vertex Sculpt Operations', () => {
  describe('applyRaiseVertex', () => {
    it('raises vertex elevation', () => {
      const topo = createTestTopology([{ id: 0, x: 0, y: 0, z: 0 }]);
      const mod = applyRaiseVertex(0, topo, 1);

      expect(mod).not.toBeNull();
      expect(mod!.vertexId).toBe(0);
      expect(mod!.oldY).toBe(0);
      expect(mod!.newY).toBe(1);
      expect(topo.vertices.get(0)!.position.y).toBe(1);
    });

    it('returns null for missing vertex', () => {
      const topo = createTestTopology([]);
      const mod = applyRaiseVertex(99, topo);

      expect(mod).toBeNull();
    });
  });

  describe('applyLowerVertex', () => {
    it('lowers vertex elevation', () => {
      const topo = createTestTopology([{ id: 0, x: 0, y: 2, z: 0 }]);
      const mod = applyLowerVertex(0, topo, 1);

      expect(mod).not.toBeNull();
      expect(mod!.oldY).toBe(2);
      expect(mod!.newY).toBe(1);
    });

    it('clamps to minimum elevation', () => {
      const topo = createTestTopology([{ id: 0, x: 0, y: -10, z: 0 }]);
      const mod = applyLowerVertex(0, topo, 1, -10);

      expect(mod).toBeNull();
    });
  });

  describe('applySmoothVertices', () => {
    it('smooths vertices to average', () => {
      const topo = createGridTopology(5, 5, 0);
      const centerId = 2 * 5 + 2;
      topo.vertices.get(centerId)!.position.y = 4;
      const ids = Array.from(topo.vertices.keys());
      const mods = applySmoothVertices(ids, topo);

      expect(mods.length).toBeGreaterThan(0);
    });

    it('returns empty when already smooth', () => {
      const topo = createGridTopology(5, 5, 1);
      const ids = Array.from(topo.vertices.keys());
      const mods = applySmoothVertices(ids, topo);

      expect(mods.length).toBe(0);
    });
  });

  describe('applyFlattenVertices', () => {
    it('flattens to first vertex elevation', () => {
      const topo = createTestTopology([
        { id: 0, x: 0, y: 3, z: 0 },
        { id: 1, x: 1, y: 0, z: 0 },
        { id: 2, x: 2, y: 0, z: 0 },
      ]);
      const mods = applyFlattenVertices([0, 1, 2], topo);

      expect(mods.length).toBe(2);
      for (const mod of mods) {
        expect(mod.newY).toBe(3);
      }
    });

    it('flattens to specified target', () => {
      const topo = createTestTopology([
        { id: 0, x: 0, y: 0, z: 0 },
        { id: 1, x: 1, y: 0, z: 0 },
      ]);
      const mods = applyFlattenVertices([0, 1], topo, 5);

      expect(mods.length).toBe(2);
      for (const mod of mods) {
        expect(mod.newY).toBe(5);
      }
    });
  });

  describe('applyLevelVertices', () => {
    it('levels selected vertices to average', () => {
      const topo = createTestTopology([
        { id: 0, x: 0, y: 2, z: 0 },
        { id: 1, x: 1, y: 4, z: 0 },
      ]);
      const selected = new Set([0, 1]);

      const mods = applyLevelVertices(selected, topo);

      expect(mods.length).toBe(2);
      expect(mods[0].newY).toBe(3);
      expect(mods[1].newY).toBe(3);
    });

    it('returns empty for no selection', () => {
      const topo = createGridTopology(5, 5, 0);
      const mods = applyLevelVertices(new Set(), topo);

      expect(mods.length).toBe(0);
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
});

describe('Vertex Selection', () => {
  describe('selectVertex', () => {
    it('selects a single vertex when not additive', () => {
      const state = createInitialEditorState();
      selectVertex(state, 5, false);

      expect(state.selectedVertices.size).toBe(1);
      expect(state.selectedVertices.has(5)).toBe(true);
    });

    it('clears previous selection when not additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(1);
      state.selectedVertices.add(2);

      selectVertex(state, 5, false);

      expect(state.selectedVertices.size).toBe(1);
      expect(state.selectedVertices.has(5)).toBe(true);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(1);

      selectVertex(state, 5, true);

      expect(state.selectedVertices.size).toBe(2);
      expect(state.selectedVertices.has(1)).toBe(true);
      expect(state.selectedVertices.has(5)).toBe(true);
    });
  });

  describe('toggleVertex', () => {
    it('adds vertex if not selected', () => {
      const state = createInitialEditorState();
      toggleVertex(state, 5);

      expect(state.selectedVertices.has(5)).toBe(true);
    });

    it('removes vertex if already selected', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(5);
      toggleVertex(state, 5);

      expect(state.selectedVertices.has(5)).toBe(false);
    });
  });

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

  describe('invertSelection', () => {
    it('inverts the selection', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(2, 2);
      state.selectedVertices.add(0);
      state.selectedVertices.add(3);

      invertSelection(state, topo);

      expect(state.selectedVertices.size).toBe(2);
      expect(state.selectedVertices.has(0)).toBe(false);
      expect(state.selectedVertices.has(3)).toBe(false);
      expect(state.selectedVertices.has(1)).toBe(true);
      expect(state.selectedVertices.has(2)).toBe(true);
    });
  });

  describe('selectVerticesInBox', () => {
    it('selects vertices in rectangular region', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(10, 10);

      selectVerticesInBox(state, 1, 1, 3, 2, topo, false);

      expect(state.selectedVertices.size).toBe(6);
    });

    it('handles reversed coordinates', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(10, 10);

      selectVerticesInBox(state, 3, 2, 1, 1, topo, false);

      expect(state.selectedVertices.size).toBe(6);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(10, 10);
      state.selectedVertices.add(0);

      selectVerticesInBox(state, 2, 2, 3, 3, topo, true);

      expect(state.selectedVertices.has(0)).toBe(true);
      expect(state.selectedVertices.size).toBeGreaterThan(1);
    });
  });

  describe('selectVerticesInBrush', () => {
    it('selects vertices in circular brush pattern', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(10, 10);

      selectVerticesInBrush(state, 5, 5, 2, topo, false);

      expect(state.selectedVertices.size).toBeGreaterThan(1);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      const topo = createGridTopology(10, 10);
      state.selectedVertices.add(0);

      selectVerticesInBrush(state, 5, 5, 1, topo, true);

      expect(state.selectedVertices.has(0)).toBe(true);
      expect(state.selectedVertices.size).toBeGreaterThan(1);
    });
  });

  describe('getSelectedVerticesList', () => {
    it('returns array of selected vertex IDs', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add(1);
      state.selectedVertices.add(3);

      const list = getSelectedVerticesList(state);

      expect(list.length).toBe(2);
      expect(list).toContain(1);
      expect(list).toContain(3);
    });

    it('returns empty array when nothing selected', () => {
      const state = createInitialEditorState();

      const list = getSelectedVerticesList(state);

      expect(list).toEqual([]);
    });
  });
});
