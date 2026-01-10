import { describe, it, expect } from 'vitest';
import {
  createInitialEditorState,
  isElevationTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  canRaiseAt,
  canLowerAt,
  applyRaise,
  applyLower,
  applyFlatten,
  applySmooth,
  applyTerrainType,
  applyTool,
  getCellsInBrush,
  commitModifications,
  revertModifications,
  createEditorAction,
  canUndo,
  canRedo,
  undo,
  redo,
  getAffectedTiles,
  exportTerrainData,
  cloneGrid,
  TileModification,
  EditorAction,
} from './terrain-editor-logic';
import { TERRAIN_CODES } from './terrain';

function createTestElevation(width: number, height: number, defaultValue: number = 0): number[][] {
  return Array.from({ length: height }, () => Array(width).fill(defaultValue));
}

function createTestLayout(width: number, height: number, defaultValue: number = TERRAIN_CODES.FAIRWAY): number[][] {
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
  it('identifies elevation tools', () => {
    expect(isElevationTool('raise')).toBe(true);
    expect(isElevationTool('lower')).toBe(true);
    expect(isElevationTool('flatten')).toBe(true);
    expect(isElevationTool('smooth')).toBe(true);
    expect(isElevationTool('terrain_fairway')).toBe(false);
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

describe('Raise Validation', () => {
  it('allows raising flat terrain', () => {
    const elevation = createTestElevation(5, 5, 0);
    expect(canRaiseAt(2, 2, elevation)).toBe(true);
  });

  it('allows raising even when neighbors differ (RCT-style cliffs)', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    expect(canRaiseAt(2, 2, elevation)).toBe(true);
  });

  it('allows raising when within slope constraint', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 1;
    elevation[1][2] = 1;
    elevation[3][2] = 1;
    elevation[2][1] = 1;
    elevation[2][3] = 1;
    expect(canRaiseAt(2, 2, elevation)).toBe(true);
  });

  it('returns false for out-of-bounds coordinates', () => {
    const elevation = createTestElevation(5, 5, 0);
    expect(canRaiseAt(-1, 2, elevation)).toBe(false);
    expect(canRaiseAt(2, -1, elevation)).toBe(false);
    expect(canRaiseAt(10, 2, elevation)).toBe(false);
    expect(canRaiseAt(2, 10, elevation)).toBe(false);
  });

  it('handles edge tiles correctly', () => {
    const elevation = createTestElevation(5, 5, 0);
    expect(canRaiseAt(0, 0, elevation)).toBe(true);
    expect(canRaiseAt(4, 4, elevation)).toBe(true);
  });

  it('returns false for sparse array with undefined row', () => {
    const elevation: number[][] = [];
    elevation[0] = [0, 1];
    elevation[2] = [0, 1];
    elevation.length = 3;

    expect(canRaiseAt(0, 1, elevation)).toBe(false);
  });
});

describe('Lower Validation', () => {
  it('allows lowering elevated terrain', () => {
    const elevation = createTestElevation(5, 5, 1);
    expect(canLowerAt(2, 2, elevation)).toBe(true);
  });

  it('allows lowering even when neighbors differ (RCT-style cliffs)', () => {
    const elevation = createTestElevation(5, 5, 2);
    elevation[2][2] = 0;
    expect(canLowerAt(2, 2, elevation)).toBe(true);
  });

  it('prevents lowering below minimum elevation', () => {
    const elevation = createTestElevation(5, 5, -10);
    expect(canLowerAt(2, 2, elevation, 2, -10)).toBe(false);
  });

  it('returns false for out-of-bounds coordinates', () => {
    const elevation = createTestElevation(5, 5, 1);
    expect(canLowerAt(-1, 2, elevation)).toBe(false);
  });
});

describe('Apply Raise', () => {
  it('returns modification for valid raise', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mod = applyRaise(2, 2, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.x).toBe(2);
    expect(mod!.y).toBe(2);
    expect(mod!.oldElevation).toBe(0);
    expect(mod!.newElevation).toBe(1);
    expect(mod!.oldType).toBe(TERRAIN_CODES.FAIRWAY);
    expect(mod!.newType).toBe(TERRAIN_CODES.FAIRWAY);
  });

  it('allows raising any tile (RCT-style cliffs)', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    const layout = createTestLayout(5, 5);
    const mod = applyRaise(2, 2, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.oldElevation).toBe(2);
    expect(mod!.newElevation).toBe(3);
  });

  it('uses fallback terrain code for sparse layout', () => {
    const elevation = [[0, 1], [0, 1], [0, 1]];
    const layout: number[][] = [];
    layout[0] = [TERRAIN_CODES.FAIRWAY];
    // layout[1] is undefined
    layout[2] = [TERRAIN_CODES.FAIRWAY];
    layout.length = 3;

    const mod = applyRaise(0, 1, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.oldType).toBe(TERRAIN_CODES.ROUGH);  // Fallback
  });
});

