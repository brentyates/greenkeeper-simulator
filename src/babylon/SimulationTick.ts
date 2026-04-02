import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { GolferVisualSystem } from "./systems/GolferVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { ActivityIndicatorSystem, WorkEffectType } from "./systems/ActivityIndicatorSystem";
import { UIManager } from "./ui/UIManager";
import { GameState } from "./GameState";
import { resolveServiceHubAnchorFromState } from "./GameState";
import { evaluateStandingOrders, type FaceStateSampler } from "../core/standing-orders";
import { cleanupCompletedJobs, advanceJobProgress } from "../core/job";
import { tickJobExecution } from "../core/job-execution";

import {
  addIncome,
  addExpense,
  TransactionCategory,
} from "../core/economy";
import {
  updatePipePressures,
  checkForLeaks,
  setSprinklerActive,
  getPipeAt,
  calculateWaterUsage,
  calculateWaterCost,
} from "../core/irrigation";
import {
  processPayroll,
  tickEmployees as coreTickEmployees,
  awardExperience,
  tickApplications,
  markEmployeesUnpaid,
  resumeEmployeesAfterPayroll,
} from "../core/employees";
import {
  tickEmployeeWork,
  getWorkerPositions,
  TASK_EXPERIENCE_REWARDS,
  TASK_SUPPLY_COSTS,
} from "../core/employee-work";
import {
  tickGolfers as coreTickGolfers,
  generateArrivals,
  calculateArrivalRate,
  updateCourseRating,
  addGolfer,
  resetDailyStats as resetGolferDailyStats,
} from "../core/golfers";
import {
  tickResearch as coreTickResearch,
  getFundingCostPerMinute,
  describeResearchUnlock,
  getEquipmentEfficiencyBonus,
  getBestFertilizerEffectiveness,
} from "../core/research";
import {
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  calculateDemandMultiplier,
  takeDailySnapshot,
  updateHistoricalExcellence,
  resetDailyStats as resetPrestigeDailyStats,
} from "../core/prestige";
import {
  generateDailySlots,
  simulateDailyBookings,
  applyBookingSimulation,
  resetDailyMetrics as resetTeeTimeDailyMetrics,
} from "../core/tee-times";
import {
  finalizeDailyRevenue,
} from "../core/tee-revenue";
import {
  tickAutonomousEquipment as coreTickAutonomousEquipment,
  getAllowedTerrainCodesForRobotEquipment,
  type RobotUnit,
} from "../core/autonomous-equipment";
import {
  tickWeather as coreTickWeather,
  getWeatherDescription,
  getWeatherImpactDescription,
} from "../core/weather";

function pick<T>(variants: T[]): T {
  return variants[Math.floor(Math.random() * variants.length)];
}

function recordExpense(
  state: GameState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number,
  dailyStatsKey?: keyof GameState['dailyStats']['expenses'],
): void {
  const result = addExpense(state.economyState, amount, category, description, timestamp);
  if (result) {
    state.economyState = result;
    if (dailyStatsKey) state.dailyStats.expenses[dailyStatsKey] += amount;
    state.scenarioManager?.addExpense?.(amount);
  }
}

export interface SimulationSystems {
  terrainSystem: TerrainSystem;
  uiManager: UIManager;
  employeeVisualSystem: EmployeeVisualSystem | null;
  golferVisualSystem: GolferVisualSystem | null;
  irrigationRenderSystem: IrrigationRenderSystem | null;
  activityIndicatorSystem: ActivityIndicatorSystem | null;
  saveCallback: () => void;
  showDaySummaryCallback: () => void;
}

function tickWeather(state: GameState, systems: SimulationSystems): void {
  const weatherResult = coreTickWeather(
    state.weatherState,
    state.gameTime,
    state.gameDay
  );
  if (weatherResult.changed || weatherResult.state !== state.weatherState) {
    state.weatherState = weatherResult.state;
    state.weather = state.weatherState.current;
    if (weatherResult.changed) {
      const impact = getWeatherImpactDescription(state.weather);
      systems.uiManager.showNotification(
        `Weather: ${getWeatherDescription(state.weather)}`,
        undefined,
        3000
      );
      if (impact) {
        setTimeout(() => {
          systems.uiManager.showNotification(impact, undefined, 4000);
        }, 500);
      }
    }
  }
}

