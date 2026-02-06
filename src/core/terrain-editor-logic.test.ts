import { describe, it, expect } from 'vitest';
import {
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  getCellsInBrush,
  getVerticesInBrush,
  vertexKey,
  parseVertexKey,
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
  commitVertexModifications,
} from './terrain-editor-logic';

function createTestVertexElevations(width: number, height: number, defaultValue: number = 0): number[][] {
  return Array.from({ length: height }, () => Array(width).fill(defaultValue));
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
      const elevations = createTestVertexElevations(5, 5, 0);
      const mod = applyRaiseVertex(2, 2, elevations, 1);

      expect(mod).not.toBeNull();
      expect(mod!.vx).toBe(2);
      expect(mod!.vy).toBe(2);
      expect(mod!.oldZ).toBe(0);
      expect(mod!.newZ).toBe(1);
    });

    it('returns null for out-of-bounds', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      const mod = applyRaiseVertex(10, 10, elevations);

      expect(mod).toBeNull();
    });
  });

  describe('applyLowerVertex', () => {
    it('lowers vertex elevation', () => {
      const elevations = createTestVertexElevations(5, 5, 2);
      const mod = applyLowerVertex(2, 2, elevations, 1);

      expect(mod).not.toBeNull();
      expect(mod!.oldZ).toBe(2);
      expect(mod!.newZ).toBe(1);
    });

    it('clamps to minimum elevation', () => {
      const elevations = createTestVertexElevations(5, 5, -10);
      const mod = applyLowerVertex(2, 2, elevations, 1, -10);

      expect(mod).toBeNull();
    });
  });

  describe('applySmoothVertices', () => {
    it('smooths vertices to average', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      elevations[2][2] = 4;
      const mods = applySmoothVertices(2, 2, elevations, 2, 5, 5);

      expect(mods.length).toBeGreaterThan(0);
    });

    it('returns empty when already smooth', () => {
      const elevations = createTestVertexElevations(5, 5, 1);
      const mods = applySmoothVertices(2, 2, elevations, 1, 5, 5);

      expect(mods.length).toBe(0);
    });
  });

  describe('applyFlattenVertices', () => {
    it('flattens to center elevation', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      elevations[2][2] = 3;
      const mods = applyFlattenVertices(2, 2, elevations, 2, 5, 5);

      expect(mods.length).toBeGreaterThan(0);
      for (const mod of mods) {
        expect(mod.newZ).toBe(3);
      }
    });

    it('flattens to specified target', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      const mods = applyFlattenVertices(2, 2, elevations, 2, 5, 5, 5);

      expect(mods.length).toBeGreaterThan(0);
      for (const mod of mods) {
        expect(mod.newZ).toBe(5);
      }
    });
  });

  describe('applyLevelVertices', () => {
    it('levels selected vertices to average', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      elevations[1][1] = 2;
      elevations[2][1] = 4;
      const selected = new Set(['1,1', '1,2']);

      const mods = applyLevelVertices(selected, elevations);

      expect(mods.length).toBe(2);
      expect(mods[0].newZ).toBe(3);
      expect(mods[1].newZ).toBe(3);
    });

    it('returns empty for no selection', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      const mods = applyLevelVertices(new Set(), elevations);

      expect(mods.length).toBe(0);
    });
  });

  describe('applySculptTool', () => {
    it('applies raise tool', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      const mods = applySculptTool('raise', 2, 2, elevations, 1, 1, 5, 5);

      expect(mods.length).toBe(1);
      expect(mods[0].newZ).toBe(1);
    });

    it('applies lower tool', () => {
      const elevations = createTestVertexElevations(5, 5, 2);
      const mods = applySculptTool('lower', 2, 2, elevations, 1, 1, 5, 5);

      expect(mods.length).toBe(1);
      expect(mods[0].newZ).toBe(1);
    });

    it('applies with brush size', () => {
      const elevations = createTestVertexElevations(10, 10, 0);
      const mods = applySculptTool('raise', 5, 5, elevations, 2, 1, 10, 10);

      expect(mods.length).toBeGreaterThan(1);
    });
  });
});

