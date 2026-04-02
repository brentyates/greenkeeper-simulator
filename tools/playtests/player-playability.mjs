import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const STRATEGIES = {
  adaptive: {
    targetCrew: 2,
    desiredRoles: { groundskeeper: 2, mechanic: 0 },
    hiringPriority: ["groundskeeper", "mechanic"],
    researchFunding: "normal",
    researchPriority: [
      "soil_testing_kit",
      "riding_mower_basic",
      "fairway_mower",
      "smart_irrigation",
      "robot_sprayer",
      "robot_mower_fairway",
    ],
    robotPriority: ["robot_sprayer", "robot_mower_fairway", "robot_fertilizer", "robot_bunker_rake"],
    robotAreaPriority: ["clubhouse_side", "middle_grounds", "far_side", "anywhere"],
    maxRobots: 1,
    seekRobots: "adaptive",
    mechanicTrigger: "robots_or_late",
    earlyResearch: false,
  },
  steady_ops: {
    targetCrew: 2,
    desiredRoles: { groundskeeper: 2, mechanic: 0 },
    hiringPriority: ["groundskeeper", "mechanic"],
    researchFunding: "normal",
    researchPriority: ["soil_testing_kit", "riding_mower_basic", "fairway_mower", "employee_training_1"],
    robotPriority: [],
    robotAreaPriority: ["anywhere", "middle_grounds", "clubhouse_side", "far_side"],
    maxRobots: 0,
    seekRobots: "never",
    mechanicTrigger: "never",
    earlyResearch: false,
  },
  research_push: {
    targetCrew: 3,
    desiredRoles: { groundskeeper: 2, mechanic: 1 },
    hiringPriority: ["mechanic", "groundskeeper"],
    researchFunding: "maximum",
    researchPriority: [
      "soil_testing_kit",
      "riding_mower_basic",
      "smart_irrigation",
      "fairway_mower",
      "slow_release_fertilizer",
      "robot_sprayer",
      "robot_mower_fairway",
    ],
    robotPriority: ["robot_sprayer", "robot_mower_fairway", "robot_fertilizer"],
    robotAreaPriority: ["middle_grounds", "clubhouse_side", "far_side", "anywhere"],
    maxRobots: 2,
    seekRobots: "when_unlocked",
    mechanicTrigger: "early",
    earlyResearch: true,
  },
  robotics_push: {
    targetCrew: 3,
    desiredRoles: { groundskeeper: 2, mechanic: 1 },
    hiringPriority: ["mechanic", "groundskeeper"],
    researchFunding: "maximum",
    researchPriority: [
      "smart_irrigation",
      "fairway_mower",
      "slow_release_fertilizer",
      "robot_sprayer",
      "robot_fertilizer",
      "robot_mower_fairway",
      "robot_bunker_rake",
      "robot_fleet_manager",
    ],
    robotPriority: ["robot_sprayer", "robot_fertilizer", "robot_mower_fairway", "robot_bunker_rake"],
    robotAreaPriority: ["clubhouse_side", "middle_grounds", "far_side", "anywhere"],
    maxRobots: 4,
    seekRobots: "when_unlocked",
    mechanicTrigger: "early",
    earlyResearch: true,
  },
  attendance_push: {
    targetCrew: 3,
    desiredRoles: { groundskeeper: 3, mechanic: 0 },
    hiringPriority: ["groundskeeper", "mechanic"],
    researchFunding: "normal",
    researchPriority: ["soil_testing_kit", "fairway_mower", "clubhouse_upgrade", "employee_training_1"],
    robotPriority: ["robot_mower_fairway", "robot_sprayer"],
    robotAreaPriority: ["middle_grounds", "clubhouse_side", "far_side", "anywhere"],
    maxRobots: 1,
    seekRobots: "adaptive",
    mechanicTrigger: "robots_or_late",
    earlyResearch: false,
  },
};

function parseArgs(argv) {
  let maxStepsProvided = false;
  let targetCrewProvided = false;
  const config = {
    url: "http://127.0.0.1:4175",
    scenario: "tutorial_basics",
    strategy: "adaptive",
    targetDays: 5,
    maxSteps: 400,
    pollMs: 250,
    headless: true,
    seed: null,
    completedScenarios: [],
    targetCrew: 2,
    speedUps: 4,
    outputRoot: path.resolve("test-results", "player-playability"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) config.url = next;
    if (arg === "--scenario" && next) config.scenario = next;
    if (arg === "--strategy" && next) config.strategy = next;
    if (arg === "--target-days" && next) config.targetDays = Number(next);
    if (arg === "--max-steps" && next) {
      config.maxSteps = Number(next);
      maxStepsProvided = true;
    }
    if (arg === "--poll-ms" && next) config.pollMs = Number(next);
    if (arg === "--seed" && next) config.seed = Number(next);
    if (arg === "--completed-scenarios" && next) {
      config.completedScenarios = next.split(",").map((value) => value.trim()).filter(Boolean);
    }
    if (arg === "--target-crew" && next) {
      config.targetCrew = Number(next);
      targetCrewProvided = true;
    }
    if (arg === "--speed-ups" && next) config.speedUps = Number(next);
    if (arg === "--output-root" && next) config.outputRoot = path.resolve(next);
    if (arg === "--headed") config.headless = false;
  }

  const strategy = STRATEGIES[config.strategy] ?? STRATEGIES.adaptive;
  if (!targetCrewProvided) {
    config.targetCrew = strategy.targetCrew;
  }

  if (!maxStepsProvided) {
    config.maxSteps = Math.max(config.maxSteps, config.targetDays * 360);
  }

  return config;
}

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const randomSuffix = Math.random().toString(36).slice(2, 6);
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, "0")}-${process.pid}-${randomSuffix}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function firstVisibleControl(snapshot, prefix) {
  return snapshot.visibleControls.find((control) => control.id.startsWith(prefix) && control.enabled) ?? null;
}

function getEmployeeArea(employee) {
  return employee?.assignedAreaId ?? employee?.assignedArea ?? null;
}

function getEmployeeFocus(employee) {
  return employee?.focusPreference ?? employee?.assignedFocus ?? "balanced";
}