function tickPayroll(state: GameState, systems: SimulationSystems, hours: number, timestamp: number): void {
  if (
    hours !== state.lastPayrollHour &&
    state.employeeRoster.employees.length > 0
  ) {
    state.lastPayrollHour = hours;
    const payrollResult = processPayroll(state.employeeRoster, timestamp);
    if (payrollResult.totalPaid > 0) {
      const expenseResult = addExpense(
        state.economyState,
        payrollResult.totalPaid,
        "employee_wages",
        "Hourly wages",
        timestamp
      );
      if (expenseResult) {
        const hadWithholdingCrew = state.employeeRoster.employees.some(
          (employee) => employee.status === "withholding_work"
        );
        state.employeeRoster = resumeEmployeesAfterPayroll(payrollResult.roster);
        state.economyState = expenseResult;
        state.dailyStats.expenses.wages += payrollResult.totalPaid;
        state.scenarioManager?.addExpense?.(payrollResult.totalPaid);
        if (hadWithholdingCrew) {
          systems.uiManager.showNotification("Payroll cleared: crew back to work");
        }
      } else {
        const alreadyWithholding = state.employeeRoster.employees.some(
          (employee) => employee.status === "withholding_work"
        );
        state.employeeRoster = markEmployeesUnpaid({
          ...state.employeeRoster,
          lastPayrollTime: timestamp,
        });
        if (!alreadyWithholding) {
          systems.uiManager.showNotification(
            "Payroll missed: crew stopped work",
            "#ff6666",
            4000
          );
        }
      }
    } else {
      state.employeeRoster = resumeEmployeesAfterPayroll(payrollResult.roster);
    }
  }
}

function tickAutoSave(state: GameState, systems: SimulationSystems, hours: number): void {
  if (hours !== state.lastAutoSaveHour) {
    state.lastAutoSaveHour = hours;
    systems.saveCallback();
  }
}

function tickPrestige(state: GameState, systems: SimulationSystems, hours: number): void {
  if (hours !== state.lastPrestigeUpdateHour) {
    state.lastPrestigeUpdateHour = hours;
    const conditionsScore = calculateCurrentConditionsFromFaces(systems.terrainSystem.getAllFaceStates());
    state.prestigeState = updatePrestigeScore(
      state.prestigeState,
      conditionsScore
    );

    const health = conditionsScore.averageHealth ?? conditionsScore.composite ?? 0;
    const prevThreshold = state.lastHealthNotifyThreshold;
    const risingThresholds = [60, 70, 80];
    const fallingThresholds = [50, 40];

    for (const t of risingThresholds) {
      if (health >= t && prevThreshold < t) {
        state.lastHealthNotifyThreshold = t;
        const msg = t >= 80
          ? pick(["Course looking pristine!", "Greens are immaculate!", "Course in top shape!"])
          : t >= 70
          ? pick(["Course health improving!", "Things are shaping up nicely", "The course is coming along!"])
          : pick(["Course conditions stabilizing", "Health recovering slowly", "Grounds crew making progress"]);
        systems.uiManager.showNotification(msg, "#88cc88");
        break;
      }
    }
    for (const t of fallingThresholds) {
      if (health < t && prevThreshold >= t) {
        state.lastHealthNotifyThreshold = Math.max(health, t === 50 ? 40 : 0);
        const msg = t <= 40
          ? pick(["Course health critical!", "Conditions deteriorating fast", "Urgent: course needs attention!"])
          : pick(["Course health declining...", "Conditions slipping", "The course needs some TLC"]);
        systems.uiManager.showNotification(msg, "#ff6666");
        break;
      }
    }
    if (state.lastHealthNotifyThreshold === 0 && health > 0) {
      state.lastHealthNotifyThreshold = health < 40 ? 0 : health < 50 ? 40 : health < 60 ? 50 : health < 70 ? 60 : health < 80 ? 70 : 80;
    }

    const demandMult = calculateDemandMultiplier(
      state.greenFees.weekday18Holes,
      state.prestigeState.tolerance
    );
    const rejectionRate = Math.round((1 - demandMult) * 100);
    const recommendedMax = state.prestigeState.tolerance.rejectionThreshold;
    systems.uiManager.updatePrestige(
      state.prestigeState,
      rejectionRate,
      recommendedMax
    );
  }
}