describe('Apply Lower', () => {
  it('returns modification for valid lower', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5);
    const mod = applyLower(2, 2, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.oldElevation).toBe(1);
    expect(mod!.newElevation).toBe(0);
  });

  it('allows lowering any tile (RCT-style cliffs)', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[1][2] = 2;
    elevation[3][2] = 2;
    const layout = createTestLayout(5, 5);
    const mod = applyLower(2, 2, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.oldElevation).toBe(0);
    expect(mod!.newElevation).toBe(-1);
  });

  it('uses fallback terrain code for sparse layout', () => {
    const elevation = [[1, 1], [1, 1], [1, 1]];
    const layout: number[][] = [];
    layout[0] = [TERRAIN_CODES.FAIRWAY];
    // layout[1] is undefined
    layout[2] = [TERRAIN_CODES.FAIRWAY];
    layout.length = 3;

    const mod = applyLower(0, 1, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.oldType).toBe(TERRAIN_CODES.ROUGH);  // Fallback
  });
});

describe('Apply Flatten', () => {
  it('flattens to target elevation', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    const layout = createTestLayout(5, 5);
    const mod = applyFlatten(2, 2, elevation, layout, 1);

    expect(mod).not.toBeNull();
    expect(mod!.oldElevation).toBe(2);
    expect(mod!.newElevation).toBe(1);
  });

  it('flattens to neighbor average when no target specified', () => {
    const elevation = createTestElevation(5, 5, 2);
    elevation[2][2] = 0;
    const layout = createTestLayout(5, 5);
    const mod = applyFlatten(2, 2, elevation, layout);

    expect(mod).not.toBeNull();
    expect(mod!.newElevation).toBe(2);
  });

  it('returns null when already at target elevation', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5);
    const mod = applyFlatten(2, 2, elevation, layout, 1);

    expect(mod).toBeNull();
  });

  it('returns null when flatten would exceed slope constraint', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    // Target elevation of 5 with neighbors at 0 exceeds MAX_SLOPE_DELTA (2)
    const mod = applyFlatten(2, 2, elevation, layout, 5);

    expect(mod).toBeNull();
  });

  it('returns null for out-of-bounds coordinates', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mod = applyFlatten(10, 10, elevation, layout, 1);

    expect(mod).toBeNull();
  });

  it('returns null when no neighbors exist (1x1 grid without target)', () => {
    const elevation = [[5]];
    const layout = [[TERRAIN_CODES.FAIRWAY]];
    const mod = applyFlatten(0, 0, elevation, layout);

    expect(mod).toBeNull();
  });

  it('handles sparse layout array', () => {
    const elevation = [[0, 1, 2], [0, 1, 2], [0, 1, 2]];
    const layout: number[][] = [];
    layout[0] = [TERRAIN_CODES.FAIRWAY];
    // layout[1] is undefined
    layout[2] = [TERRAIN_CODES.FAIRWAY];
    layout.length = 3;

    const mod = applyFlatten(0, 1, elevation, layout, 1);

    // Should use fallback terrain code
    expect(mod).not.toBeNull();
  });
});

describe('Apply Smooth', () => {
  it('smooths area to average elevation', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    const layout = createTestLayout(5, 5);
    const mods = applySmooth(2, 2, elevation, layout, 1);

    expect(mods.length).toBeGreaterThan(0);
  });

  it('returns empty array when all elevations match average', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5);
    const mods = applySmooth(2, 2, elevation, layout, 1);

    expect(mods.length).toBe(0);
  });

  it('returns empty array when out of bounds', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods = applySmooth(100, 100, elevation, layout, 1);

    expect(mods.length).toBe(0);
  });

  it('smooths with larger radius', () => {
    const elevation = createTestElevation(10, 10, 0);
    elevation[5][5] = 4;
    const layout = createTestLayout(10, 10);
    const mods = applySmooth(5, 5, elevation, layout, 3);

    expect(mods.length).toBeGreaterThan(0);
  });
});

