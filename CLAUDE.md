# CLAUDE.md

## Build Commands

```bash
npm run dev           # Start development server (Vite)
npm run build         # TypeScript check + production build
npm run test          # Run unit tests (Vitest)
npm run test:e2e      # Run Playwright E2E tests
npm run lint:e2e      # Lint E2E tests for API compliance
npm run assets:manifest  # Generate JSON manifest for Blender tools
```

## Architecture

ALL input (keyboard, mouse, tests) flows through the public API in `BabylonMain.ts`. E2E tests must use `window.game.*` methods, not canvas clicks or key simulation.

## 3D Asset Pipeline

The game uses Babylon.js with an orthographic camera for an isometric 3D look. All visual assets are GLB models loaded via `AssetLoader.ts`.

**Key files:**
- `src/babylon/assets/AssetManifest.ts` - Single source of truth for all 101 assets
- `src/babylon/assets/AssetLoader.ts` - Loads GLB files with caching and placeholder fallback
- `src/babylon/assets/PlaceholderMeshes.ts` - Magenta wireframe box for missing GLB files
- `tools/blender/ASSET_CONVENTIONS.md` - Blender modeling conventions

**Workflow:** Define asset in manifest → Create GLB in Blender → Place in `/public/assets/models/`

Missing GLB files automatically use placeholder meshes (magenta wireframe boxes sized from manifest specs). See `docs/ASSET_PIPELINE.md` for full details.

---

## ⚠️ MIGRATION: Remove Legacy RCT Corner Heights System

**Status:** IN PROGRESS - Delete this section when complete

The terrain system has legacy RCT-style corner heights code that conflicts with the new vertex-based topology. The new `VectorTerrainSystem` uses per-vertex elevation, but is forced to implement a compatibility shim for the old corner-based interface.

### What Needs To Change

#### Phase 1: Update TileHighlightSystem (breaks the dependency)

`TileHighlightSystem.ts` uses `CornerHeightsProvider` for two things:
1. `createHighlightMeshAt()` - draws quad over cell using 4 corner heights
2. `createHighlightCornerMesh()` - draws diamond at a cell corner

**Fix:** Replace `CornerHeightsProvider` with a new `ElevationProvider` interface:
```typescript
// NEW interface (replaces CornerHeightsProvider)
interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number): number;
  gridTo3D(gridX: number, gridY: number, elev: number): Vector3;
}
```
Then sample elevations at the 4 corners directly: `getElevationAt(x, y)`, `getElevationAt(x+1, y)`, etc.

**Files to modify:**
- `src/babylon/systems/TileHighlightSystem.ts` - Replace interface and update both methods
- `src/babylon/systems/TerrainEditorSystem.ts` - Update constructor parameter type

#### Phase 2: Remove from TerrainSystemInterface

Delete line 28 from `TerrainSystemInterface.ts`:
```typescript
// DELETE THIS LINE:
getCornerHeightsPublic(gridX: number, gridY: number): { nw: number; ne: number; se: number; sw: number };
```

**Files to modify:**
- `src/babylon/systems/TerrainSystemInterface.ts` - Remove method from interface
- `src/babylon/systems/VectorTerrainSystem.ts` - Delete `getCornerHeightsPublic()` shim (lines 2038-2049)
- `src/babylon/systems/GrassSystem.ts` - Keep internal `getCornerHeights()` but remove `getCornerHeightsPublic()`
- `src/babylon/BabylonMain.ts` - Remove `getCornerHeights` from cornerProvider object (lines 505-507)

#### Phase 3: Clean Up terrain.ts

Delete or deprecate RCT-specific code in `src/core/terrain.ts`:

**DELETE (lines ~217-760):**
- `CornerHeights` interface
- `RCTCornerHeights` interface
- `SlopeType` type
- `getCornerHeights()`, `getSlopeType()`, `calculateSlopeAngle()`, `getTileNormal()`, `getSlopeFrictionModifier()`
- `getOptimalDiagonal()`, `getBaseElevationForSlope()`
- All `validateSlope*` functions
- `RCTTileFlags`, `RCTTileData`, `RCTTerrainData` interfaces
- `createRCTTileData()`, `parseRCTTileHeights()`, `exportToRCTFormat()`, `importFromRCTFormat()`

**Also delete tests in `terrain.test.ts`:**
- All `describe('RCT...')` blocks
- All `describe('Slope Constraints (RCT Spec...')` blocks
- Tests for `getSlopeType`, `calculateSlopeAngle`, `getTileNormal`, corner heights

#### Phase 4: Remove GrassSystem (optional, larger effort)

`GrassSystem.ts` is the old 2D isometric renderer that heavily uses corner heights. Once VectorTerrainSystem is stable, GrassSystem can be removed entirely.

**Files to delete:**
- `src/babylon/systems/GrassSystem.ts` (~1500 lines)

**Files to update:**
- `src/babylon/BabylonMain.ts` - Remove GrassSystem import and fallback code (lines 4, 440, 2074)

### Dependency Graph

```
TerrainSystemInterface.getCornerHeightsPublic()
    ↑
    ├── VectorTerrainSystem.getCornerHeightsPublic() [SHIM - delete]
    ├── GrassSystem.getCornerHeightsPublic() [OLD SYSTEM]
    │
    └── BabylonMain.cornerProvider.getCornerHeights()
            ↓
        TerrainEditorSystem(cornerProvider)
            ↓
        TileHighlightSystem(cornerProvider)  ← FIX THIS FIRST
            ↓
        createHighlightMeshAt() / createHighlightCornerMesh()
```

### Testing After Migration

1. Run `npm run test` - terrain.test.ts will have fewer tests
2. Run `npm run build` - ensure no TypeScript errors
3. Manual test: Open terrain editor, verify cell/vertex highlights render correctly
4. Manual test: Sculpt terrain, verify highlights follow elevation changes