function tickTeeTimes(state: GameState, systems: SimulationSystems, hours: number, timestamp: number): void {
  if (hours !== state.lastTeeTimeUpdateHour) {
    state.lastTeeTimeUpdateHour = hours;

    if (hours === 5) {
      const newSlots = generateDailySlots(
        state.gameDay,
        state.teeTimeState.spacingConfig,
        state.teeTimeState.operatingHours
      );
      const updatedTeeTimes = new Map(state.teeTimeState.teeTimes);
      updatedTeeTimes.set(state.gameDay, newSlots);
      state.teeTimeState = {
        ...state.teeTimeState,
        teeTimes: updatedTeeTimes,
        currentDay: state.gameDay,
      };

      const bookings = simulateDailyBookings(
        state.teeTimeState,
        state.gameDay,
        state.gameDay,
        {
          prestigeScore: state.prestigeState.currentScore / 200,
        },
        state.greenFees.weekday18Holes,
        20
      );
      state.teeTimeState = applyBookingSimulation(
        state.teeTimeState,
        bookings,
        state.gameDay
      );
    }

    if (hours === 22) {
      processEndOfDay(state, systems, timestamp);
    }
  }
}

function processEndOfDay(state: GameState, systems: SimulationSystems, timestamp: number): void {
  state.revenueState = finalizeDailyRevenue(state.revenueState);

  const dailyUtilitiesCost = 50;
  const utilitiesResult = addExpense(
    state.economyState,
    dailyUtilitiesCost,
    "utilities",
    "Daily utilities",
    timestamp
  );
  if (utilitiesResult) {
    state.economyState = utilitiesResult;
    state.dailyStats.expenses.utilities += dailyUtilitiesCost;
    state.scenarioManager?.addExpense?.(dailyUtilitiesCost);
  }

  const dailySnapshot = takeDailySnapshot(
    state.prestigeState.currentConditions,
    state.gameDay
  );
  const newHistoricalExcellence = updateHistoricalExcellence(
    state.prestigeState.historicalExcellence,
    dailySnapshot
  );
  state.prestigeState = {
    ...state.prestigeState,
    historicalExcellence: newHistoricalExcellence,
  };

  systems.showDaySummaryCallback();
  systems.saveCallback();

  state.teeTimeState = resetTeeTimeDailyMetrics(state.teeTimeState);
  state.prestigeState = resetPrestigeDailyStats(state.prestigeState);
  state.golferPool = resetGolferDailyStats(state.golferPool);
}