describe('Apply Terrain Type', () => {
  it('changes terrain type', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const mod = applyTerrainType(2, 2, elevation, layout, 'rough');

    expect(mod).not.toBeNull();
    expect(mod!.oldType).toBe(TERRAIN_CODES.FAIRWAY);
    expect(mod!.newType).toBe(TERRAIN_CODES.ROUGH);
  });

  it('returns null when type unchanged', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const mod = applyTerrainType(2, 2, elevation, layout, 'fairway');

    expect(mod).toBeNull();
  });

  it('returns null for out-of-bounds', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mod = applyTerrainType(10, 10, elevation, layout, 'rough');

    expect(mod).toBeNull();
  });

  it('returns null for x out of bounds with sparse layout', () => {
    const layout: number[][] = [];
    layout[0] = [TERRAIN_CODES.FAIRWAY];
    layout[2] = [TERRAIN_CODES.FAIRWAY];
    layout.length = 3;
    const elevation = [[0], [0], [0]];

    const mod = applyTerrainType(0, 1, elevation, layout, 'rough');

    expect(mod).toBeNull();
  });

  it('handles sparse elevation array', () => {
    const layout = createTestLayout(3, 3, TERRAIN_CODES.FAIRWAY);
    const elevation: number[][] = [];
    elevation[0] = [0, 1];
    elevation[2] = [0, 1];
    elevation.length = 3;

    const mod = applyTerrainType(0, 1, elevation, layout, 'rough');

    expect(mod).not.toBeNull();
    expect(mod!.oldElevation).toBe(0);  // Falls back to 0
  });
});