describe('Commit Modifications', () => {
  describe('vertex modifications', () => {
    it('commits vertex elevation changes', () => {
      const elevations = createTestVertexElevations(5, 5, 0);
      const mods = [{ vx: 2, vy: 2, oldZ: 0, newZ: 3 }];

      commitVertexModifications(mods, elevations);

      expect(elevations[2][2]).toBe(3);
    });
  });
});

describe('Cells In Brush', () => {
  it('returns single cell for brush size 1', () => {
    const cells = getCellsInBrush(5, 5, 1);
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('returns multiple cells for larger brush size', () => {
    const cells = getCellsInBrush(5, 5, 2);
    expect(cells.length).toBeGreaterThan(1);
    expect(cells).toContainEqual({ x: 5, y: 5 });
  });

  it('returns circular pattern', () => {
    const cells = getCellsInBrush(5, 5, 3);
    expect(cells).toContainEqual({ x: 5, y: 5 });
    expect(cells).toContainEqual({ x: 5, y: 4 });
    expect(cells).toContainEqual({ x: 5, y: 6 });
    expect(cells).toContainEqual({ x: 4, y: 5 });
    expect(cells).toContainEqual({ x: 6, y: 5 });
  });
});

describe('Vertices In Brush', () => {
  it('returns single vertex for radius 1', () => {
    const vertices = getVerticesInBrush(5, 5, 1, 10, 10);
    expect(vertices).toEqual([{ vx: 5, vy: 5 }]);
  });

  it('returns multiple vertices for larger radius', () => {
    const vertices = getVerticesInBrush(5, 5, 2, 10, 10);
    expect(vertices.length).toBeGreaterThan(1);
    expect(vertices).toContainEqual({ vx: 5, vy: 5 });
  });

  it('clamps to grid bounds', () => {
    const vertices = getVerticesInBrush(0, 0, 3, 10, 10);
    for (const v of vertices) {
      expect(v.vx).toBeGreaterThanOrEqual(0);
      expect(v.vy).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Vertex Selection', () => {
  describe('vertexKey and parseVertexKey', () => {
    it('creates a key from coordinates', () => {
      expect(vertexKey(5, 10)).toBe('5,10');
      expect(vertexKey(0, 0)).toBe('0,0');
    });

    it('parses a key back to coordinates', () => {
      expect(parseVertexKey('5,10')).toEqual({ vx: 5, vy: 10 });
      expect(parseVertexKey('0,0')).toEqual({ vx: 0, vy: 0 });
    });
  });

  describe('selectVertex', () => {
    it('selects a single vertex when not additive', () => {
      const state = createInitialEditorState();
      selectVertex(state, 5, 10, false);

      expect(state.selectedVertices.size).toBe(1);
      expect(state.selectedVertices.has('5,10')).toBe(true);
    });

    it('clears previous selection when not additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('1,1');
      state.selectedVertices.add('2,2');

      selectVertex(state, 5, 10, false);

      expect(state.selectedVertices.size).toBe(1);
      expect(state.selectedVertices.has('5,10')).toBe(true);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('1,1');

      selectVertex(state, 5, 10, true);

      expect(state.selectedVertices.size).toBe(2);
      expect(state.selectedVertices.has('1,1')).toBe(true);
      expect(state.selectedVertices.has('5,10')).toBe(true);
    });
  });

  describe('toggleVertex', () => {
    it('adds vertex if not selected', () => {
      const state = createInitialEditorState();
      toggleVertex(state, 5, 10);

      expect(state.selectedVertices.has('5,10')).toBe(true);
    });

    it('removes vertex if already selected', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('5,10');
      toggleVertex(state, 5, 10);

      expect(state.selectedVertices.has('5,10')).toBe(false);
    });
  });

  describe('isVertexSelected', () => {
    it('returns true for selected vertex', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('5,10');

      expect(isVertexSelected(state, 5, 10)).toBe(true);
    });

    it('returns false for unselected vertex', () => {
      const state = createInitialEditorState();

      expect(isVertexSelected(state, 5, 10)).toBe(false);
    });
  });

  describe('selectAll', () => {
    it('selects all vertices in grid', () => {
      const state = createInitialEditorState();
      selectAll(state, 3, 2);

      expect(state.selectedVertices.size).toBe(6);
      expect(state.selectedVertices.has('0,0')).toBe(true);
      expect(state.selectedVertices.has('2,1')).toBe(true);
    });
  });

  describe('deselectAll', () => {
    it('clears all selections', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('1,1');
      state.selectedVertices.add('2,2');
      state.selectedVertices.add('3,3');

      deselectAll(state);

      expect(state.selectedVertices.size).toBe(0);
    });
  });

  describe('invertSelection', () => {
    it('inverts the selection', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('0,0');
      state.selectedVertices.add('1,1');

      invertSelection(state, 2, 2);

      expect(state.selectedVertices.size).toBe(2);
      expect(state.selectedVertices.has('0,0')).toBe(false);
      expect(state.selectedVertices.has('1,1')).toBe(false);
      expect(state.selectedVertices.has('1,0')).toBe(true);
      expect(state.selectedVertices.has('0,1')).toBe(true);
    });
  });

  describe('selectVerticesInBox', () => {
    it('selects vertices in rectangular region', () => {
      const state = createInitialEditorState();

      selectVerticesInBox(state, 1, 1, 3, 2, 10, 10, false);

      expect(state.selectedVertices.size).toBe(6);
      expect(state.selectedVertices.has('1,1')).toBe(true);
      expect(state.selectedVertices.has('2,1')).toBe(true);
      expect(state.selectedVertices.has('3,1')).toBe(true);
      expect(state.selectedVertices.has('1,2')).toBe(true);
      expect(state.selectedVertices.has('2,2')).toBe(true);
      expect(state.selectedVertices.has('3,2')).toBe(true);
    });

    it('handles reversed coordinates', () => {
      const state = createInitialEditorState();

      selectVerticesInBox(state, 3, 2, 1, 1, 10, 10, false);

      expect(state.selectedVertices.size).toBe(6);
    });

    it('clamps to grid bounds', () => {
      const state = createInitialEditorState();

      selectVerticesInBox(state, -1, -1, 1, 1, 5, 5, false);

      expect(state.selectedVertices.has('0,0')).toBe(true);
      expect(state.selectedVertices.has('1,0')).toBe(true);
      expect(state.selectedVertices.has('0,1')).toBe(true);
      expect(state.selectedVertices.has('1,1')).toBe(true);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('0,0');

      selectVerticesInBox(state, 2, 2, 3, 3, 10, 10, true);

      expect(state.selectedVertices.has('0,0')).toBe(true);
      expect(state.selectedVertices.has('2,2')).toBe(true);
    });
  });

  describe('selectVerticesInBrush', () => {
    it('selects vertices in circular brush pattern', () => {
      const state = createInitialEditorState();

      selectVerticesInBrush(state, 5, 5, 2, 10, 10, false);

      expect(state.selectedVertices.size).toBeGreaterThan(1);
      expect(state.selectedVertices.has('5,5')).toBe(true);
    });

    it('adds to selection when additive', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('0,0');

      selectVerticesInBrush(state, 5, 5, 1, 10, 10, true);

      expect(state.selectedVertices.has('0,0')).toBe(true);
      expect(state.selectedVertices.has('5,5')).toBe(true);
    });
  });

  describe('getSelectedVerticesList', () => {
    it('returns array of selected vertex coordinates', () => {
      const state = createInitialEditorState();
      state.selectedVertices.add('1,2');
      state.selectedVertices.add('3,4');

      const list = getSelectedVerticesList(state);

      expect(list.length).toBe(2);
      expect(list).toContainEqual({ vx: 1, vy: 2 });
      expect(list).toContainEqual({ vx: 3, vy: 4 });
    });

    it('returns empty array when nothing selected', () => {
      const state = createInitialEditorState();

      const list = getSelectedVerticesList(state);

      expect(list).toEqual([]);
    });
  });
});