function tickGolferArrivals(
  state: GameState,
  systems: SimulationSystems,
  hours: number,
  isWeekend: boolean,
  isTwilight: boolean,
  timestamp: number
): void {
  if (hours !== state.lastArrivalHour && hours >= 6 && hours <= 19) {
    state.lastArrivalHour = hours;
    const courseStats = systems.terrainSystem.getCourseStats();
    state.golferPool = updateCourseRating(state.golferPool, {
      condition: courseStats.health,
    });

    const baseArrivalRate = calculateArrivalRate(
      state.golferPool,
      state.weather,
      isWeekend,
      hours
    );

    const demandMultiplier = calculateDemandMultiplier(
      state.greenFees.weekday18Holes,
      state.prestigeState.tolerance
    );
    const potentialArrivals = Math.floor(
      baseArrivalRate + (Math.random() < baseArrivalRate % 1 ? 1 : 0)
    );
    const arrivalRate = baseArrivalRate * demandMultiplier;
    const arrivalCount = Math.floor(
      arrivalRate + (Math.random() < arrivalRate % 1 ? 1 : 0)
    );
    const rejectedCount = Math.max(0, potentialArrivals - arrivalCount);

    if (rejectedCount > 0) {
      const lostRevenue = rejectedCount * state.greenFees.weekday18Holes;
      state.prestigeState = {
        ...state.prestigeState,
        golfersRejectedToday:
          state.prestigeState.golfersRejectedToday + rejectedCount,
        revenueLostToday: state.prestigeState.revenueLostToday + lostRevenue,
      };
      if (
        state.prestigeState.golfersRejectedToday >= 5 &&
        rejectedCount >= 2
      ) {
        systems.uiManager.showNotification(
          pick([
            `${rejectedCount} golfers turned away! Prices too high`,
            `${rejectedCount} golfers balked at the green fees`,
            `Lost ${rejectedCount} golfers to sticker shock`,
          ]),
          "#ffaa44"
        );
      }
    }

    if (arrivalCount > 0) {
      const arrivals = generateArrivals(
        state.golferPool,
        arrivalCount,
        state.gameTime,
        state.greenFees,
        isWeekend,
        isTwilight
      );
      let totalFees = 0;
      for (const golfer of arrivals) {
        state.golferPool = addGolfer(state.golferPool, golfer);
        totalFees += golfer.paidAmount;
        state.economyState = addIncome(
          state.economyState,
          golfer.paidAmount,
          "green_fees",
          `Green fee: ${golfer.type}`,
          timestamp
        );
        state.dailyStats.revenue.greenFees += golfer.paidAmount;
        if (state.scenarioManager) {
          state.scenarioManager.addGolfers(1);
        }
      }
      const fee = `+$${totalFees.toFixed(0)}`;
      if (arrivalCount === 1) {
        systems.uiManager.showNotification(
          pick([
            `Golfer arrived! (${fee} green fee)`,
            `A golfer tees off (${fee})`,
            `New player on the course (${fee})`,
          ])
        );
      } else {
        systems.uiManager.showNotification(
          pick([
            `${arrivalCount} golfers arrived! (${fee})`,
            `Group of ${arrivalCount} heading out (${fee})`,
            `${arrivalCount} players on the first tee (${fee})`,
          ])
        );
      }
    }
  }
}

function tickGolferSimulation(
  state: GameState,
  systems: SimulationSystems,
  gameMinutes: number,
  timestamp: number
): void {
  const courseStats = systems.terrainSystem.getCourseStats();
  const staffQuality = 60; // Base service quality (no manager role currently)
  const tickResult = coreTickGolfers(
    state.golferPool,
    gameMinutes,
    courseStats.health,
    staffQuality,
    state.weather
  );
  state.golferPool = tickResult.state;

  const departureCount = tickResult.departures.length;
  if (departureCount > 0) {
    if (tickResult.tips > 0) {
      state.economyState = addIncome(
        state.economyState,
        tickResult.tips,
        "other_income",
        "Golfer tips",
        timestamp
      );
      if (state.scenarioManager) {
        state.scenarioManager.addRevenue(tickResult.tips);
      }
      const tipStr = `+$${tickResult.tips.toFixed(0)} tips`;
      systems.uiManager.showNotification(
        pick([
          `${departureCount} golfer${departureCount > 1 ? "s" : ""} finished (${tipStr})`,
          `Round complete! ${departureCount} headed to the clubhouse (${tipStr})`,
          `${departureCount} happy golfer${departureCount > 1 ? "s" : ""} leaving (${tipStr})`,
        ])
      );
    }
    state.dailyStats.revenue.tips += tickResult.tips;
    for (const departure of tickResult.departures) {
      state.dailyStats.golfersServed++;
      state.dailyStats.totalSatisfaction += departure.satisfaction;
      if (state.scenarioManager) {
        state.scenarioManager.addRevenue(departure.paidAmount);
        state.scenarioManager.addRound();
      }
    }
  }
}

