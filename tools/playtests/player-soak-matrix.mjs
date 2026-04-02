import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PRESETS = {
  tutorial: [
    "tutorial_basics",
  ],
  progression: [
    "tutorial_basics",
    "meadowbrook_restoration",
    "meadowbrook_attendance",
  ],
  campaign: [
    "tutorial_basics",
    "meadowbrook_restoration",
    "meadowbrook_attendance",
    "highlands_profit_challenge",
    "highlands_satisfaction",
    "sunrise_valley_revenue",
    "sunrise_valley_attendance",
    "grand_summit_restoration",
    "grand_summit_excellence",
    "grand_summit_finale",
  ],
};

const UNLOCK_AFTER = {
  tutorial_basics: null,
  meadowbrook_restoration: "tutorial_basics",
  meadowbrook_attendance: "meadowbrook_restoration",
  highlands_profit_challenge: "meadowbrook_attendance",
  highlands_satisfaction: "highlands_profit_challenge",
  sunrise_valley_revenue: "highlands_satisfaction",
  sunrise_valley_attendance: "sunrise_valley_revenue",
  grand_summit_restoration: "sunrise_valley_attendance",
  grand_summit_excellence: "grand_summit_restoration",
  grand_summit_finale: "grand_summit_excellence",
};

function parseArgs(argv) {
  const config = {
    preset: "progression",
    scenarios: null,
    strategies: ["adaptive"],
    url: "http://127.0.0.1:4175",
    targetDays: 1,
    repeats: 1,
    pollMs: 250,
    maxSteps: null,
    targetCrew: 2,
    speedUps: 4,
    headless: true,
    startDevServer: true,
    devCommand: "npm run dev -- --host 127.0.0.1 --port 4175",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--preset" && next) config.preset = next;
    if (arg === "--scenarios" && next) config.scenarios = next.split(",").map((value) => value.trim()).filter(Boolean);
    if (arg === "--strategies" && next) config.strategies = next.split(",").map((value) => value.trim()).filter(Boolean);
    if (arg === "--url" && next) config.url = next;
    if (arg === "--target-days" && next) config.targetDays = Number(next);
    if (arg === "--repeats" && next) config.repeats = Number(next);
    if (arg === "--poll-ms" && next) config.pollMs = Number(next);
    if (arg === "--max-steps" && next) config.maxSteps = Number(next);
    if (arg === "--target-crew" && next) config.targetCrew = Number(next);
    if (arg === "--speed-ups" && next) config.speedUps = Number(next);
    if (arg === "--headed") config.headless = false;
    if (arg === "--no-dev-server") config.startDevServer = false;
    if (arg === "--dev-command" && next) config.devCommand = next;
  }

  return config;
}

function getScenarioRuns(config) {
  const scenarios = config.scenarios ?? PRESETS[config.preset] ?? PRESETS.progression;
  const strategies = config.strategies?.length ? config.strategies : ["adaptive"];
  return scenarios.flatMap((scenario) =>
    strategies.flatMap((strategy) =>
      Array.from({ length: Math.max(1, config.repeats) }, (_, repeatIndex) => ({
        scenario,
        strategy,
        repeatIndex,
      }))
    )
  );
}

function getCompletedScenarioBootstrap(scenario) {
  const completed = [];
  let cursor = UNLOCK_AFTER[scenario] ?? null;
  while (cursor) {
    completed.unshift(cursor);
    cursor = UNLOCK_AFTER[cursor] ?? null;
  }
  return completed;
}

