# Playtesting

This project now has three repeatable playtest lanes:

1. Fast balance passes
2. Continuous player-like playability passes
3. Real-time usability passes

For any Babylon UI automation, use the semantic automation layer described in [UI_AUTOMATION_LAYER.md](/Users/byates/projects/greenkeeper-simulator/docs/UI_AUTOMATION_LAYER.md) before falling back to raw coordinates.

The goal is to catch different classes of problems quickly without confusing hidden runtime control with real player operability.

## Fast Balance Passes

Use the Playwright harness in [`scenario-playtest.mjs`](/Users/byates/projects/greenkeeper-simulator/tools/playtests/scenario-playtest.mjs) for a single scenario, or [`scenario-matrix.mjs`](/Users/byates/projects/greenkeeper-simulator/tools/playtests/scenario-matrix.mjs) for a sweep.

Example runs:

```bash
node tools/playtests/scenario-playtest.mjs --scenario tutorial_basics --mode baseline
node tools/playtests/scenario-playtest.mjs --scenario tutorial_basics --mode starter_all_course
node tools/playtests/scenario-playtest.mjs --scenario tutorial_basics --mode crew_territories
node tools/playtests/scenario-matrix.mjs --preset tutorial
node tools/playtests/scenario-matrix.mjs --preset campaign
```

Useful flags:

```bash
--seed 12345
--time-scale 80
--steps 40
--delay-ms 1500
--url http://127.0.0.1:4175
--headed
```

What the harness does:

- Opens the local game in Playwright
- Starts a scenario through the runtime hook
- Auto-continues the day summary popup
- Applies a simple management strategy for the selected mode
- Supports deterministic seeded runs so the same test case can be replayed
- Supports mode families for staffing, restoration, attendance, and later advanced research/robot strategies
- Logs revenue, expenses, cash, rounds, golfers, health, day/time, objective progress, research state, and robot state

For UI-driven tests outside the scenario harness, enable the automation layer first:

```js
window.__uiDebug.setDomMirrorsEnabled(true);
window.__uiDebug.getState();
```

Preferred interaction order for agentic testing:

1. `data-ui-debug-id` DOM mirror selectors
2. real keyboard input
3. raw mouse coordinates only when necessary

For balance passes, controlled runtime hooks are acceptable because the goal is comparative simulation signal rather than strict player realism.

Recommended balance workflow:

1. Run `baseline` first.
2. Run one or two managed modes with the same `--seed`.
3. Repeat with several seeds or use the matrix runner with `--repeats`.
4. Compare `progressPct`, `cash`, `health`, and `daysElapsed` across the group, not just one run.
5. If unmanaged play is too close to managed play, demand or maintenance pressure is too soft.
6. If every managed mode trends negative, wages, upkeep, or throughput are too harsh.

Current useful modes:

- `baseline`
  Leaves the scenario mostly alone.
- `starter_all_course`
  Keeps the starter worker assigned to the whole course.
- `crew_territories`
  Hires up to three groundskeepers and assigns simple area/focus roles.
- `restoration_ops`
  Biases toward watering/fertilizing and starts light research.
- `attendance_push`
  Biases toward throughput and attendance-friendly maintenance.
- `advanced_ops`
  Higher research funding, stronger crew setup, and early robot purchase attempts when the scenario and unlocks support it.

## Matrix Sweeps

Use the matrix runner when you want campaign-wide balance signal instead of a one-off scenario check.

Example:

```bash
node tools/playtests/scenario-matrix.mjs --preset campaign
node tools/playtests/scenario-matrix.mjs --preset campaign --scenarios tutorial_basics,meadowbrook_restoration
node tools/playtests/scenario-matrix.mjs --preset campaign --modes baseline,advanced_ops
node tools/playtests/scenario-matrix.mjs --preset tutorial --repeats 5 --seed 2000
```

The matrix output includes both per-run data and aggregate summaries per `scenario + mode`.

Per run:

- `scenario`
- `objectiveType`
- `mode`
- `repeatIndex`
- `seed`
- `completed` / `failed`
- `failureReason`
- `progressPct`
- `daysElapsed`
- `cash`
- `health`
- `revenue`
- `expenses`
- `employees`
- `robots`
- `completedResearch`

Aggregates:

- `runs`
- `completedRuns`
- `failedRuns`
- `completionRate`
- `failureReasons`
- median `progressPct`, `daysElapsed`, `cash`, `health`, `revenue`, `expenses`

Use that output to spot:

- scenarios where `baseline` passes too often
- scenarios where one lucky run hides a bad average
- scenarios where every strategy fails the same way
- scenarios that never touch research or robots even when they should
- scenarios that need better policy coverage in the harness

## Continuous Player-Like Playability Passes

Use this lane when the requirement is that an agent can keep playing the game through the same surfaces a user would.

This lane is stricter than the balance harness:

- the agent should enter through visible launch and scenario flows when available
- the agent should use `window.__uiDebug` selectors and keyboard input before hidden runtime hooks
- the agent should survive day summaries, pauses, and panel interruptions
- if a critical action is only available through `window.game.*`, treat that as a playability gap

Preferred interaction order for this lane:

