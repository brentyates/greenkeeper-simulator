# Agent Harnesses

Automated playtest and repair tooling for the greenkeeper simulator.

## Harnesses

### Player Playability
Drives the game through real UI surfaces the way a player would.
```bash
npm run playtest:player -- --scenario tutorial_basics
```

### Player Soak Matrix
Runs the player playability harness across multiple scenarios.
```bash
npm run playtest:player:matrix -- --preset progression --target-days 1
```

### Scenario Balance
Fast-forward simulation for economy and progression tuning.
```bash
node tools/playtests/scenario-playtest.mjs --scenario tutorial_basics --mode baseline
node tools/playtests/scenario-matrix.mjs --preset campaign
```

### Self-Heal Loop
Runs the player harness, then invokes a coding agent to patch failures automatically.
```bash
npm run selfheal:player -- --scenario tutorial_basics
```
Outcome buckets:
- **playability failure** - generates repair packet, invokes repair agent
- **run budget exhausted** - stops without AI spend (needs more soak budget, not code)
- **environment unavailable** - stops without AI spend

Bounded by `--max-iterations`. The harness run costs no AI credits; only repair does.

### UI Automation Bridge
`src/automation/UIAutomationBridge.ts` provides DOM mirrors for Babylon GUI controls
on `window.__uiDebug`. See `docs/UI_AUTOMATION_LAYER.md`.

## Filesystem Contract

Repair artifacts from failed player runs: `.agent-harness/repair-jobs/`
Self-heal loop artifacts: `.agent-harness/self-heal/`

## Project-Specific Rules

### Runtime and Gameplay
- Use `window.game.*` and the public surfaces from `BabylonMain.ts`.
- Do not simulate arbitrary canvas clicks when a public hook exists.

### Babylon UI
- Use `window.__uiDebug` first for state inspection and interaction.
- Prefer DOM mirrors with `data-ui-debug-id`.
- Add semantic ids when a critical flow is not yet automatable.
- Preferred order: semantic selectors, then keyboard input, then coordinate fallback.

### Player-Like Operation
If the goal is playability, the agent must behave like a player:
- Enter through launch and scenario UI when available.
- Use management panels, HUD actions, dialogs, and keyboard controls.
- Survive day summaries, pauses, and interruptions.
- Only use `window.game.*` for bootstrap or diagnostics when the player path does not exist.

If a feature can only be driven through hidden runtime hooks, that is a harness finding,
not a successful playability run.