function tickEmployees(
  state: GameState,
  systems: SimulationSystems,
  gameMinutes: number,
  deltaMs: number
): void {
  const trainingBonus = getEquipmentEfficiencyBonus(state.researchState);
  const tickEmployeesResult = coreTickEmployees(
    state.employeeRoster,
    gameMinutes,
    trainingBonus
  );
  state.employeeRoster = tickEmployeesResult.roster;

  const absoluteTime = state.gameDay * 24 * 60 + state.gameTime;
  const appResult = tickApplications(
    state.applicationState,
    absoluteTime,
    state.prestigeState.tier
  );
  state.applicationState = appResult.state;

  if (appResult.newApplicant) {
    systems.uiManager.showNotification(
      pick([
        `New applicant: ${appResult.newApplicant.name} (${appResult.newApplicant.role})`,
        `${appResult.newApplicant.name} applied for ${appResult.newApplicant.role}`,
        `Resume received: ${appResult.newApplicant.name}`,
      ])
    );
  }
  for (const posting of appResult.expiredPostings) {
    systems.uiManager.showNotification(
      `Job posting expired: ${posting.role}`,
      "#ffaa44"
    );
  }

  const absoluteGameTime = state.gameDay * 1440 + state.gameTime;
  const workResult = tickEmployeeWork(
    state.employeeWorkState,
    state.employeeRoster.employees,
    systems.terrainSystem,
    gameMinutes,
    absoluteGameTime,
    state.jobSystemState,
  );
  state.employeeWorkState = workResult.state;

  if (state.jobSystemState) {
    const workerPositions = new Map<string, { x: number; z: number }>();
    for (const w of state.employeeWorkState.workers) {
      workerPositions.set(w.employeeId, { x: w.worldX, z: w.worldZ });
    }
    const jobExecResult = tickJobExecution(state.jobSystemState, workerPositions, gameMinutes, absoluteGameTime);
    for (const effect of jobExecResult.effects) {
      const affected = systems.terrainSystem.applyWorkEffect(
        effect.worldX, effect.worldZ, effect.radius, effect.type, effect.efficiency, absoluteGameTime
      );
      if (affected.length > 0) {
        systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, effect.type as WorkEffectType);
      }
      for (const job of state.jobSystemState.jobs) {
        if (job.status === 'in_progress') {
          advanceJobProgress(state.jobSystemState, job.id, affected);
        }
      }
      if (effect.type === 'mow') state.dailyStats.maintenance.tilesMowed += affected.length;
      else if (effect.type === 'water') state.dailyStats.maintenance.tilesWatered += affected.length;
      else if (effect.type === 'fertilize') state.dailyStats.maintenance.tilesFertilized += affected.length;
    }
    for (const move of jobExecResult.workerMoves) {
      const worker = state.employeeWorkState.workers.find(w => w.employeeId === move.workerId);
      if (worker) {
        (worker as any).worldX = move.worldX;
        (worker as any).worldZ = move.worldZ;
      }
    }
  }

  for (const effect of workResult.effects) {
    const affected = systems.terrainSystem.applyWorkEffect(
      effect.worldX,
      effect.worldZ,
      effect.radius,
      effect.type,
      effect.efficiency,
      absoluteGameTime
    );
    if (affected.length > 0) {
      systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, effect.type as WorkEffectType);
    }
    if (effect.type === "mow") {
      state.dailyStats.maintenance.tilesMowed += affected.length;
    } else if (effect.type === "water") {
      state.dailyStats.maintenance.tilesWatered += affected.length;
    } else if (effect.type === "fertilize") {
      state.dailyStats.maintenance.tilesFertilized += affected.length;
    }
  }

  for (const completion of workResult.completions) {
    const expReward = TASK_EXPERIENCE_REWARDS[completion.task];
    if (expReward > 0) {
      state.employeeRoster = awardExperience(
        state.employeeRoster,
        completion.employeeId,
        expReward
      );
    }
    state.dailyStats.maintenance.tasksCompleted++;
    state.lastWorkNotifyCount++;
    if (state.lastWorkNotifyCount >= 5) {
      state.lastWorkNotifyCount = 0;
      const taskLabel = completion.task === "mow_grass" ? "mowing"
        : completion.task === "water_area" ? "watering"
        : completion.task === "fertilize_area" ? "fertilizing"
        : completion.task === "rake_bunker" ? "bunker raking"
        : "maintenance";
      systems.uiManager.showNotification(
        pick([
          `Crew finished ${taskLabel} section`,
          `${taskLabel.charAt(0).toUpperCase() + taskLabel.slice(1)} work complete`,
          `Another section done (${taskLabel})`,
        ]),
        "#88cc88"
      );
    }

    const supplyCost = TASK_SUPPLY_COSTS[completion.task];
    if (supplyCost > 0) {
      recordExpense(state, supplyCost, "supplies", `Maintenance: ${completion.task}`, state.gameDay * 24 * 60 + state.gameTime, "supplies");
    }
  }

  const workerPositions = getWorkerPositions(state.employeeWorkState);
  if (systems.employeeVisualSystem) {
    systems.employeeVisualSystem.update(workerPositions, deltaMs);
  }

  systems.uiManager.updateMinimapWorkers(
    workerPositions,
    state.currentCourse.width,
    state.currentCourse.height
  );
}

