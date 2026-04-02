# CLAUDE.md

## Build Commands

```bash
npm run dev           # Start development server (Vite)
npm run build         # TypeScript check + production build
npm run test          # Run unit tests (Vitest)
npm run test:watch    # Run unit tests in watch mode
npm run test:coverage # Run unit tests with coverage report
npm run test:e2e      # Run Playwright E2E tests
npm run lint:e2e      # Lint E2E tests for API compliance
npm run assets:manifest  # Generate JSON manifest for Blender tools
npm run wasm:build    # Build Rust pathfinding WASM module
npm run wasm:dev      # Build WASM module (dev/debug mode)
```

## Architecture

ALL input (keyboard, mouse, tests) flows through the public API in `BabylonMain.ts`. E2E tests must use `window.game.*` methods, not canvas clicks or key simulation.

## 3D Asset Pipeline

The game uses Babylon.js with an orthographic camera for an isometric 3D look. All visual assets are GLB models loaded via `AssetLoader.ts`.

**Key files:**
- `src/babylon/assets/AssetManifest.ts` - Single source of truth for all game assets
- `src/babylon/assets/AssetLoader.ts` - Loads GLB files with caching and placeholder fallback
- `src/babylon/assets/PlaceholderMeshes.ts` - Magenta wireframe box for missing GLB files
- `tools/blender/ASSET_CONVENTIONS.md` - Blender modeling conventions

**Workflow:** Define asset in manifest → Create GLB in Blender → Place in `/public/assets/models/`

Missing GLB files automatically use placeholder meshes (magenta wireframe boxes sized from manifest specs). See `docs/ASSET_PIPELINE.md` for full details.

## Terrain Architecture

Topology (vertices/edges/faces) is the source of truth for terrain geometry and types.

- **Grid-generated courses**: `gridToTopology()` builds topology from `CourseData.layout`
- **Organic courses**: `CourseData.topology` has pre-built Delaunay topology from polygon regions
- **Face states** drive gameplay simulation (moisture, nutrients, grass height per triangle)
- Grid APIs in TerrainMeshSystem are backed by topology lookups
