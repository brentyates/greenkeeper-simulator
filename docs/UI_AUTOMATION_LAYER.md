# UI Automation Layer

This project exposes a semantic automation layer for the Babylon UI so agentic tests do not need to rely on raw pixel guessing.

Use this layer for programmatic mouse/keyboard testing of the real UI.

## Why It Exists

The game is rendered through a full-screen Babylon canvas:

- there are no native DOM buttons for Playwright to target
- pointer hit areas are custom Babylon controls
- a pure screenshot-and-coordinate workflow is too brittle

The automation layer solves that by exposing:

- semantic control ids
- live visibility and enabled state
- live screen bounds
- optional DOM mirror elements for stable selector-based clicking
- current screen and panel state

It is intentionally an **introspection and UI targeting layer**, not a gameplay cheat API.

## Runtime API

The layer is available on `window.__uiDebug`.

Example:

```js
const state = window.__uiDebug.getState();
console.log(state.menuState);
console.log(state.controls);
```

Available methods:

```js
window.__uiDebug.getState();
window.__uiDebug.listControls();
window.__uiDebug.click("menu.new_game");
window.__uiDebug.focusCanvas();
window.__uiDebug.setDomMirrorsEnabled(true);
window.__uiDebug.setHighlightsEnabled(true);
```

## State Shape

`getState()` returns:

- app-level screen state such as `menuState`
- game-level state when a round is running
- `controls`: semantic UI controls with ids, labels, roles, enabled state, and bounds
- `canvasFocused`
- `domMirrorsEnabled`
- `highlightsEnabled`

Control entry example:

```json
{
  "id": "menu.new_game",
  "label": "New Game",
  "role": "button",
  "visible": true,
  "enabled": true,
  "bounds": { "x": 407, "y": 920, "width": 184, "height": 44 }
}
```

## DOM Mirrors

For selector-based automation, enable mirror elements:

```js
window.__uiDebug.setDomMirrorsEnabled(true);
```

This creates fixed-position DOM buttons with:

- `data-ui-debug-id="<control-id>"`
- matching bounds to the Babylon control
- click behavior wired to the real UI action

Example Playwright usage:

```js
await page.evaluate(() => window.__uiDebug.setDomMirrorsEnabled(true));
await page.locator('[data-ui-debug-id="menu.new_game"]').click();
await page.locator('[data-ui-debug-id="hud.manage.crew"]').click();
```

If you want the mirrors to be visible while debugging:

```js
await page.evaluate(() => {
  window.__uiDebug.setDomMirrorsEnabled(true);
  window.__uiDebug.setHighlightsEnabled(true);
});
```

## Recommended Usage

For any agentic UI test:

1. Enable DOM mirrors.
2. Read `window.__uiDebug.getState()`.
3. Call `window.__uiDebug.focusCanvas()` before keyboard-driven gameplay input.
4. Interact through `data-ui-debug-id` selectors when possible.
5. Fall back to real keyboard input for navigation flows.
6. Use raw coordinate clicks only when a surface is not yet mirrored.

Preferred order:

1. semantic DOM mirror click
2. keyboard input
3. raw mouse coordinates

## Current Coverage

The layer currently covers:

- launch screen scenario cards and primary actions
- in-game HUD mode controls
- in-game HUD management dock actions
- pause menu actions
- employee panel open, close, select, assignment, applications, and hiring actions
- research panel open, close, funding, category, and start/cancel actions
- app/game screen state
- panel visibility state for the main in-game management surfaces

Coverage should expand whenever a new critical interaction surface is added.

## Rule For Future Work

Any new important Babylon UI control should ship with:

- a stable semantic id
- registration in the automation layer
- mirror support if it is a primary interaction surface

Do not add major new UI without wiring it into `window.__uiDebug`.