function tickResearch(state: GameState, systems: SimulationSystems, gameMinutes: number, timestamp: number): void {
  if (state.researchState.currentResearch) {
    state.accumulatedResearchTime += gameMinutes;
    if (state.accumulatedResearchTime >= 1) {
      const researchMinutes = Math.floor(state.accumulatedResearchTime);
      state.accumulatedResearchTime -= researchMinutes;
      const fundingCost =
        getFundingCostPerMinute(state.researchState) * researchMinutes;
      if (fundingCost > 0 && state.economyState.cash >= fundingCost) {
        recordExpense(state, fundingCost, "research", "Research funding", timestamp);
        const researchResult = coreTickResearch(
          state.researchState,
          researchMinutes,
          timestamp
        );
        state.researchState = researchResult.state;
        if (researchResult.completed) {
          const unlockDesc = describeResearchUnlock(researchResult.completed);
          systems.uiManager.showNotification(
            pick([
              `Research complete: ${unlockDesc}`,
              `Breakthrough! ${unlockDesc} unlocked`,
              `New tech: ${unlockDesc}`,
            ]),
            "#66ccff"
          );
        }
      }
    }
  }
}

function tickAutonomousEquipment(state: GameState, systems: SimulationSystems, gameMinutes: number, timestamp: number): void {
  if (state.autonomousState.robots.length > 0) {
    const safeAnchor = resolveServiceHubAnchorFromState(state);
    if (
      safeAnchor.x !== state.autonomousState.chargingStationX ||
      safeAnchor.y !== state.autonomousState.chargingStationY
    ) {
      state.autonomousState = {
        ...state.autonomousState,
        chargingStationX: safeAnchor.x,
        chargingStationY: safeAnchor.y,
      };
    }
    if (
      safeAnchor.x !== state.employeeWorkState.maintenanceShedX ||
      safeAnchor.y !== state.employeeWorkState.maintenanceShedY
    ) {
      state.employeeWorkState = {
        ...state.employeeWorkState,
        maintenanceShedX: safeAnchor.x,
        maintenanceShedY: safeAnchor.y,
      };
    }

    const courseCenterX = state.currentCourse.width / 2;
    const courseCenterZ = state.currentCourse.height / 2;
    const globalRadius =
      Math.ceil(
        Math.hypot(state.currentCourse.width, state.currentCourse.height) / 2
      ) + 2;
    // Use one canonical course-wide candidate snapshot so every robot sees the same work pool.
    const candidates = systems.terrainSystem.findWorkCandidates(
      courseCenterX,
      courseCenterZ,
      globalRadius
    );
    const fleetAIActive =
      state.researchState.completedResearch.includes("fleet_ai");
    const traverseCache = new Map<string, boolean>();
    const canRobotTraverse = (robot: RobotUnit, worldX: number, worldZ: number): boolean => {
      const cacheKey = `${robot.equipmentId}:${worldX.toFixed(3)}:${worldZ.toFixed(3)}`;
      const cached = traverseCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const store = (val: boolean) => { traverseCache.set(cacheKey, val); return val; };

      if (!systems.terrainSystem.isPositionWalkable(worldX, worldZ)) return store(false);

      const terrainType = systems.terrainSystem.getTerrainTypeAt(worldX, worldZ);
      if (!terrainType) return store(false);
      if (terrainType === "water") return store(false);
      if (terrainType === "bunker" && robot.type !== "raker") return store(false);
      if (terrainType === "green" && (robot.type === "raker" || robot.equipmentId.includes("mower_fairway"))) return store(false);

      return store(true);
    };
    const robotResult = coreTickAutonomousEquipment(
      state.autonomousState,
      candidates,
      gameMinutes,
      fleetAIActive,
      canRobotTraverse,
      state.employeeWorkState.areas
    );
    state.autonomousState = robotResult.state;

    if (robotResult.operatingCost > 0) {
      recordExpense(state, robotResult.operatingCost, "equipment_maintenance", "Robot operating costs", timestamp);
    }

    for (const effect of robotResult.effects) {
      if (effect.type === "mower") {
        const allowedTerrainCodes = getAllowedTerrainCodesForRobotEquipment(
          effect.equipmentId,
          effect.type
        );
        systems.terrainSystem.applyWorkEffect(
          effect.worldX,
          effect.worldZ,
          2.0,
          "mow",
          effect.efficiency,
          timestamp,
          allowedTerrainCodes ?? undefined
        );
        systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, "mow");
      } else if (effect.type === "raker") {
        const allowedTerrainCodes = getAllowedTerrainCodesForRobotEquipment(
          effect.equipmentId,
          effect.type
        );
        systems.terrainSystem.applyWorkEffect(
          effect.worldX,
          effect.worldZ,
          2.0,
          "rake",
          effect.efficiency,
          timestamp,
          allowedTerrainCodes ?? undefined
        );
        systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, "rake");
      } else if (effect.type === "sprayer") {
        systems.terrainSystem.waterArea(
          effect.worldX,
          effect.worldZ,
          2,
          10 * effect.efficiency
        );
        systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, "water");
      } else if (effect.type === "spreader") {
        const effectiveness = getBestFertilizerEffectiveness(
          state.researchState
        );
        systems.terrainSystem.fertilizeArea(
          effect.worldX,
          effect.worldZ,
          2,
          10 * effect.efficiency,
          effectiveness
        );
        systems.activityIndicatorSystem?.showWorkEffect(effect.worldX, effect.worldZ, "fertilize");
      }
    }
  }
}

