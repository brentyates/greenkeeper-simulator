import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { UIManager } from "./ui/UIManager";
import { GameState } from "./GameState";
import { resolveServiceHubAnchorFromState } from "./GameState";

import {
  addIncome,
  addExpense,
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

export interface SimulationSystems {
  terrainSystem: TerrainSystem;
  uiManager: UIManager;
  employeeVisualSystem: EmployeeVisualSystem | null;
  irrigationRenderSystem: IrrigationRenderSystem | null;
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

function tickPayroll(state: GameState, hours: number, timestamp: number): void {
  if (
    hours !== state.lastPayrollHour &&
    state.employeeRoster.employees.length > 0
  ) {
    state.lastPayrollHour = hours;
    const payrollResult = processPayroll(state.employeeRoster, timestamp);
    state.employeeRoster = payrollResult.roster;
    if (payrollResult.totalPaid > 0) {
      const expenseResult = addExpense(
        state.economyState,
        payrollResult.totalPaid,
        "employee_wages",
        "Hourly wages",
        timestamp,
        true
      );
      if (expenseResult) {
        state.economyState = expenseResult;
        state.dailyStats.expenses.wages += payrollResult.totalPaid;
      }
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
    timestamp,
    true
  );
  if (utilitiesResult) {
    state.economyState = utilitiesResult;
    state.dailyStats.expenses.utilities += dailyUtilitiesCost;
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
          `⚠️ ${rejectedCount} golfers turned away! (Prices too high)`,
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
          state.scenarioManager.addRevenue(golfer.paidAmount);
          state.scenarioManager.addGolfers(1);
        }
      }
      systems.uiManager.showNotification(
        `${arrivalCount} golfer${
          arrivalCount > 1 ? "s" : ""
        } arrived (+$${totalFees.toFixed(0)})`
      );
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
  const staffQuality = 50;
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
      systems.uiManager.showNotification(
        `${departureCount} golfer${
          departureCount > 1 ? "s" : ""
        } finished (+$${tickResult.tips.toFixed(0)} tips)`
      );
    }
    state.dailyStats.revenue.tips += tickResult.tips;
    for (const departure of tickResult.departures) {
      state.dailyStats.golfersServed++;
      state.dailyStats.totalSatisfaction += departure.satisfaction;
      if (state.scenarioManager) {
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
      `📋 New applicant: ${appResult.newApplicant.name} (${appResult.newApplicant.role})`
    );
  }
  for (const posting of appResult.expiredPostings) {
    systems.uiManager.showNotification(
      `⏰ Job posting expired: ${posting.role}`,
      "#ffaa44"
    );
  }

  const absoluteGameTime = state.gameDay * 1440 + state.gameTime;
  const workResult = tickEmployeeWork(
    state.employeeWorkState,
    state.employeeRoster.employees,
    systems.terrainSystem,
    gameMinutes,
    absoluteGameTime
  );
  state.employeeWorkState = workResult.state;

  for (const effect of workResult.effects) {
    const affected = systems.terrainSystem.applyWorkEffect(
      effect.worldX,
      effect.worldZ,
      effect.radius,
      effect.type,
      effect.efficiency,
      absoluteGameTime
    );
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

    const supplyCost = TASK_SUPPLY_COSTS[completion.task];
    if (supplyCost > 0) {
      const ts = state.gameDay * 24 * 60 + state.gameTime;
      const expenseResult = addExpense(
        state.economyState,
        supplyCost,
        "supplies",
        `Maintenance: ${completion.task}`,
        ts,
        true
      );
      if (expenseResult) {
        state.economyState = expenseResult;
        state.dailyStats.expenses.supplies += supplyCost;
      }
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
        const expenseResult = addExpense(
          state.economyState,
          fundingCost,
          "research",
          "Research funding",
          timestamp,
          true
        );
        if (expenseResult) {
          state.economyState = expenseResult;
        }
        const researchResult = coreTickResearch(
          state.researchState,
          researchMinutes,
          timestamp
        );
        state.researchState = researchResult.state;
        if (researchResult.completed) {
          const unlockDesc = describeResearchUnlock(researchResult.completed);
          systems.uiManager.showNotification(`Research complete: ${unlockDesc}`);
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
      canRobotTraverse
    );
    state.autonomousState = robotResult.state;

    if (robotResult.operatingCost > 0) {
      const expenseResult = addExpense(
        state.economyState,
        robotResult.operatingCost,
        "equipment_maintenance",
        "Robot operating costs",
        timestamp,
        true
      );
      if (expenseResult) {
        state.economyState = expenseResult;
      }
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
      } else if (effect.type === "sprayer") {
        systems.terrainSystem.waterArea(
          effect.worldX,
          effect.worldZ,
          2,
          10 * effect.efficiency
        );
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
      }
    }
  }
}

function tickScenario(state: GameState, systems: SimulationSystems): void {
  if (state.scenarioManager) {
    const courseStats = systems.terrainSystem.getCourseStats();
    state.scenarioManager.updateProgress({
      currentCash: state.economyState.cash,
      currentHealth: courseStats.health,
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
    ? {
        type:
          state.weather.type === "rainy"
            ? ("rainy" as const)
            : state.weather.type === "stormy"
            ? ("stormy" as const)
            : state.weather.type === "cloudy"
            ? ("cloudy" as const)
            : ("sunny" as const),
        temperature: state.weather.temperature ?? 70,
      }
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
      const expenseResult = addExpense(
        state.economyState,
        waterCost,
        "utilities",
        "Irrigation water",
        timestamp,
        true
      );
      if (expenseResult) {
        state.economyState = expenseResult;
        state.dailyStats.expenses.utilities += waterCost;
      }
    }
  }

  if (systems.irrigationRenderSystem) {
    systems.irrigationRenderSystem.update(state.irrigationSystem);
  }
}

export function runSimulationTick(state: GameState, systems: SimulationSystems, deltaMs: number): void {
  const hours = Math.floor(state.gameTime / 60);
  const gameMinutes = (deltaMs / 1000) * 2 * state.timeScale;
  const isWeekendDay = state.gameDay % 7 >= 5;
  const isTwilight = hours >= 16;
  const timestamp = state.gameDay * 24 * 60 + state.gameTime;

  tickWeather(state, systems);
  tickPayroll(state, hours, timestamp);
  tickAutoSave(state, systems, hours);
  tickPrestige(state, systems, hours);
  tickTeeTimes(state, systems, hours, timestamp);
  tickGolferArrivals(state, systems, hours, isWeekendDay, isTwilight, timestamp);
  tickGolferSimulation(state, systems, gameMinutes, timestamp);
  tickEmployees(state, systems, gameMinutes, deltaMs);
  tickResearch(state, systems, gameMinutes, timestamp);
  tickAutonomousEquipment(state, systems, gameMinutes, timestamp);
  tickScenario(state, systems);
  tickIrrigation(state, systems, gameMinutes, timestamp);
}
