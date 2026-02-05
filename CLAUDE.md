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