describe('Apply Tool', () => {
  it('applies raise tool', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods = applyTool('raise', 2, 2, elevation, layout);

    expect(mods.length).toBe(1);
    expect(mods[0].newElevation).toBe(1);
  });

  it('applies lower tool', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5);
    const mods = applyTool('lower', 2, 2, elevation, layout);

    expect(mods.length).toBe(1);
    expect(mods[0].newElevation).toBe(0);
  });

  it('applies terrain brush', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const mods = applyTool('terrain_bunker', 2, 2, elevation, layout);

    expect(mods.length).toBe(1);
    expect(mods[0].newType).toBe(TERRAIN_CODES.BUNKER);
  });

  it('applies tool with brush size', () => {
    const elevation = createTestElevation(10, 10, 0);
    const layout = createTestLayout(10, 10, TERRAIN_CODES.FAIRWAY);
    const mods = applyTool('terrain_rough', 5, 5, elevation, layout, 2);

    expect(mods.length).toBeGreaterThan(1);
  });

  it('applies flatten tool', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    const layout = createTestLayout(5, 5);
    // brushSize=1 only includes center (2,2), which is already at target=2
    // No modifications needed
    const mods = applyTool('flatten', 2, 2, elevation, layout);

    expect(mods.length).toBe(0);
  });

  it('applies flatten tool with brush size', () => {
    const elevation = createTestElevation(10, 10, 0);
    elevation[5][5] = 2;  // Center at 2, becomes target
    // Other cells in brush at 0 will be flattened to 2
    const layout = createTestLayout(10, 10);
    const mods = applyTool('flatten', 5, 5, elevation, layout, 2);

    // Cells (4,5), (5,4), (5,6), (6,5) are at 0, will be flattened to 2
    expect(mods.length).toBe(4);
    for (const mod of mods) {
      expect(mod.newElevation).toBe(2);  // Flattened to center elevation
    }
  });

  it('applies smooth tool', () => {
    const elevation = createTestElevation(5, 5, 0);
    elevation[2][2] = 2;
    const layout = createTestLayout(5, 5);
    const mods = applyTool('smooth', 2, 2, elevation, layout);

    expect(mods.length).toBeGreaterThan(0);
  });

  it('terrain brush returns empty when already same type', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.BUNKER);
    const mods = applyTool('terrain_bunker', 2, 2, elevation, layout);

    expect(mods.length).toBe(0);
  });

  it('raise returns empty on out-of-bounds', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods = applyTool('raise', 100, 100, elevation, layout);

    expect(mods.length).toBe(0);
  });

  it('lower returns empty on out-of-bounds', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods = applyTool('lower', 100, 100, elevation, layout);

    expect(mods.length).toBe(0);
  });

  it('flatten returns empty on out-of-bounds center', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods = applyTool('flatten', 100, 100, elevation, layout);

    expect(mods.length).toBe(0);
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

describe('Commit and Revert Modifications', () => {
  it('commits modifications to grid', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const mods: TileModification[] = [
      { x: 2, y: 2, oldElevation: 0, newElevation: 1, oldType: TERRAIN_CODES.FAIRWAY, newType: TERRAIN_CODES.ROUGH },
    ];

    commitModifications(mods, elevation, layout);

    expect(elevation[2][2]).toBe(1);
    expect(layout[2][2]).toBe(TERRAIN_CODES.ROUGH);
  });

  it('reverts modifications to grid', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.ROUGH);
    const mods: TileModification[] = [
      { x: 2, y: 2, oldElevation: 0, newElevation: 1, oldType: TERRAIN_CODES.FAIRWAY, newType: TERRAIN_CODES.ROUGH },
    ];

    revertModifications(mods, elevation, layout);

    expect(elevation[2][2]).toBe(0);
    expect(layout[2][2]).toBe(TERRAIN_CODES.FAIRWAY);
  });

  it('handles out-of-bounds modifications gracefully', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods: TileModification[] = [
      { x: 10, y: 10, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
  });

  it('handles negative x coordinate', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods: TileModification[] = [
      { x: -1, y: 2, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
    expect(elevation[2][0]).toBe(0); // Unchanged
  });

  it('handles negative y coordinate', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods: TileModification[] = [
      { x: 2, y: -1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
  });

  it('handles x out of bounds with valid y', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const mods: TileModification[] = [
      { x: 10, y: 2, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
    expect(elevation[2][4]).toBe(0); // Unchanged
  });

  it('reverts with out-of-bounds modifications gracefully', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.ROUGH);
    const mods: TileModification[] = [
      { x: 10, y: 10, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
      { x: -1, y: 2, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
      { x: 2, y: -1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
      { x: 10, y: 2, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => revertModifications(mods, elevation, layout)).not.toThrow();
  });

  it('handles sparse/jagged arrays for commit', () => {
    const elevation: number[][] = [[0, 1], [0]]; // Jagged array
    const layout: number[][] = [[0, 1], [0]]; // Jagged array
    const mods: TileModification[] = [
      { x: 1, y: 1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 }, // x=1 is out of bounds for row 1
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
    expect(elevation[1][0]).toBe(0); // Row 1 unchanged
  });

  it('handles sparse/jagged arrays for revert', () => {
    const elevation: number[][] = [[0, 1], [0]]; // Jagged array
    const layout: number[][] = [[0, 1], [0]]; // Jagged array
    const mods: TileModification[] = [
      { x: 1, y: 1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 }, // x=1 is out of bounds for row 1
    ];

    expect(() => revertModifications(mods, elevation, layout)).not.toThrow();
  });

  it('handles sparse array with undefined rows for commit', () => {
    // Create sparse array where row 1 is undefined
    const elevation: number[][] = [];
    elevation[0] = [0, 1];
    elevation[2] = [0, 1];
    elevation.length = 3;  // Row 1 is undefined
    const layout: number[][] = [];
    layout[0] = [0, 1];
    layout[2] = [0, 1];
    layout.length = 3;

    const mods: TileModification[] = [
      { x: 0, y: 1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 }, // Row 1 is undefined
    ];

    expect(() => commitModifications(mods, elevation, layout)).not.toThrow();
  });

  it('handles sparse array with undefined rows for revert', () => {
    const elevation: number[][] = [];
    elevation[0] = [0, 1];
    elevation[2] = [0, 1];
    elevation.length = 3;
    const layout: number[][] = [];
    layout[0] = [0, 1];
    layout[2] = [0, 1];
    layout.length = 3;

    const mods: TileModification[] = [
      { x: 0, y: 1, oldElevation: 0, newElevation: 1, oldType: 0, newType: 1 },
    ];

    expect(() => revertModifications(mods, elevation, layout)).not.toThrow();
  });
});

describe('Undo/Redo', () => {
  it('creates editor action with timestamp', () => {
    const mods: TileModification[] = [
      { x: 2, y: 2, oldElevation: 0, newElevation: 1, oldType: 0, newType: 0 },
    ];
    const action = createEditorAction(mods);

    expect(action.modifications).toBe(mods);
    expect(action.timestamp).toBeGreaterThan(0);
  });

  it('can undo when stack has items', () => {
    const undoStack: EditorAction[] = [createEditorAction([])];
    expect(canUndo(undoStack)).toBe(true);
  });

  it('cannot undo when stack is empty', () => {
    const undoStack: EditorAction[] = [];
    expect(canUndo(undoStack)).toBe(false);
  });

  it('can redo when stack has items', () => {
    const redoStack: EditorAction[] = [createEditorAction([])];
    expect(canRedo(redoStack)).toBe(true);
  });

  it('cannot redo when stack is empty', () => {
    const redoStack: EditorAction[] = [];
    expect(canRedo(redoStack)).toBe(false);
  });

  it('undo reverts changes and moves to redo stack', () => {
    const elevation = createTestElevation(5, 5, 1);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.ROUGH);
    const action = createEditorAction([
      { x: 2, y: 2, oldElevation: 0, newElevation: 1, oldType: TERRAIN_CODES.FAIRWAY, newType: TERRAIN_CODES.ROUGH },
    ]);
    const undoStack: EditorAction[] = [action];
    const redoStack: EditorAction[] = [];

    const undone = undo(undoStack, redoStack, elevation, layout);

    expect(undone).toBe(action);
    expect(undoStack.length).toBe(0);
    expect(redoStack.length).toBe(1);
    expect(elevation[2][2]).toBe(0);
    expect(layout[2][2]).toBe(TERRAIN_CODES.FAIRWAY);
  });

  it('redo reapplies changes and moves to undo stack', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const action = createEditorAction([
      { x: 2, y: 2, oldElevation: 0, newElevation: 1, oldType: TERRAIN_CODES.FAIRWAY, newType: TERRAIN_CODES.ROUGH },
    ]);
    const undoStack: EditorAction[] = [];
    const redoStack: EditorAction[] = [action];

    const redone = redo(undoStack, redoStack, elevation, layout);

    expect(redone).toBe(action);
    expect(undoStack.length).toBe(1);
    expect(redoStack.length).toBe(0);
    expect(elevation[2][2]).toBe(1);
    expect(layout[2][2]).toBe(TERRAIN_CODES.ROUGH);
  });

  it('undo returns null when stack is empty', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const undoStack: EditorAction[] = [];
    const redoStack: EditorAction[] = [];

    const result = undo(undoStack, redoStack, elevation, layout);

    expect(result).toBeNull();
    expect(redoStack.length).toBe(0);
  });

  it('redo returns null when stack is empty', () => {
    const elevation = createTestElevation(5, 5, 0);
    const layout = createTestLayout(5, 5);
    const undoStack: EditorAction[] = [];
    const redoStack: EditorAction[] = [];

    const result = redo(undoStack, redoStack, elevation, layout);

    expect(result).toBeNull();
    expect(undoStack.length).toBe(0);
  });
});

describe('Affected Tiles', () => {
  it('includes modified tiles and their neighbors', () => {
    const mods: TileModification[] = [
      { x: 5, y: 5, oldElevation: 0, newElevation: 1, oldType: 0, newType: 0 },
    ];
    const affected = getAffectedTiles(mods);

    expect(affected).toContainEqual({ x: 5, y: 5 });
    expect(affected).toContainEqual({ x: 5, y: 4 });
    expect(affected).toContainEqual({ x: 5, y: 6 });
    expect(affected).toContainEqual({ x: 4, y: 5 });
    expect(affected).toContainEqual({ x: 6, y: 5 });
    expect(affected).toContainEqual({ x: 4, y: 4 });
    expect(affected).toContainEqual({ x: 6, y: 6 });
  });

  it('deduplicates tiles when modifications overlap', () => {
    const mods: TileModification[] = [
      { x: 5, y: 5, oldElevation: 0, newElevation: 1, oldType: 0, newType: 0 },
      { x: 6, y: 5, oldElevation: 0, newElevation: 1, oldType: 0, newType: 0 },
    ];
    const affected = getAffectedTiles(mods);

    const uniqueKeys = new Set(affected.map(t => `${t.x},${t.y}`));
    expect(uniqueKeys.size).toBe(affected.length);
  });
});

describe('Export and Clone', () => {
  it('exports terrain data as deep copy', () => {
    const layout = createTestLayout(5, 5, TERRAIN_CODES.FAIRWAY);
    const elevation = createTestElevation(5, 5, 1);

    const exported = exportTerrainData(layout, elevation);

    layout[0][0] = TERRAIN_CODES.WATER;
    elevation[0][0] = 10;

    expect(exported.layout[0][0]).toBe(TERRAIN_CODES.FAIRWAY);
    expect(exported.elevation[0][0]).toBe(1);
  });

  it('clones grid as deep copy', () => {
    const grid = [[1, 2], [3, 4]];
    const cloned = cloneGrid(grid);

    grid[0][0] = 99;

    expect(cloned[0][0]).toBe(1);
  });
});
