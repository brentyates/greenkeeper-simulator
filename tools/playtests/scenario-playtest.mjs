import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const config = {
    url: "http://127.0.0.1:4175",
    scenario: "tutorial_basics",
    mode: "baseline",
    seed: null,
    timeScale: 80,
    steps: 30,
    delayMs: 1500,
    headless: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) config.url = next;
    if (arg === "--scenario" && next) config.scenario = next;
    if (arg === "--mode" && next) config.mode = next;
    if (arg === "--seed" && next) config.seed = Number(next);
    if (arg === "--time-scale" && next) config.timeScale = Number(next);
    if (arg === "--steps" && next) config.steps = Number(next);
    if (arg === "--delay-ms" && next) config.delayMs = Number(next);
    if (arg === "--headed") config.headless = false;
  }

  return config;
}

const config = parseArgs(process.argv.slice(2));

const browser = await chromium.launch({ headless: config.headless });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
if (Number.isFinite(config.seed)) {
  await context.addInitScript((seedValue) => {
    let state = Math.floor(seedValue) % 2147483647;
    if (state <= 0) state += 2147483646;
    Math.random = () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }, config.seed);
}
const page = await context.newPage();

await page.goto(config.url, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const result = await page.evaluate(async (cfg) => {
  const w = window;
  const game = () => w.game;
  const runtime = () => w.app.game;
  const employeeCallbacks = () => runtime().uiPanelCoordinator.employeePanel.callbacks;

  const continueDaySummary = () => {
    const popup = runtime().uiPanelCoordinator.daySummaryPopup;
    if (popup?.isVisible?.()) {
      popup.hide();
      popup.callbacks.onContinue();
      return true;
    }
    return false;
  };

  const getScenarioObjective = () => game().state.currentScenario?.objective ?? null;

  const assignEmployee = (employee, areaId, focus) => {
    employeeCallbacks().onAssignArea(employee.id, areaId);
    employeeCallbacks().onAssignFocus(employee.id, focus);
  };

  const postAndHireRole = (role) => {
    const state = game().state;
    if (
      state.applicationState.activeJobPostings.length === 0 &&
      state.applicationState.applications.length === 0
    ) {
      employeeCallbacks().onPostJobOpening(role);
      return false;
    }
    if (state.applicationState.applications.length > 0) {
      return game().hireEmployee(0) !== false;
    }
    return false;
  };

  const ensureCrewPlan = (plans) => {
    const state = game().state;
    const employees = state.employeeRoster.employees;

    for (let i = 0; i < Math.min(employees.length, plans.length); i += 1) {
      const employee = employees[i];
      const plan = plans[i];
      assignEmployee(employee, plan.area, plan.focus);
    }

    if (employees.length < plans.length) {
      postAndHireRole("groundskeeper");
    }
  };

  const setResearchFunding = (level) => {
    game().setResearchFunding(level);
  };

  const ensureResearch = (itemId) => {
    const details = game().getResearchDetails(itemId);
    if (details.status === "completed" || details.status === "researching") {
      return true;
    }
    const available = game().getAvailableResearch();
    if (available.includes(itemId)) {
      game().startResearchItem(itemId);
      return true;
    }
    return false;
  };

  const ensureRobotPurchased = (equipmentId, areaId) => {
    const robots = game().getRobotList();
    const existing = robots.find((robot) => robot.id.startsWith(equipmentId));
    if (!existing) {
      game().purchaseRobotUnit(equipmentId);
    }

    const nextRobot = game().state.autonomousState.robots.find((robot) =>
      robot.equipmentId === equipmentId
    );
    if (nextRobot && areaId) {
      runtime().uiPanelCoordinator.equipmentStorePanel.callbacks.onAssignArea(
        nextRobot.id,
        areaId
      );
    }
  };

  const runModeStep = () => {
    const state = game().state;
    const employees = state.employeeRoster.employees;
    const objective = getScenarioObjective();

    if (cfg.mode === "baseline") {
      return;
    }

    if (cfg.mode === "starter_all_course") {
      if (employees[0]) {
        assignEmployee(employees[0], "all_course", "balanced");
      }
      return;
    }

    if (cfg.mode === "crew_territories") {
      ensureCrewPlan([
        { area: "clubhouse_side", focus: "watering" },
        { area: "middle_grounds", focus: "mowing" },
        { area: "far_side", focus: "fertilizing" },
      ]);
      return;
    }

    if (cfg.mode === "restoration_ops") {
      ensureCrewPlan([
        { area: "all_course", focus: "watering" },
        { area: "clubhouse_side", focus: "fertilizing" },
        { area: "middle_grounds", focus: "watering" },
        { area: "far_side", focus: "fertilizing" },
      ]);
      setResearchFunding("normal");
      ensureResearch("soil_testing_kit");
      return;
    }

    if (cfg.mode === "attendance_push") {
      ensureCrewPlan([
        { area: "all_course", focus: "mowing" },
        { area: "clubhouse_side", focus: "watering" },
      ]);
      setResearchFunding("normal");
      ensureResearch("riding_mower_basic");
      return;
    }

    if (cfg.mode === "advanced_ops") {
      ensureCrewPlan([
        { area: "clubhouse_side", focus: "watering" },
        { area: "middle_grounds", focus: "mowing" },
        { area: "far_side", focus: "fertilizing" },
      ]);
      setResearchFunding("high");

      if (objective?.type === "economic" || objective?.type === "attendance") {
        ensureResearch("robot_mower_fairway");
        if (game().getResearchDetails("robot_mower_fairway").status === "completed") {
          ensureRobotPurchased("robot_mower_fairway", "all_course");
        }
      } else if (objective?.type === "restoration") {
        ensureResearch("robot_sprayer");
        if (game().getResearchDetails("robot_sprayer").status === "completed") {
          ensureRobotPurchased("robot_sprayer", "all_course");
        }
      } else if (objective?.type === "satisfaction") {
        ensureResearch("robot_mower_greens");
        if (game().getResearchDetails("robot_mower_greens").status === "completed") {
          ensureRobotPurchased("robot_mower_greens", "all_course");
        }
      }
      return;
    }
  };

  const classifyFailure = (objectiveResult, progress) => {
    if (!objectiveResult.failed) return null;
    const conditions = game().state.currentScenario?.conditions ?? {};
    if (
      typeof conditions.minimumHealth === "number" &&
      progress.currentHealth < conditions.minimumHealth
    ) {
      return "condition";
    }
    if (typeof conditions.timeLimitDays === "number" && progress.daysElapsed >= conditions.timeLimitDays) {
      return "time";
    }
    if (progress.currentCash < 0 || game().state.economyState.cash <= 0) {
      return "cash";
    }
    return "objective";
  };

  w.app.showMainMenu();
  await new Promise((resolve) => setTimeout(resolve, 500));
  w.startScenario(cfg.scenario, false);
  for (let i = 0; i < 40 && game() == null; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (game() == null) {
    throw new Error(`Scenario did not start: ${cfg.scenario}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  runModeStep();
  game().state.timeScale = cfg.timeScale;

  const samples = [];
  for (let step = 0; step < cfg.steps; step += 1) {
    await new Promise((resolve) => setTimeout(resolve, cfg.delayMs));
    continueDaySummary();
    runModeStep();

    const progress = game().getScenarioProgress();
    const objective = game().checkScenarioObjective();
    const research = game().getResearchState();
    const robots = game().getRobotState();

    samples.push({
      step,
      mode: cfg.mode,
      daysElapsed: progress.daysElapsed,
      revenue: Number(progress.totalRevenue.toFixed(2)),
      expenses: Number(progress.totalExpenses.toFixed(2)),
      cash: Number(progress.currentCash.toFixed(2)),
      econCash: Number(game().state.economyState.cash.toFixed(2)),
      rounds: progress.totalRounds,
      golfers: progress.totalGolfers,
      health: Number(progress.currentHealth.toFixed(2)),
      rating: Number(progress.currentRating.toFixed(2)),
      employees: game().state.employeeRoster.employees.length,
      robots: robots.totalRobots,
      brokenRobots: robots.brokenRobots,
      completedResearch: research.completedResearch.length,
      fundingLevel: research.fundingLevel,
      gameDay: game().state.gameDay,
      gameTime: Number(game().state.gameTime.toFixed(2)),
      completed: objective.completed,
      failed: objective.failed,
      failureReason: classifyFailure(objective, progress),
      progressPct: Number(objective.progress.toFixed(2)),
    });

    if (objective.completed || objective.failed) {
      break;
    }
  }

  return {
    config: cfg,
    scenario: game().state.currentScenario?.id ?? cfg.scenario,
    objectiveType: getScenarioObjective()?.type ?? null,
    final: samples.at(-1) ?? null,
    samples,
  };
}, config);

console.log(JSON.stringify(result, null, 2));
await browser.close();