function tickScenario(state: GameState, systems: SimulationSystems): void {
  if (state.scenarioManager) {
    state.scenarioManager.updateCourseHealthFromFaces?.(
      systems.terrainSystem.getAllFaceStates()
    );
    state.scenarioManager.updateProgress({
      currentCash: state.economyState.cash,
    });
  }
}

function tickIrrigation(state: GameState, systems: SimulationSystems, gameMinutes: number, timestamp: number): void {
  const hours = Math.floor(state.gameTime / 60);
  const minutes = state.gameTime % 60;
  const currentMinutes = hours * 60 + minutes;
  const isRainSuppressionActive =
    state.weather?.type === "rainy" || state.weather?.type === "stormy";

  state.irrigationSystem = updatePipePressures(state.irrigationSystem);

  const weatherEffect = state.weather
    ? { type: state.weather.type as "rainy" | "stormy" | "cloudy" | "sunny", temperature: state.weather.temperature ?? 70 }
    : undefined;
  state.irrigationSystem = checkForLeaks(
    state.irrigationSystem,
    timestamp,
    weatherEffect
  );
  // Leaks can change effective pressure; recompute so this tick's watering/FX are accurate.
  state.irrigationSystem = updatePipePressures(state.irrigationSystem);

  for (const head of state.irrigationSystem.sprinklerHeads) {
    const isInScheduledWindow = head.schedule.timeRanges.some(
      (range) => currentMinutes >= range.start && currentMinutes < range.end
    );
    const suppressedByRain = head.schedule.skipRain && isRainSuppressionActive;
    const shouldBeActive =
      head.schedule.enabled && isInScheduledWindow && !suppressedByRain;

    let isActive = head.isActive;
    if (shouldBeActive !== head.isActive) {
      state.irrigationSystem = setSprinklerActive(
        state.irrigationSystem,
        head.id,
        shouldBeActive
      );
      isActive = shouldBeActive;
    }

    if (isActive) {
      const pipe = getPipeAt(state.irrigationSystem, head.gridX, head.gridY);
      const pressure = pipe ? pipe.pressureLevel : 0;

      for (const tile of head.coverageTiles) {
        const faceId = systems.terrainSystem.findFaceAtPosition(tile.x, tile.y);
        if (faceId !== null) {
          const waterAmount = 15 * tile.efficiency * (pressure / 100);
          if (waterAmount <= 0) {
            continue;
          }
          systems.terrainSystem.waterArea(tile.x, tile.y, 0, waterAmount);
          state.dailyStats.maintenance.tilesWatered++;
        }
      }
    }
  }

  const activeHeads = state.irrigationSystem.sprinklerHeads.filter(
    (h) => h.isActive
  );
  if (
    activeHeads.length > 0 &&
    state.irrigationSystem.waterSources.length > 0
  ) {
    const source = state.irrigationSystem.waterSources[0];
    const waterUsage = calculateWaterUsage(
      activeHeads,
      gameMinutes,
      state.irrigationSystem
    );
    const waterCost = calculateWaterCost(waterUsage, source);

    if (waterCost > 0) {
      recordExpense(state, waterCost, "utilities", "Irrigation water", timestamp, "utilities");
    }
  }

  if (systems.irrigationRenderSystem) {
    systems.irrigationRenderSystem.update(state.irrigationSystem);
  }
}