1. `data-ui-debug-id` DOM mirror selectors
2. real keyboard input
3. raw mouse coordinates only when necessary
4. runtime hooks only for bootstrap or diagnostics

Recommended playability workflow:

1. Run at `1x` speed first.
2. Enable DOM mirrors and inspect `window.__uiDebug.getState()`.
3. Start a scenario through the user-visible flow where possible.
4. Drive routine management through HUD actions, dialogs, and panels for several in-game days.
5. Confirm the run recovers from popups and continues making progress.
6. Fix missing semantic ids or unstable flows before expanding the harness.

Automated player-playability runner:

```bash
npm run playtest:player -- --scenario tutorial_basics
npm run playtest:player -- --scenario tutorial_basics --target-days 5 --speed-ups 2
npm run playtest:player -- --scenario meadowbrook_restoration --headed
npm run playtest:player:matrix -- --preset progression --target-days 1
```

Current runner defaults are tuned for unattended soak behavior:

- `--poll-ms` defaults to `400`
- `--max-steps` scales automatically with `targetDays` when you do not set it explicitly
- repeated `observe` and `wait_for_applications` actions are treated as normal if game time is still advancing
- repeated open/close churn on the same panel is treated as a harness-policy loop

What this runner does:

- enters through the launch screen and scenario card flow
- enables `window.__uiDebug` DOM mirrors
- uses HUD and panel controls to manage crew and research
- continues day summaries and survives pause interruptions
- waits on legitimate player-visible delays such as posted job applications instead of thrashing the panel
- refreshes applications through the real visible crew flow and avoids revisiting crew when staffing is already satisfied
- writes a structured run report plus screenshots under `test-results/player-playability/`
- writes a repair packet under `.agent-harness/repair-jobs/` when the run fails

The runner may read `window.game.*` state for diagnostics and progress checks, but control should still happen through the visible UI path.

Treat a failed run as the start of the repair loop:

1. Open the generated `repair-packet.json`, `brief.md`, and `handoff.md`.
2. Fix the player-facing issue or missing automation coverage.
3. Rerun the same playability command.
4. Repeat until the scenario advances through the failure surface unattended.

Not every failure should spend AI repair budget:

- `run_budget_exhausted` means the run was still making healthy progress and needs more soak budget, not code changes
- `environment_unavailable` means the app URL was unreachable
- player-policy loops or visible UI gaps are the failures worth routing into self-heal

## Player Soak Matrix

Use the player soak matrix when you want unattended playability coverage across more than one scenario.

Example runs:

```bash
npm run playtest:player:matrix -- --preset tutorial --target-days 1
npm run playtest:player:matrix -- --preset progression --target-days 1 --repeats 2
npm run playtest:player:matrix -- --scenarios tutorial_basics,meadowbrook_restoration --target-days 2
```

What it does:

- starts the local dev server once when needed
- runs the real player harness across a scenario preset or explicit scenario list
- keeps the same player-like UI policy for every run
- emits per-run results plus per-scenario aggregates

Use it to answer:

- which scenarios actually remain playable unattended
- which failures are scenario-specific versus policy-wide
- whether longer soaks degrade into budget exhaustion, objective failure, or UI loops

## Real-Time Usability Passes

Use the same harness at `1x` speed first:

```bash
node tools/playtests/scenario-playtest.mjs --scenario tutorial_basics --mode starter_all_course --time-scale 1 --steps 12 --delay-ms 5000 --headed
```

Then do one manual session in a normal browser.

Real-time usability checks should answer:

- Can I tell what to do in the first 30 seconds?
- Can I find employees, assign coverage, and understand the result?
- Do pauses, day summaries, and notifications interrupt work too much?
- Can I tell why the course is succeeding or failing?
- Is the HUD readable at normal speed without needing fast-forward context?
- Are the automation-layer control ids sufficient to target every critical mouse-first flow?

## What To Record

For every playtest, keep these notes:

- Scenario and mode
- Time scale
- Final objective progress
- Final cash
- Final health
- Whether failure came from money, time, or neglected turf
- Any UI friction that slowed decision-making
- Whether research, hiring, or robots mattered to the result

## Why All Three Lanes Matter

Fast-forward tests are best for:

- economy tuning
- staffing balance
- demand sensitivity
- scenario tuning

Real-time tests are best for:

- HUD clarity
- discoverability
- panel flow
- notification quality
- pacing

Continuous player-like passes are best for:

- proving that the game remains operable through real user-facing controls
- catching control coverage gaps in `window.__uiDebug`
- ensuring long unattended sessions do not get stuck on popups or hidden state changes

You need all three. A game can be numerically balanced at `80x`, manually understandable at `1x`, and still fail unattended player-like operation if the real control path is brittle.

## Future Extension: Course Variants

Longer term, the real balance matrix should be:

- `scenario x course variant x strategy`

That matters because some failures will come from the objective tuning, and others will come from the starting course layout itself:

- routing and travel distance
- irrigation coverage
- bunker count and maintenance load
- zone split quality
- terrain stress concentration

When that extension lands, the harness should report `courseVariant` alongside `scenario` and `mode`, so we can separate a bad scenario from a bad map setup.