function getElapsedGameMinutes(snapshot) {
  const completedDays = Math.max(
    snapshot.scenarioProgress?.daysElapsed ?? 0,
    Math.max(0, (snapshot.gameAutomation?.gameDay ?? 1) - 1)
  );
  const gameTime = typeof snapshot.gameAutomation?.gameTime === "number" ? snapshot.gameAutomation.gameTime : 0;
  return completedDays * 24 * 60 + gameTime;
}

function getScenarioFlags(scenarioId) {
  return {
    isLateGame:
      [
        "highlands_profit_challenge",
        "highlands_satisfaction",
        "sunrise_valley_revenue",
        "sunrise_valley_attendance",
        "grand_summit_restoration",
        "grand_summit_excellence",
        "grand_summit_finale",
        "sandbox_all_unlocked",
      ].includes(scenarioId),
    isAttendance: scenarioId.includes("attendance") || scenarioId.includes("revenue"),
    isRestoration: scenarioId.includes("restoration"),
    isSandbox: scenarioId === "sandbox_all_unlocked",
  };
}

function countRoles(employees) {
  return employees.reduce((counts, employee) => {
    counts[employee.role] = (counts[employee.role] ?? 0) + 1;
    return counts;
  }, {});
}

function resolveStrategyPlan(config, snapshot = null) {
  const base = STRATEGIES[config.strategy] ?? STRATEGIES.adaptive;
  const flags = getScenarioFlags(config.scenario);
  const desiredRoles = { ...base.desiredRoles };
  if (flags.isLateGame && base.mechanicTrigger !== "never") {
    desiredRoles.mechanic = Math.max(desiredRoles.mechanic ?? 0, 1);
  }
  if (snapshot?.robotState?.totalRobots > 0 && base.mechanicTrigger !== "never") {
    desiredRoles.mechanic = Math.max(desiredRoles.mechanic ?? 0, 1);
  }
  const desiredTotal = Object.values(desiredRoles).reduce((sum, count) => sum + count, 0);
  if (config.targetCrew > desiredTotal) {
    desiredRoles.groundskeeper = (desiredRoles.groundskeeper ?? 0) + (config.targetCrew - desiredTotal);
  }
  return {
    ...base,
    flags,
    desiredRoles,
  };
}

function chooseMissingRole(snapshot, plan) {
  const employees = snapshot.employeeState?.employees ?? [];
  const roleCounts = countRoles(employees);
  const prioritizedRoles = [
    ...(plan.hiringPriority ?? []),
    ...Object.keys(plan.desiredRoles).filter((role) => !(plan.hiringPriority ?? []).includes(role)),
  ];
  for (const role of prioritizedRoles) {
    const targetCount = plan.desiredRoles[role] ?? 0;
    if ((roleCounts[role] ?? 0) < targetCount) {
      return role;
    }
  }
  return null;
}

function shouldSeekRobots(snapshot, plan) {
  if (plan.seekRobots === "never") {
    return false;
  }
  if (plan.flags.isSandbox) {
    return true;
  }
  if (plan.seekRobots === "when_unlocked") {
    return (snapshot.availableRobots?.length ?? 0) > 0 || (snapshot.robotState?.totalRobots ?? 0) > 0;
  }
  return (
    (snapshot.availableRobots?.length ?? 0) > 0 ||
    (snapshot.robotState?.totalRobots ?? 0) > 0 ||
    plan.flags.isLateGame
  );
}

function chooseRobotArea(robot, plan, runtime) {
  const areaOrder = [...plan.robotAreaPriority];
  if (robot?.type === "sprayer" || robot?.type === "spreader") {
    areaOrder.unshift("clubhouse_side");
  } else if (robot?.type === "mower") {
    areaOrder.unshift("middle_grounds");
  } else if (robot?.type === "raker") {
    areaOrder.unshift("far_side");
  }
  return areaOrder.find((areaId) => !runtime.robotAreaAssignments.has(`${robot.id}:${areaId}`)) ?? areaOrder[0] ?? "anywhere";
}

function getPreferredRobotPurchase(snapshot, plan) {
  const availableRobots = snapshot.availableRobots ?? [];
  const totalRobots = snapshot.robotState?.totalRobots ?? 0;
  if (totalRobots >= plan.maxRobots) {
    return null;
  }

  const prioritized = plan.robotPriority
    .map((equipmentId) => availableRobots.find((robot) => robot.equipmentId === equipmentId))
    .filter(Boolean);
  return prioritized.find((robot) => robot.ownedCount === 0) ??
    prioritized.find((robot) => robot.ownedCount < 2) ??
    null;
}

function needsFleetAttention(snapshot, plan, runtime) {
  if (!shouldSeekRobots(snapshot, plan)) {
    return false;
  }
  const robots = snapshot.robotList ?? [];
  if (snapshot.robotState?.brokenRobots > 0) {
    return true;
  }
  if (robots.some((robot) => !runtime.robotConfigured.has(robot.id))) {
    return true;
  }
  return Boolean(getPreferredRobotPurchase(snapshot, plan));
}