function tickStandingOrders(state: GameState, systems: SimulationSystems, gameTime: number): void {
  if (!state.namedRegions?.length || !state.jobSystemState?.standingOrders?.length) return;

  const sampler: FaceStateSampler = {
    getFaceState: (fid: number) => {
      const fs = systems.terrainSystem.getAllFaceStates().get(fid);
      if (!fs) return undefined;
      return { grassHeight: fs.grassHeight, moisture: fs.moisture, nutrients: fs.nutrients, health: fs.health };
    },
  };

  evaluateStandingOrders(
    state.jobSystemState,
    state.namedRegions,
    sampler,
    gameTime,
    state.currentCourse.topology,
  );
}

function cleanupOldJobs(state: GameState, gameTime: number): void {
  if (!state.jobSystemState) return;
  cleanupCompletedJobs(state.jobSystemState, 1440, gameTime);
}

export function runSimulationTick(state: GameState, systems: SimulationSystems, deltaMs: number): void {
  const hours = Math.floor(state.gameTime / 60);
  const gameMinutes = (deltaMs / 1000) * 2 * state.timeScale;
  const isWeekendDay = state.gameDay % 7 >= 5;
  const isTwilight = hours >= 16;
  const timestamp = state.gameDay * 24 * 60 + state.gameTime;

  tickWeather(state, systems);
  tickPayroll(state, systems, hours, timestamp);
  tickAutoSave(state, systems, hours);
  tickPrestige(state, systems, hours);
  tickTeeTimes(state, systems, hours, timestamp);
  tickGolferArrivals(state, systems, hours, isWeekendDay, isTwilight, timestamp);
  tickGolferSimulation(state, systems, gameMinutes, timestamp);
  if (systems.golferVisualSystem) {
    systems.golferVisualSystem.update(state.golferPool, deltaMs);
  }
  tickStandingOrders(state, systems, timestamp);
  tickEmployees(state, systems, gameMinutes, deltaMs);
  tickResearch(state, systems, gameMinutes, timestamp);
  tickAutonomousEquipment(state, systems, gameMinutes, timestamp);
  tickScenario(state, systems);
  tickIrrigation(state, systems, gameMinutes, timestamp);
  cleanupOldJobs(state, timestamp);
}
