# CLAUDE.md

## Build Commands

```bash
npm run dev           # Start development server (Vite)
npm run build         # TypeScript check + production build
npm run test          # Run unit tests (Vitest)
npm run test:e2e      # Run Playwright E2E tests
npm run lint:e2e      # Lint E2E tests for API compliance
```

## Architecture

ALL input (keyboard, mouse, tests) flows through the public API in `BabylonMain.ts`. E2E tests must use `window.game.*` methods, not canvas clicks or key simulation.