function summarizeRecentPattern(history, size = 8) {
  const recentActions = history.slice(-size).map((step) => step.action);
  const suspiciousActions = recentActions.filter((action) => !["observe", "wait_for_applications"].includes(action));
  const counts = new Map();
  for (const action of suspiciousActions) {
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  let dominantAction = null;
  let dominantCount = 0;
  for (const [action, count] of counts.entries()) {
    if (count > dominantCount) {
      dominantAction = action;
      dominantCount = count;
    }
  }
  const alternatingLoop =
    suspiciousActions.length >= 6 &&
    suspiciousActions.every((action, index) => action === suspiciousActions[index % 2]);

  return {
    actions: recentActions,
    suspiciousActions,
    dominantAction,
    dominantCount,
    alternatingLoop,
  };
}

async function focusCanvas(page) {
  await page.evaluate(() => window.__uiDebug?.focusCanvas?.());
}

async function clickControl(page, id) {
  await page.waitForFunction((controlId) => {
    const state = window.__uiDebug?.getState?.();
    const controls = Array.isArray(state?.controls) ? state.controls : [];
    const control = controls.find((candidate) => candidate.id === controlId);
    return Boolean(control?.visible && control?.enabled);
  }, id, { timeout: 1500 });

  const clicked = await page.evaluate((controlId) => {
    const state = window.__uiDebug?.getState?.();
    const controls = Array.isArray(state?.controls) ? state.controls : [];
    const control = controls.find((candidate) => candidate.id === controlId);
    if (!control) {
      return { ok: false, reason: "not_found" };
    }
    if (!control.visible) {
      return { ok: false, reason: "not_visible" };
    }
    if (!control.enabled) {
      return { ok: false, reason: "disabled" };
    }
    const ok = window.__uiDebug?.click?.(controlId) ?? false;
    return ok ? { ok: true } : { ok: false, reason: "activation_failed" };
  }, id);

  if (!clicked.ok) {
    throw new Error(`Automation control ${id} was ${clicked.reason}`);
  }
}

async function maybeClick(page, snapshot, id) {
  const control = snapshot.visibleControls.find((candidate) => candidate.id === id && candidate.enabled);
  if (!control) return false;
  await clickControl(page, id);
  return true;
}

async function collectSnapshot(page) {
  return page.evaluate(() => {
    const uiState = window.__uiDebug?.getState?.() ?? {};
    const game = window.game;
    const employeeState = game?.getEmployeeState?.() ?? null;
    const applicationState = game?.getApplicationState?.() ?? null;
    const researchState = game?.getResearchState?.() ?? null;
    const robotState = game?.getRobotState?.() ?? null;
    const robotList = game?.getRobotList?.() ?? [];
    const availableRobots = game?.getAvailableRobots?.() ?? [];
    const scenarioProgress = game?.getScenarioProgress?.() ?? null;
    const objective = game?.checkScenarioObjective?.() ?? null;
    const courseStats = game?.getCourseStats?.() ?? null;
    const economy = game?.getEconomyState?.() ?? null;
    const visibleControls = Array.isArray(uiState.controls)
      ? uiState.controls
          .filter((control) => control.visible)
          .map((control) => ({
            id: control.id,
            label: control.label,
            enabled: control.enabled,
          }))
      : [];

    const visualLife = {
      golferMeshCount: game?.getGolferVisualCount?.() ?? 0,
      sceneryObjectCount: game?.getSceneryObjectCount?.() ?? 0,
      activeEffectCount: game?.getActiveEffectCount?.() ?? 0,
    };

    return {
      menuState: uiState.menuState ?? null,
      gameAutomation: uiState.game ?? null,
      canvasFocused: Boolean(uiState.canvasFocused),
      domMirrorsEnabled: Boolean(uiState.domMirrorsEnabled),
      visibleControls,
      employeeState,
      applicationState,
      researchState,
      robotState,
      robotList,
      availableRobots,
      scenarioProgress,
      objective,
      courseStats,
      economy,
      visualLife,
    };
  });
}

async function startScenarioFromMenu(page, scenarioId) {
  await clickControl(page, `menu.scenario.${scenarioId}`);
  await sleep(250);
  await clickControl(page, "menu.new_game");
  await page.waitForFunction(() => window.app?.getMenuState?.() === "game" && window.game != null, null, {
    timeout: 15000,
  });
  await page.evaluate(() => window.__uiDebug?.setDomMirrorsEnabled?.(true));
  await focusCanvas(page);
}

async function configureSpeed(page, speedUps) {
  if (speedUps <= 0) return false;
  await focusCanvas(page);
  await page.keyboard.press("Escape");
  await sleep(400);
  const pauseVisible = await page.evaluate(() => Boolean(window.__uiDebug?.getState?.().game?.pauseMenuVisible));
  if (!pauseVisible) {
    return false;
  }

  for (let i = 0; i < speedUps; i += 1) {
    await clickControl(page, "pause.speed.up");
    await sleep(150);
  }
  await clickControl(page, "pause.resume");
  await sleep(250);
  return true;
}

async function runCrewRoutine(page, snapshot, config, runtime) {
  const plan = resolveStrategyPlan(config, snapshot);
  const employeeCount = snapshot.employeeState?.count ?? 0;
  const employees = snapshot.employeeState?.employees ?? [];
  const applications = snapshot.applicationState?.applications ?? [];
  const activeJobPostings = snapshot.applicationState?.activeJobPostings ?? 0;
  const nextApplicationTime = snapshot.applicationState?.nextApplicationTime ?? null;
  const currentGameTime = snapshot.gameAutomation?.gameTime ?? null;
  const playerPanelVisible = Boolean(snapshot.gameAutomation?.panels?.employee);
  const applicationsVisible = snapshot.visibleControls.some((control) => control.id === "panel.employee.applications.close");
  const missingRole = chooseMissingRole(snapshot, plan);
  const needsHiring = Boolean(missingRole);

  if (!playerPanelVisible) {
    await clickControl(page, "hud.manage.crew");
    return "open_crew_panel";
  }

  if (applicationsVisible) {
    const desiredCandidate = applications.find((candidate) => candidate.role === missingRole);
    const fallbackHireAllowed = runtime.postingWaitStreak >= 4;
    const hireControl = desiredCandidate
      ? snapshot.visibleControls.find((control) => control.id === `panel.employee.applications.hire.${desiredCandidate.id}` && control.enabled)
      : fallbackHireAllowed
        ? firstVisibleControl(snapshot, "panel.employee.applications.hire.")
        : null;
    if (hireControl) {
      runtime.postingWaitStreak = 0;
      await clickControl(page, hireControl.id);
      return `hire_candidate:${desiredCandidate?.role ?? "fallback_candidate"}`;
    }

    if (applications.length > 0 && !desiredCandidate) {
      runtime.postingWaitStreak += 1;
      if (snapshot.visibleControls.some((control) => control.id === "panel.employee.applications.close_all")) {
        await clickControl(page, "panel.employee.applications.close_all");
      } else {
        await clickControl(page, "panel.employee.applications.close");
      }
      return "wait_for_better_candidate";
    }

    if (needsHiring && applications.length === 0 && activeJobPostings === 0) {
      const roleControl = snapshot.visibleControls.find((control) => control.id === `panel.employee.applications.role.${missingRole}`);
      if (roleControl?.enabled) {
        await clickControl(page, roleControl.id);
        await sleep(100);
      }
      runtime.postingWaitStreak = 0;
      await clickControl(page, "panel.employee.applications.post_job");
      return `post_job:${missingRole}`;
    }

    const waitingForPostedCandidates =
      needsHiring &&
      applications.length === 0 &&
      activeJobPostings > 0 &&
      Number.isFinite(nextApplicationTime) &&
      Number.isFinite(currentGameTime) &&
      currentGameTime < nextApplicationTime;

    if (waitingForPostedCandidates) {
      runtime.postingWaitStreak += 1;
      if (snapshot.visibleControls.some((control) => control.id === "panel.employee.applications.close_all")) {
        await clickControl(page, "panel.employee.applications.close_all");
      } else {
        await clickControl(page, "panel.employee.applications.close");
      }
      return "wait_for_applications";
    }

    await clickControl(page, "panel.employee.applications.close");
    return "close_applications";
  }

  const desiredAssignments = [
    { role: "mechanic", areaId: null, controlId: "anywhere", focus: "balanced" },
    { role: "groundskeeper", areaId: "clubhouse_side", controlId: "clubhouse_side", focus: "watering" },
    { role: "groundskeeper", areaId: "middle_grounds", controlId: "middle_grounds", focus: "mowing" },
    { role: "groundskeeper", areaId: "far_side", controlId: "far_side", focus: "fertilizing" },
  ];

  const orderedEmployees = [
    ...employees.filter((employee) => employee.role === "mechanic"),
    ...employees.filter((employee) => employee.role !== "mechanic"),
  ];

  for (let index = 0; index < Math.min(orderedEmployees.length, desiredAssignments.length); index += 1) {
    const employee = orderedEmployees[index];
    const target = desiredAssignments.find((candidate) => candidate.role === employee.role && !candidate.used) ?? desiredAssignments.find((candidate) => !candidate.used);
    if (!target) {
      continue;
    }
    target.used = true;
    const currentAreaId = getEmployeeArea(employee);
    const needsArea = currentAreaId !== target.areaId;
    const currentFocus = getEmployeeFocus(employee);
    const needsFocus = currentFocus !== target.focus;
    if (!needsArea && !needsFocus) {
      continue;
    }

    await clickControl(page, `panel.employee.select.${employee.id}`);
    await sleep(100);
    if (needsArea) {
      await clickControl(page, `panel.employee.assign_area.${target.controlId}`);
      await sleep(150);
    }
    if (needsFocus) {
      await clickControl(page, `panel.employee.assign_focus.${target.focus}`);
      await sleep(150);
    }
    return `configure_employee:${employee.id}`;
  }

  if (needsHiring) {
    await clickControl(page, "panel.employee.open_applications");
    return "open_applications";
  }

  if (playerPanelVisible) {
    await clickControl(page, "panel.employee.close");
    return "close_crew_panel";
  }

  await clickControl(page, "panel.employee.close");
  return "close_crew_panel";
}

async function runResearchRoutine(page, snapshot, config) {
  const plan = resolveStrategyPlan(config, snapshot);
  const playerPanelVisible = Boolean(snapshot.gameAutomation?.panels?.research);
  const researchState = snapshot.researchState;
  if (!researchState) {
    return null;
  }

  if (!playerPanelVisible) {
    await clickControl(page, "hud.manage.research");
    return "open_research_panel";
  }

  if (researchState.fundingLevel !== plan.researchFunding) {
    const fundingControl = snapshot.visibleControls.find((control) => control.id === `panel.research.funding.${plan.researchFunding}`);
    if (fundingControl?.enabled) {
      await clickControl(page, fundingControl.id);
      return "set_research_funding";
    }
  }

  if (!researchState.currentResearch) {
    const preferred = plan.researchPriority.map((itemId) => `panel.research.start.${itemId}`);
    const preferredControl = preferred
      .map((id) => snapshot.visibleControls.find((control) => control.id === id && control.enabled))
      .find(Boolean);
    const startControl = preferredControl ?? firstVisibleControl(snapshot, "panel.research.start.");
    if (startControl) {
      await clickControl(page, startControl.id);
      return `start_research:${startControl.id}`;
    }
  }

  await clickControl(page, "panel.research.close");
  return "close_research_panel";
}

async function runFleetRoutine(page, snapshot, config, runtime) {
  const plan = resolveStrategyPlan(config, snapshot);
  const fleetVisible = Boolean(snapshot.gameAutomation?.panels?.equipmentStore);
  const robots = snapshot.robotList ?? [];
  const availableRobots = snapshot.availableRobots ?? [];

  if (!fleetVisible) {
    await clickControl(page, "hud.manage.fleet");
    return "open_fleet_panel";
  }

  const unconfiguredRobot = robots.find((robot) => !runtime.robotConfigured.has(robot.id));
  if (unconfiguredRobot) {
    if (runtime.pendingRobotSelection !== unconfiguredRobot.id) {
      const selectControlId = `panel.fleet.select.${unconfiguredRobot.id}`;
      const selectControl = snapshot.visibleControls.find((control) => control.id === selectControlId && control.enabled);
      if (selectControl) {
        runtime.pendingRobotSelection = unconfiguredRobot.id;
        await clickControl(page, selectControl.id);
        return `select_robot:${unconfiguredRobot.id}`;
      }
    }

    if (runtime.pendingRobotSelection === unconfiguredRobot.id) {
      const targetArea = chooseRobotArea(unconfiguredRobot, plan, runtime);
      const areaControlId = `panel.fleet.assign_area.${targetArea}`;
      const areaControl = snapshot.visibleControls.find((control) => control.id === areaControlId && control.enabled);
      if (areaControl) {
        runtime.pendingRobotSelection = null;
        runtime.robotConfigured.add(unconfiguredRobot.id);
        runtime.robotAreaAssignments.add(`${unconfiguredRobot.id}:${targetArea}`);
        await clickControl(page, areaControl.id);
        return `assign_robot_area:${unconfiguredRobot.id}:${targetArea}`;
      }
    }
  }

  const preferredPurchase = getPreferredRobotPurchase(snapshot, plan);
  if (preferredPurchase) {
    const controlId = `panel.fleet.buy.${preferredPurchase.equipmentId}`;
    const buyControl = snapshot.visibleControls.find((control) => control.id === controlId && control.enabled);
    if (buyControl) {
      await clickControl(page, buyControl.id);
      return `buy_robot:${preferredPurchase.equipmentId}`;
    }
  }

  await clickControl(page, "panel.fleet.close");
  return "close_fleet_panel";
}

async function takePlayerAction(page, snapshot, config, runtime) {
  const plan = resolveStrategyPlan(config, snapshot);
  if (await maybeClick(page, snapshot, "day_summary.continue")) {
    return "continue_day_summary";
  }
  if (await maybeClick(page, snapshot, "pause.resume")) {
    return "resume_pause_menu";
  }
  if (snapshot.visibleControls.some((control) => control.id === "scenario_failure.retry")) {
    return "scenario_failure_visible";
  }

  if (snapshot.menuState === "main") {
    await startScenarioFromMenu(page, config.scenario);
    return `start_scenario:${config.scenario}`;
  }

  if (snapshot.menuState !== "game") {
    return "waiting_for_game";
  }

  if (!runtime.speedConfigured && config.speedUps > 0) {
    const changed = await configureSpeed(page, config.speedUps);
    if (changed) {
      runtime.speedConfigured = true;
      return `increase_speed:${config.speedUps}`;
    }
  }

  const employeeCount = snapshot.employeeState?.count ?? 0;
  const applications = snapshot.applicationState?.applications ?? [];
  const activeJobPostings = snapshot.applicationState?.activeJobPostings ?? 0;
  const crewPanelVisible = Boolean(snapshot.gameAutomation?.panels?.employee);
  const waitingOnCrewPosting = employeeCount < config.targetCrew && applications.length === 0 && activeJobPostings > 0;
  const crewReviewInterval = waitingOnCrewPosting ? 48 : 18;

  const currentCompletedDays = Math.max(
    snapshot.scenarioProgress?.daysElapsed ?? 0,
    Math.max(0, (snapshot.gameAutomation?.gameDay ?? 1) - 1)
  );
  const researchPanelVisible = Boolean(snapshot.gameAutomation?.panels?.research);
  const shouldVisitResearch =
    researchPanelVisible ||
    (((plan.earlyResearch || currentCompletedDays >= 1 || employeeCount >= config.targetCrew || plan.flags.isSandbox)) &&
      runtime.lastResearchVisitDay !== currentCompletedDays &&
      runtime.stepIndex - runtime.lastResearchCheckStep >= 24);

  const fleetPanelVisible = Boolean(snapshot.gameAutomation?.panels?.equipmentStore);
  const shouldVisitFleet =
    fleetPanelVisible ||
    (
      needsFleetAttention(snapshot, plan, runtime) &&
      (
        runtime.stepIndex - runtime.lastFleetCheckStep >= 30 ||
        (snapshot.availableRobots?.length ?? 0) > 0
      )
    );

  if ((plan.flags.isSandbox || (snapshot.availableRobots?.length ?? 0) > 0) && shouldVisitFleet) {
    runtime.lastFleetCheckStep = runtime.stepIndex;
    const fleetAction = await runFleetRoutine(page, snapshot, config, runtime);
    if (fleetAction) {
      return fleetAction;
    }
  }

  if (plan.earlyResearch && shouldVisitResearch) {
    runtime.lastResearchCheckStep = runtime.stepIndex;
    const researchAction = await runResearchRoutine(page, snapshot, config);
    if (researchAction) {
      if (researchAction === "close_research_panel" || researchAction.startsWith("start_research") || researchAction === "set_research_funding") {
        runtime.lastResearchVisitDay = currentCompletedDays;
      }
      return researchAction;
    }
  }

  const needsCrewAttention =
    crewPanelVisible ||
    (employeeCount < config.targetCrew && applications.length > 0) ||
    (employeeCount < config.targetCrew && activeJobPostings === 0) ||
    runtime.stepIndex - runtime.lastCrewCheckStep >= crewReviewInterval;
  if (needsCrewAttention) {
    runtime.lastCrewCheckStep = runtime.stepIndex;
    return runCrewRoutine(page, snapshot, config, runtime);
  }

  if (!plan.earlyResearch && shouldVisitResearch) {
    runtime.lastResearchCheckStep = runtime.stepIndex;
    const researchAction = await runResearchRoutine(page, snapshot, config);
    if (researchAction) {
      if (researchAction === "close_research_panel" || researchAction.startsWith("start_research") || researchAction === "set_research_funding") {
        runtime.lastResearchVisitDay = currentCompletedDays;
      }
      return researchAction;
    }
  }

  if (shouldVisitFleet) {
    runtime.lastFleetCheckStep = runtime.stepIndex;
    const fleetAction = await runFleetRoutine(page, snapshot, config, runtime);
    if (fleetAction) {
      return fleetAction;
    }
  }

  await focusCanvas(page);
  return "observe";
}

function toSummary(snapshot) {
  const completedDays = Math.max(
    snapshot.scenarioProgress?.daysElapsed ?? 0,
    Math.max(0, (snapshot.gameAutomation?.gameDay ?? 1) - 1)
  );
  return {
    menuState: snapshot.menuState,
    paused: snapshot.gameAutomation?.paused ?? false,
    gameDay: snapshot.gameAutomation?.gameDay ?? null,
    gameTime: snapshot.gameAutomation?.gameTime ?? null,
    scenarioId: snapshot.gameAutomation?.scenarioId ?? null,
    panels: snapshot.gameAutomation?.panels ?? null,
    objective: snapshot.objective ?? null,
    completedDays,
    scenarioProgress: snapshot.scenarioProgress ?? null,
    courseStats: snapshot.courseStats ?? null,
    economy: snapshot.economy ?? null,
    employees: snapshot.employeeState
      ? {
          count: snapshot.employeeState.count,
        employees: snapshot.employeeState.employees.map((employee) => ({
          id: employee.id,
          role: employee.role,
          assignedAreaId: getEmployeeArea(employee),
          focusPreference: getEmployeeFocus(employee) ?? null,
        })),
      }
      : null,
    applicationState: snapshot.applicationState
      ? {
          applications: snapshot.applicationState.applications?.length ?? 0,
          activeJobPostings: snapshot.applicationState.activeJobPostings ?? 0,
        }
      : null,
    researchState: snapshot.researchState
      ? {
          fundingLevel: snapshot.researchState.fundingLevel,
          currentResearch: snapshot.researchState.currentResearch ?? null,
          completedResearch: snapshot.researchState.completedResearch?.length ?? 0,
          completedResearchIds: snapshot.researchState.completedResearch ?? [],
        }
      : null,
    robotState: snapshot.robotState
      ? {
          totalRobots: snapshot.robotState.totalRobots ?? 0,
          workingRobots: snapshot.robotState.workingRobots ?? 0,
          brokenRobots: snapshot.robotState.brokenRobots ?? 0,
        }
      : null,
    robotList: (snapshot.robotList ?? []).map((robot) => ({
      id: robot.id,
      type: robot.type,
      state: robot.state,
      battery: robot.battery,
    })),
    availableRobots: (snapshot.availableRobots ?? []).map((robot) => ({
      equipmentId: robot.equipmentId,
      ownedCount: robot.ownedCount,
    })),
    visualLife: snapshot.visualLife ?? { golferMeshCount: 0, sceneryObjectCount: 0, activeEffectCount: 0 },
    visibleControlIds: snapshot.visibleControls.map((control) => control.id),
    elapsedGameMinutes: getElapsedGameMinutes(snapshot),
  };
}

function summarizeFeatureUsage(report) {
  const finalSnapshot = report.finalSnapshot ?? {};
  const actions = report.steps.map((step) => step.action);
  const roleCounts = (finalSnapshot.employees?.employees ?? []).reduce((counts, employee) => {
    counts[employee.role] = (counts[employee.role] ?? 0) + 1;
    return counts;
  }, {});
  const completedResearchIds = finalSnapshot.researchState?.completedResearchIds ?? [];
  const roboticsResearchCompleted = completedResearchIds.filter((id) => id.startsWith("robot_")).length;
  const explorationScore =
    (finalSnapshot.employees?.count ?? 0) +
    ((roleCounts.mechanic ?? 0) * 2) +
    ((finalSnapshot.robotState?.totalRobots ?? 0) * 3) +
    roboticsResearchCompleted +
    actions.filter((action) => action.startsWith("start_research")).length;

  const vl = finalSnapshot.visualLife ?? { golferMeshCount: 0, sceneryObjectCount: 0, activeEffectCount: 0 };
  const golferCount = finalSnapshot.courseStats?.golferCount ?? finalSnapshot.economy?.golferCount ?? 0;
  const golferVisibility = golferCount > 0 ? Math.min(1, vl.golferMeshCount / golferCount) : (vl.golferMeshCount > 0 ? 1 : 0);
  const sceneryPresence = Math.min(1, vl.sceneryObjectCount / 20);
  const effectPresence = Math.min(1, vl.activeEffectCount / 5);
  const visualLifeScore = Math.round((golferVisibility * 40 + sceneryPresence * 35 + effectPresence * 25) * 10) / 10;

  return {
    strategy: report.config.strategy,
    mechanicEmployees: roleCounts.mechanic ?? 0,
    robotsOwned: finalSnapshot.robotState?.totalRobots ?? 0,
    brokenRobots: finalSnapshot.robotState?.brokenRobots ?? 0,
    robotPurchases: actions.filter((action) => action.startsWith("buy_robot:")).length,
    robotAssignments: actions.filter((action) => action.startsWith("assign_robot_area:")).length,
    researchStarts: actions.filter((action) => action.startsWith("start_research:")).length,
    completedResearch: completedResearchIds.length,
    completedRoboticsResearch: roboticsResearchCompleted,
    roleCounts,
    explorationScore,
    visualLifeScore,
    visualLife: vl,
  };
}

function detectRepairFocus(report) {
  const finalSnapshot = report.finalSnapshot ?? {};
  const visibleControlIds = finalSnapshot.visibleControlIds ?? [];
  const reason = String(report.result?.reason ?? "");
  const applications = finalSnapshot.applicationState?.applications ?? 0;
  const employeeCount = finalSnapshot.employees?.count ?? 0;
  const activeJobPostings = finalSnapshot.applicationState?.activeJobPostings ?? 0;
  const recentActions = report.steps.slice(-8).map((step) => step.action);
  const openedApplications = recentActions.filter((action) => action === "open_applications").length;
  const closedApplications = recentActions.filter((action) => action === "close_applications").length;
  const postedJob = recentActions.some((action) => action.startsWith("post_job"));
  const loopPattern = report.loopPattern ?? null;
  const elapsedMinutes = finalSnapshot.elapsedGameMinutes ?? 0;
  const targetMinutes = (report.config.targetDays ?? 0) * 24 * 60;
  const remainingMinutes = Math.max(0, targetMinutes - elapsedMinutes);

  if (
    reason === "max_steps_exhausted" &&
    report.result?.reachedTargetDays === false &&
    (
      remainingMinutes <= 120 ||
      (
        employeeCount >= report.config.targetCrew &&
        !(loopPattern?.alternatingLoop) &&
        (loopPattern?.dominantCount ?? 0) < 4
      )
    ) &&
    !(loopPattern?.alternatingLoop) &&
    (loopPattern?.dominantCount ?? 0) < 6
  ) {
    return {
      title: "Run budget exhausted before a still-progressing player session could finish",
      category: "run_budget_exhausted",
      likelySurface: "harness budget / soak duration",
      hypothesis:
        "The unattended player session was still making forward progress and reached late in the day, but the configured step budget ended before the target day count was crossed.",
      requiredChecks: [
        "Increase max steps or target a longer soak budget for this scenario.",
        "Confirm the last actions are still varied and not a real UI loop.",
      ],
    };
  }

  if (reason === "action_loop_detected" || loopPattern?.alternatingLoop || (loopPattern?.dominantCount ?? 0) >= 6) {
    return {
      title: "Player policy entered a repeated action loop",
      category: "player_policy_loop",
      likelySurface: "harness decision policy",
      hypothesis:
        "The game remained interactive, but the player policy kept selecting the same action or alternating between the same two actions instead of leaving the current surface.",
      requiredChecks: [
        "Inspect the recent repeated actions and the state that caused them.",
        "Tighten the harness policy so it recognizes stable completion and leaves the panel.",
      ],
    };
  }

  if (
    employeeCount < report.config.targetCrew &&
    activeJobPostings > 0 &&
    postedJob &&
    openedApplications > 0 &&
    closedApplications > 0 &&
    !visibleControlIds.some((id) => id.startsWith("panel.employee.applications.hire."))
  ) {
    return {
      title: "The crew applications flow loops without exposing a player action to hire",
      category: "employee_hiring_flow",
      likelySurface: "employee applications / hiring flow",
      hypothesis:
        "After posting a job, the player can reopen and close the applications view, but the UI never presents a visible next action such as a hire button or candidate row that advances staffing.",
      requiredChecks: [
        "Inspect how pending applications are generated versus when the applications panel rerenders.",
        "Check whether candidate rows and hire buttons are created and registered after a posting is active.",
        "Verify the harness is not looping on the applications panel before the next actionable state appears.",
      ],
    };
  }

  if (
    applications > 0 &&
    employeeCount < report.config.targetCrew &&
    !visibleControlIds.some((id) => id.startsWith("panel.employee.applications.hire."))
  ) {
    return {
      title: "Employee applications are not actionable through the visible UI",
      category: "player_ui_gap",
      likelySurface: "employee applications / hiring flow",
      hypothesis:
        "The game is generating candidate applications in public state, but the employee applications UI is not exposing hire controls or not refreshing into a hireable state.",
      requiredChecks: [
        "Open the crew panel through HUD controls.",
        "Open the applications view through the employee panel.",
        "Verify whether candidate hire buttons are rendered and registered in window.__uiDebug.",
        "Confirm the UI refresh path runs after applications arrive.",
      ],
    };
  }

  if (reason.includes("ERR_CONNECTION_REFUSED")) {
    return {
      title: "The local app was not reachable when the playability run started",
      category: "environment_unavailable",
      likelySurface: "dev server / local runtime",
      hypothesis:
        "The harness could not reach the configured app URL, so no player flow ran at all. Start or repair the local dev server before debugging game behavior.",
      requiredChecks: [
        "Start the local app and confirm the configured URL loads in a browser.",
        "Rerun the same playability command after the server is reachable.",
      ],
    };
  }

  if (reason.includes("Automation control")) {
    return {
      title: "Automation control registration or visibility is unstable",
      category: "automation_gap",
      likelySurface: "semantic UI automation layer",
      hypothesis:
        "A required control exists conceptually but is missing, hidden, or unstable in the DOM mirror layer during unattended play.",
      requiredChecks: [
        "Inspect the control registration and visibility logic for the missing id.",
        "Verify the corresponding Babylon control stays visible/enabled when the player should use it.",
        "Add or repair UI automation registration if the surface is important.",
      ],
    };
  }

  const golferPool = finalSnapshot.courseStats?.golferPool ?? finalSnapshot.economy?.golferPool ?? null;
  const activeGolfers = golferPool?.activeGolfers ?? 0;
  const golferMeshCount = finalSnapshot.visualLife?.golferMeshCount ?? 0;
  if (activeGolfers > 0 && golferMeshCount === 0) {
    return {
      title: "Golfers are active in the simulation but no golfer meshes are visible",
      category: "visual_life_gap",
      likelySurface: "golfer visual system",
      hypothesis:
        "The simulation has active golfers playing the course, but the GolferVisualSystem is not rendering any meshes for them. The course appears empty despite having players.",
      requiredChecks: [
        "Verify GolferVisualSystem is wired into the render loop.",
        "Check that golfer mesh creation runs when golfers enter the course.",
        "Confirm getGolferVisualCount returns the mesh count from the visual system.",
      ],
    };
  }

  if (visibleControlIds.includes("day_summary.continue")) {
    return {
      title: "The run stalled at a modal interruption",
      category: "interruption_handling",
      likelySurface: "day summary / pause recovery",
      hypothesis:
        "The harness reached a recoverable interruption, but the player flow did not successfully continue through the visible modal control path.",
      requiredChecks: [
        "Verify day summary and pause controls are always mirrored while visible.",
        "Confirm the next frame after dismissal returns the game to an unpaused state.",
      ],
    };
  }

  return {
    title: "Player-like run stalled before reaching the target day count",
    category: "playability_stall",
    likelySurface: "general player flow",
    hypothesis:
      "The game remained operable, but the current player policy or one of the visible UI flows was not sufficient to keep progress moving unattended.",
    requiredChecks: [
      "Review the last few harness steps for repeated actions or a stuck loop.",
      "Check whether the player can complete the next obvious task through visible controls.",
    ],
  };
}

function buildRepairPacket(report) {
  const focus = detectRepairFocus(report);
  const finalSnapshot = report.finalSnapshot ?? {};
  const recentSteps = report.steps.slice(-8).map((step) => ({
    step: step.step,
    action: step.action,
    beforeControls: step.before?.visibleControlIds ?? [],
    afterControls: step.after?.visibleControlIds ?? [],
  }));

  return {
    createdAt: new Date().toISOString(),
    sourceReport: report.reportFile,
    artifactDir: report.artifactDir,
    scenario: report.config.scenario,
    targetDays: report.config.targetDays,
    verdict: report.result.verdict,
    failureReason: report.result.reason,
    focus,
    loopPattern: report.loopPattern ?? null,
    finalSnapshot,
    recentSteps,
  };
}

function writeRepairPacket(report) {
  if (report.result?.verdict === "passed") {
    return null;
  }

  const packet = buildRepairPacket(report);
  const repairDir = path.join(
    path.resolve(".agent-harness", "repair-jobs"),
    `${stamp()}-player-${report.config.scenario}`
  );
  mkdirp(repairDir);

  const brief = `# Self-Heal Brief

Mode: \`bug-hunt\`
Scenario: \`${packet.scenario}\`

## Failure

- Verdict: \`${packet.verdict}\`
- Reason: \`${packet.failureReason}\`
- Likely broken surface: ${packet.focus.likelySurface}

## Problem Statement

${packet.focus.title}

${packet.focus.hypothesis}

## Reproduction

1. Start the local app.
2. Run:
   \`npm run playtest:player -- --scenario ${packet.scenario} --target-days ${packet.targetDays}\`
3. Inspect the report at \`${packet.sourceReport}\`.
4. Inspect the screenshot under \`${packet.artifactDir}\`.

## Required Checks

${packet.focus.requiredChecks.map((line) => `- ${line}`).join("\n")}

## Final Snapshot

- Completed days: ${packet.finalSnapshot.completedDays ?? 0}
- Cash: ${packet.finalSnapshot.economy?.cash ?? "n/a"}
- Objective progress: ${packet.finalSnapshot.objective?.progress ?? "n/a"}
- Applications: ${packet.finalSnapshot.applicationState?.applications ?? 0}
- Active job postings: ${packet.finalSnapshot.applicationState?.activeJobPostings ?? 0}
- Visible controls: ${(packet.finalSnapshot.visibleControlIds ?? []).join(", ") || "none"}
`;

  const handoff = `# Repair Handoff

## Goal

Fix the player-facing issue described in \`brief.md\`, then rerun the player harness until it gets past this failure surface.

## Evidence

- Source report: \`${packet.sourceReport}\`
- Source artifacts: \`${packet.artifactDir}\`

## Recent Harness Steps

${packet.recentSteps
  .map(
    (step) => `- Step ${step.step}: ${step.action}
  After controls: ${step.afterControls.join(", ") || "none"}`
  )
  .join("\n")}

## Exit Criteria

- The visible UI surface is fixed or automation coverage is added for the critical player action.
- \`npm run playtest:player -- --scenario ${packet.scenario}\` reaches a later state than the failing report.
- The repair notes explain what changed and why the player path is now valid.
`;

  fs.writeFileSync(path.join(repairDir, "repair-packet.json"), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(repairDir, "brief.md"), `${brief.trimEnd()}\n`, "utf8");
  fs.writeFileSync(path.join(repairDir, "handoff.md"), `${handoff.trimEnd()}\n`, "utf8");
  return repairDir;
}

const config = parseArgs(process.argv.slice(2));
const runDir = path.join(config.outputRoot, `${stamp()}-${config.scenario}`);
fs.mkdirSync(runDir, { recursive: true });

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
if (config.completedScenarios.length > 0) {
  await context.addInitScript((completedScenarios) => {
    const storageKey = "greenkeeper_progress";
    const previous = (() => {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
      } catch {
        return {};
      }
    })();
    const merged = {
      completedScenarios,
      bestScores: previous.bestScores ?? {},
      lastPlayedScenario: previous.lastPlayedScenario ?? null,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(merged));
  }, config.completedScenarios);
}
const page = await context.newPage();