async function canReach(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function startDevServer(config, runDir) {
  if (!config.startDevServer) {
    return null;
  }
  if (await canReach(config.url)) {
    return { process: null, startedHere: false, logFile: null };
  }

  const logFile = path.join(runDir, "dev-server.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  const child = spawn(config.devCommand, {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await canReach(config.url)) {
      return { process: child, startedHere: true, logFile };
    }
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited early. See ${logFile}`);
    }
    await delay(1000);
  }

  child.kill("SIGINT");
  throw new Error(`Timed out waiting for dev server at ${config.url}. See ${logFile}`);
}

function stopDevServer(handle) {
  if (!handle?.startedHere || !handle.process) {
    return;
  }
  handle.process.kill("SIGINT");
}

function executeRun(run, config) {
  const args = [
    "tools/playtests/player-playability.mjs",
    "--scenario",
    run.scenario,
    "--strategy",
    run.strategy,
    "--url",
    config.url,
    "--target-days",
    String(config.targetDays),
    "--poll-ms",
    String(config.pollMs),
    "--target-crew",
    String(config.targetCrew),
    "--speed-ups",
    String(config.speedUps),
  ];
  if (Number.isFinite(config.maxSteps)) {
    args.push("--max-steps", String(config.maxSteps));
  }
  const completedScenarios = getCompletedScenarioBootstrap(run.scenario);
  if (completedScenarios.length > 0) {
    args.push("--completed-scenarios", completedScenarios.join(","));
  }
  if (!config.headless) {
    args.push("--headed");
  }

  const result = spawnSync("node", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout = result.stdout?.trim() ?? "";
  const jsonStart = stdout.indexOf("{");
  if (result.status !== 0 || jsonStart === -1) {
    throw new Error(`Player soak run failed for ${run.scenario}\n${result.stderr || result.stdout}`);
  }

  return {
    ...JSON.parse(stdout.slice(jsonStart)),
    matrixRun: run,
  };
}

function toMedian(values) {
  const filtered = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (filtered.length === 0) return null;
  const middle = Math.floor(filtered.length / 2);
  if (filtered.length % 2 === 1) return filtered[middle];
  return Number(((filtered[middle - 1] + filtered[middle]) / 2).toFixed(2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function inferObjectiveType(summary) {
  const scenario = summary.scenario ?? "";
  if (scenario.includes("attendance") || scenario.includes("revenue")) return "attendance";
  if (scenario.includes("restoration")) return "restoration";
  if (scenario.includes("satisfaction") || scenario.includes("excellence")) return "satisfaction";
  return "economic";
}

function computeStrategyScore(summary) {
  const objectiveType = inferObjectiveType(summary);
  const progress = clamp(summary.objectiveProgress ?? 0, 0, 100);
  const health = clamp(summary.health ?? 0, 0, 100);
  const rating = clamp(summary.rating ?? 0, 0, 100);
  const cashScore = clamp(((summary.cash ?? 0) - 5000) / 20000 * 100, 0, 100);
  const dayScore = clamp((summary.elapsedGameMinutes ?? 0) / 14.4, 0, 100);
  const attendanceScore = clamp((summary.totalGolfers ?? 0) / 5, 0, 100);
  const roundsScore = clamp((summary.totalRounds ?? 0) / 1.5, 0, 100);
  const featureScore = clamp((summary.featureUsage?.explorationScore ?? 0) * 5, 0, 100);
  const roboticsScore = clamp((summary.featureUsage?.robotsOwned ?? 0) * 20, 0, 100);
  const mechanicScore = clamp((summary.featureUsage?.mechanicEmployees ?? 0) * 35, 0, 100);

  let score =
    (progress * 0.35) +
    (health * 0.2) +
    (cashScore * 0.1) +
    (dayScore * 0.15) +
    (featureScore * 0.2);

  if (objectiveType === "attendance") {
    score =
      (progress * 0.3) +
      (attendanceScore * 0.2) +
      (roundsScore * 0.15) +
      (health * 0.15) +
      (cashScore * 0.05) +
      (featureScore * 0.1) +
      (mechanicScore * 0.05);
  } else if (objectiveType === "restoration") {
    score =
      (progress * 0.35) +
      (health * 0.3) +
      (rating * 0.1) +
      (cashScore * 0.05) +
      (featureScore * 0.1) +
      (roboticsScore * 0.1);
  } else if (objectiveType === "satisfaction") {
    score =
      (progress * 0.3) +
      (rating * 0.25) +
      (health * 0.2) +
      (cashScore * 0.05) +
      (featureScore * 0.1) +
      (mechanicScore * 0.1);
  }

  if (summary.reachedTargetDays) {
    score += 20;
  }
  if (summary.verdict === "passed") {
    score += 30;
  }

  return Number(score.toFixed(2));
}

function summarizeRun(run) {
  const finalSnapshot = run.finalSnapshot ?? {};
  const summary = {
    scenario: run.config.scenario,
    strategy: run.config.strategy,
    repeatIndex: run.matrixRun.repeatIndex,
    verdict: run.result?.verdict ?? "failed",
    reason: run.result?.reason ?? "unknown",
    reachedTargetDays: Boolean(run.result?.reachedTargetDays),
    completedDays: finalSnapshot.completedDays ?? 0,
    gameDay: finalSnapshot.gameDay ?? null,
    elapsedGameMinutes: finalSnapshot.elapsedGameMinutes ?? null,
    cash: finalSnapshot.economy?.cash ?? null,
    health: finalSnapshot.courseStats?.health ?? null,
    rating: finalSnapshot.scenarioProgress?.currentRating ?? null,
    objectiveProgress: finalSnapshot.objective?.progress ?? 0,
    totalGolfers: finalSnapshot.scenarioProgress?.totalGolfers ?? null,
    totalRounds: finalSnapshot.scenarioProgress?.totalRounds ?? null,
    employees: finalSnapshot.employees?.count ?? null,
    applications: finalSnapshot.applicationState?.applications ?? null,
    activeJobPostings: finalSnapshot.applicationState?.activeJobPostings ?? null,
    featureUsage: run.featureUsage ?? null,
    artifactDir: run.artifactDir,
    reportFile: run.reportFile,
  };
  return {
    ...summary,
    score: computeStrategyScore(summary),
  };
}

function aggregateRuns(results) {
  const grouped = new Map();
  for (const result of results) {
    const summary = summarizeRun(result);
    const key = `${summary.scenario}::${summary.strategy}`;
    const current = grouped.get(key) ?? [];
    current.push(summary);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([key, runs]) => {
    const [scenario, strategy] = key.split("::");
    const passedRuns = runs.filter((run) => run.verdict === "passed").length;
    const failureReasons = Object.fromEntries(
      Array.from(
        runs
          .filter((run) => run.verdict !== "passed")
          .reduce((counts, run) => {
            counts.set(run.reason, (counts.get(run.reason) ?? 0) + 1);
            return counts;
          }, new Map())
          .entries()
      ).sort((a, b) => a[0].localeCompare(b[0]))
    );

    return {
      scenario,
      strategy,
      runs: runs.length,
      passedRuns,
      passRate: Number((passedRuns / runs.length).toFixed(2)),
      failureReasons,
      medianCompletedDays: toMedian(runs.map((run) => run.completedDays)),
      medianElapsedGameMinutes: toMedian(runs.map((run) => run.elapsedGameMinutes)),
      medianCash: toMedian(runs.map((run) => run.cash)),
      medianHealth: toMedian(runs.map((run) => run.health)),
      medianRating: toMedian(runs.map((run) => run.rating)),
      medianObjectiveProgress: toMedian(runs.map((run) => run.objectiveProgress)),
      medianGolfers: toMedian(runs.map((run) => run.totalGolfers)),
      medianRounds: toMedian(runs.map((run) => run.totalRounds)),
      medianEmployees: toMedian(runs.map((run) => run.employees)),
      medianApplications: toMedian(runs.map((run) => run.applications)),
      medianRobotsOwned: toMedian(runs.map((run) => run.featureUsage?.robotsOwned)),
      medianMechanics: toMedian(runs.map((run) => run.featureUsage?.mechanicEmployees)),
      medianRoboticsResearch: toMedian(runs.map((run) => run.featureUsage?.completedRoboticsResearch)),
      medianExplorationScore: toMedian(runs.map((run) => run.featureUsage?.explorationScore)),
      medianStrategyScore: toMedian(runs.map((run) => run.score)),
    };
  });
}

function rankStrategies(aggregates) {
  const grouped = new Map();
  for (const aggregate of aggregates) {
    const current = grouped.get(aggregate.scenario) ?? [];
    current.push(aggregate);
    grouped.set(aggregate.scenario, current);
  }

  return Array.from(grouped.entries()).map(([scenario, entries]) => ({
    scenario,
    ranking: [...entries]
      .sort((a, b) => (b.medianStrategyScore ?? -Infinity) - (a.medianStrategyScore ?? -Infinity))
      .map((entry) => ({
        strategy: entry.strategy,
        medianStrategyScore: entry.medianStrategyScore,
        passRate: entry.passRate,
        medianObjectiveProgress: entry.medianObjectiveProgress,
        medianHealth: entry.medianHealth,
        medianCash: entry.medianCash,
        medianRobotsOwned: entry.medianRobotsOwned,
        medianMechanics: entry.medianMechanics,
      })),
  }));
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const runs = getScenarioRuns(config);
  const runDir = path.resolve(".agent-harness", "player-soak-matrix", `${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });

  let serverHandle = null;
  try {
    serverHandle = await startDevServer(config, runDir);
    const results = runs.map((run) => executeRun(run, config));
    const summaries = results.map(summarizeRun);
    const aggregates = aggregateRuns(results);
    console.log(JSON.stringify({
      config,
      runs: summaries,
      aggregates,
      scenarioRankings: rankStrategies(aggregates),
      artifactDir: runDir,
    }, null, 2));
  } finally {
    stopDevServer(serverHandle);
  }
}

await main();
