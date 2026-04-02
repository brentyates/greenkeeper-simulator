import { spawnSync } from "node:child_process";

const PRESETS = {
  tutorial: [
    { scenario: "tutorial_basics", modes: ["baseline", "starter_all_course", "crew_territories"] },
  ],
  campaign: [
    { scenario: "tutorial_basics", modes: ["baseline", "starter_all_course", "crew_territories"] },
    { scenario: "meadowbrook_restoration", modes: ["baseline", "restoration_ops", "advanced_ops"] },
    { scenario: "meadowbrook_attendance", modes: ["baseline", "attendance_push", "advanced_ops"] },
    { scenario: "highlands_profit_challenge", modes: ["baseline", "crew_territories", "advanced_ops"] },
    { scenario: "highlands_satisfaction", modes: ["baseline", "restoration_ops", "advanced_ops"] },
    { scenario: "sunrise_valley_revenue", modes: ["baseline", "attendance_push", "advanced_ops"] },
    { scenario: "sunrise_valley_attendance", modes: ["baseline", "attendance_push", "advanced_ops"] },
    { scenario: "grand_summit_restoration", modes: ["baseline", "restoration_ops", "advanced_ops"] },
    { scenario: "grand_summit_excellence", modes: ["baseline", "restoration_ops", "advanced_ops"] },
    { scenario: "grand_summit_finale", modes: ["baseline", "advanced_ops"] },
  ],
};

function parseArgs(argv) {
  const config = {
    preset: "campaign",
    scenarios: null,
    modes: null,
    url: "http://127.0.0.1:4175",
    seed: 12345,
    repeats: 1,
    timeScale: 80,
    steps: 30,
    delayMs: 1500,
    headless: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--preset" && next) config.preset = next;
    if (arg === "--scenarios" && next) config.scenarios = next.split(",").map((value) => value.trim()).filter(Boolean);
    if (arg === "--modes" && next) config.modes = next.split(",").map((value) => value.trim()).filter(Boolean);
    if (arg === "--url" && next) config.url = next;
    if (arg === "--seed" && next) config.seed = Number(next);
    if (arg === "--repeats" && next) config.repeats = Number(next);
    if (arg === "--time-scale" && next) config.timeScale = Number(next);
    if (arg === "--steps" && next) config.steps = Number(next);
    if (arg === "--delay-ms" && next) config.delayMs = Number(next);
    if (arg === "--headed") config.headless = false;
  }

  return config;
}

function getRuns(config) {
  const presetRuns = PRESETS[config.preset] ?? PRESETS.campaign;
  return presetRuns
    .filter((entry) => config.scenarios == null || config.scenarios.includes(entry.scenario))
    .flatMap((entry) => {
      const modes = config.modes ?? entry.modes;
      return modes.flatMap((mode) =>
        Array.from({ length: Math.max(1, config.repeats) }, (_, repeatIndex) => ({
          scenario: entry.scenario,
          mode,
          repeatIndex,
          seed: Number.isFinite(config.seed) ? config.seed + repeatIndex : null,
        }))
      );
    });
}

function executeRun(run, config) {
  const args = [
    "tools/playtests/scenario-playtest.mjs",
    "--scenario",
    run.scenario,
    "--mode",
    run.mode,
    "--url",
    config.url,
    "--seed",
    String(run.seed),
    "--time-scale",
    String(config.timeScale),
    "--steps",
    String(config.steps),
    "--delay-ms",
    String(config.delayMs),
  ];
  if (!config.headless) {
    args.push("--headed");
  }

  let lastFailure = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = spawnSync("node", args, {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    if (result.status === 0) {
      const parsed = JSON.parse(result.stdout);
      parsed.config = {
        ...parsed.config,
        repeatIndex: run.repeatIndex,
        seed: run.seed,
        attempt,
      };
      return parsed;
    }

    lastFailure = result.stderr || result.stdout;
  }

  throw new Error(`Playtest failed for ${run.scenario}/${run.mode}\n${lastFailure}`);
}

function summarize(results) {
  return results.map((result) => {
    const final = result.final ?? {};
    return {
      scenario: result.scenario,
      objectiveType: result.objectiveType,
      mode: result.config.mode,
      repeatIndex: result.config.repeatIndex ?? 0,
      seed: result.config.seed ?? null,
      completed: Boolean(final.completed),
      failed: Boolean(final.failed),
      failureReason: final.failureReason ?? null,
      progressPct: final.progressPct ?? null,
      daysElapsed: final.daysElapsed ?? null,
      cash: final.cash ?? null,
      health: final.health ?? null,
      revenue: final.revenue ?? null,
      expenses: final.expenses ?? null,
      employees: final.employees ?? null,
      robots: final.robots ?? null,
      completedResearch: final.completedResearch ?? null,
    };
  });
}

function toMedian(values) {
  const filtered = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (filtered.length === 0) return null;
  const mid = Math.floor(filtered.length / 2);
  if (filtered.length % 2 === 1) return filtered[mid];
  return Number(((filtered[mid - 1] + filtered[mid]) / 2).toFixed(2));
}

function aggregate(results) {
  const groups = new Map();

  for (const result of summarize(results)) {
    const key = `${result.scenario}::${result.mode}`;
    const current = groups.get(key) ?? [];
    current.push(result);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, runs]) => {
    const [scenario, mode] = key.split("::");
    const completions = runs.filter((run) => run.completed).length;
    const failures = runs.filter((run) => run.failed).length;
    const failureReasons = Object.fromEntries(
      Array.from(
        runs
          .filter((run) => run.failureReason)
          .reduce((counts, run) => {
            counts.set(run.failureReason, (counts.get(run.failureReason) ?? 0) + 1);
            return counts;
          }, new Map())
          .entries()
      ).sort((a, b) => a[0].localeCompare(b[0]))
    );

    return {
      scenario,
      mode,
      objectiveType: runs[0]?.objectiveType ?? null,
      runs: runs.length,
      completedRuns: completions,
      failedRuns: failures,
      completionRate: Number((completions / runs.length).toFixed(2)),
      failureReasons,
      medianProgressPct: toMedian(runs.map((run) => run.progressPct)),
      medianDaysElapsed: toMedian(runs.map((run) => run.daysElapsed)),
      medianCash: toMedian(runs.map((run) => run.cash)),
      medianHealth: toMedian(runs.map((run) => run.health)),
      medianRevenue: toMedian(runs.map((run) => run.revenue)),
      medianExpenses: toMedian(runs.map((run) => run.expenses)),
      medianEmployees: toMedian(runs.map((run) => run.employees)),
      medianRobots: toMedian(runs.map((run) => run.robots)),
      medianCompletedResearch: toMedian(runs.map((run) => run.completedResearch)),
    };
  });
}

const config = parseArgs(process.argv.slice(2));
const runs = getRuns(config);
const results = [];

for (const run of runs) {
  results.push(executeRun(run, config));
}

console.log(JSON.stringify({
  config,
  runs: summarize(results),
  aggregates: aggregate(results),
}, null, 2));