const history = [];
let result = {
  verdict: "failed",
  reason: "unknown",
  reachedTargetDays: false,
};
const runtime = {
  speedConfigured: false,
  stepIndex: 0,
  lastCrewCheckStep: -999,
  lastResearchCheckStep: -999,
  lastResearchVisitDay: -1,
  lastFleetCheckStep: -999,
  pendingRobotSelection: null,
  robotConfigured: new Set(),
  robotAreaAssignments: new Set(),
  postingWaitStreak: 0,
};
let loopPattern = null;

try {
  await page.goto(config.url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.app !== undefined && window.__uiDebug !== undefined, null, {
    timeout: 20000,
  });
  await page.evaluate(() => {
    window.__uiDebug.setDomMirrorsEnabled(true);
    window.__uiDebug.setHighlightsEnabled(false);
  });

  let lastDaySeen = -1;
  let stagnantSteps = 0;
  let lastProgressMinute = -1;

  for (let step = 0; step < config.maxSteps; step += 1) {
    runtime.stepIndex = step;
    const before = await collectSnapshot(page);
    const action = await takePlayerAction(page, before, config, runtime);
    await sleep(config.pollMs);
    const after = await collectSnapshot(page);

    const completedDays = Math.max(
      after.scenarioProgress?.daysElapsed ?? 0,
      Math.max(0, (after.gameAutomation?.gameDay ?? 1) - 1)
    );
    const progressMinute =
      typeof after.gameAutomation?.gameDay === "number" && typeof after.gameAutomation?.gameTime === "number"
        ? (after.gameAutomation.gameDay * 24 * 60) + Math.floor(after.gameAutomation.gameTime)
        : -1;

    if (completedDays === lastDaySeen && progressMinute === lastProgressMinute) {
        stagnantSteps += 1;
    } else {
      lastDaySeen = completedDays;
      lastProgressMinute = progressMinute;
      stagnantSteps = 0;
    }

    history.push({
      step,
      action,
      before: toSummary(before),
      after: toSummary(after),
    });
    loopPattern = summarizeRecentPattern(history);

    if (after.visibleControls.some((control) => control.id === "scenario_failure.retry")) {
      result = {
        verdict: "failed",
        reason: "scenario_failure",
        reachedTargetDays: false,
      };
      break;
    }

    if (after.objective?.failed) {
      result = {
        verdict: "failed",
        reason: "objective_failed",
        reachedTargetDays: false,
      };
      break;
    }

    if (completedDays >= config.targetDays) {
      result = {
        verdict: "passed",
        reason: "target_days_reached",
        reachedTargetDays: true,
      };
      break;
    }

    if (stagnantSteps >= 12) {
      result = {
        verdict: "failed",
        reason: "no_progress",
        reachedTargetDays: false,
      };
      break;
    }

    if (loopPattern.alternatingLoop || loopPattern.dominantCount >= 6) {
      result = {
        verdict: "failed",
        reason: "action_loop_detected",
        reachedTargetDays: false,
      };
      break;
    }

    if (step === config.maxSteps - 1) {
      result = {
        verdict: "failed",
        reason: "max_steps_exhausted",
        reachedTargetDays: false,
      };
    }
  }
} catch (error) {
  result = {
    verdict: "failed",
    reason: error instanceof Error ? error.message : String(error),
    reachedTargetDays: false,
  };
} finally {
  const finalSnapshot = await collectSnapshot(page).catch(() => null);
  const screenshotPath = path.join(runDir, result.verdict === "passed" ? "final.png" : "failure.png");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  const report = {
    config,
    result,
    finalSnapshot: finalSnapshot ? toSummary(finalSnapshot) : null,
    loopPattern,
    featureUsage: null,
    artifactDir: runDir,
    reportFile: path.join(runDir, "report.json"),
    steps: history,
  };
  report.featureUsage = summarizeFeatureUsage(report);

  fs.writeFileSync(path.join(runDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const repairDir = writeRepairPacket(report);
  console.log(JSON.stringify({
    config,
    result,
    finalSnapshot: report.finalSnapshot,
    artifactDir: runDir,
    reportFile: path.join(runDir, "report.json"),
    repairDir,
  }, null, 2));
  await browser.close();
}
