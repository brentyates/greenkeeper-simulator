import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { UIManager } from "./ui/UIManager";
import { CourseData } from "../data/courseData";
import { ScenarioDefinition } from "../data/scenarioData";
import { GameOptions } from "./BabylonMain";

import {
  EconomyState,
  addIncome,
  addExpense,
} from "../core/economy";
import {
  IrrigationSystem,
  updatePipePressures,
  checkForLeaks,
  setSprinklerActive,
  getPipeAt,
  calculateWaterUsage,
  calculateWaterCost,
} from "../core/irrigation";
import {
  EmployeeRoster,
  processPayroll,
  tickEmployees as coreTickEmployees,
  awardExperience,
  ApplicationState,
  tickApplications,
} from "../core/employees";
import {
  EmployeeWorkSystemState,
  tickEmployeeWork,
  getWorkerPositions,
  TASK_EXPERIENCE_REWARDS,
  TASK_SUPPLY_COSTS,
} from "../core/employee-work";
import {
  GolferPoolState,
  GreenFeeStructure,
  tickGolfers as coreTickGolfers,
  generateArrivals,
  calculateArrivalRate,
  updateCourseRating,
  addGolfer,
  WeatherCondition,
  resetDailyStats as resetGolferDailyStats,
} from "../core/golfers";
import {
  ResearchState,
  tickResearch as coreTickResearch,
  getFundingCostPerMinute,
  describeResearchUnlock,
  getEquipmentEfficiencyBonus,
  getBestFertilizerEffectiveness,
} from "../core/research";
import { ScenarioManager } from "../core/scenario";
import {
  PrestigeState,
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  calculateDemandMultiplier,
  takeDailySnapshot,
  updateHistoricalExcellence,
  resetDailyStats as resetPrestigeDailyStats,
} from "../core/prestige";
import {
  TeeTimeSystemState,
  generateDailySlots,
  simulateDailyBookings,
  applyBookingSimulation,
  getAvailableSlots,
  resetDailyMetrics as resetTeeTimeDailyMetrics,
  type GameTime,
} from "../core/tee-times";
import {
  WalkOnState,
  processWalkOns,
  resetDailyWalkOnMetrics,
} from "../core/walk-ons";
import {
  RevenueState,
  finalizeDailyRevenue,
} from "../core/tee-revenue";
import {
  MarketingState,
  processDailyCampaigns,
  calculateCombinedDemandMultiplier,
} from "../core/marketing";
import {
  AutonomousEquipmentState,
  tickAutonomousEquipment as coreTickAutonomousEquipment,
} from "../core/autonomous-equipment";
import {
  WeatherState,
  tickWeather as coreTickWeather,
  getWeatherDescription,
  getWeatherImpactDescription,
} from "../core/weather";
import {
  ReputationState,
} from "../core/reputation";

export interface DailyStats {
  revenue: { greenFees: number; tips: number; addOns: number; other: number };
  expenses: { wages: number; supplies: number; research: number; utilities: number; other: number };
  golfersServed: number;
  totalSatisfaction: number;
  courseHealthStart: number;
  prestigeStart: number;
  maintenance: {
    tasksCompleted: number;
    tilesMowed: number;
    tilesWatered: number;
    tilesFertilized: number;
  };
}

export interface SimulationContext {
  economyState: EconomyState;
  employeeRoster: EmployeeRoster;
  employeeWorkState: EmployeeWorkSystemState;
  golferPool: GolferPoolState;
  researchState: ResearchState;
  weatherState: WeatherState;
  weather: WeatherCondition;
  teeTimeState: TeeTimeSystemState;
  walkOnState: WalkOnState;
  revenueState: RevenueState;
  marketingState: MarketingState;
  autonomousState: AutonomousEquipmentState;
  prestigeState: PrestigeState;
  irrigationSystem: IrrigationSystem;
  reputationState: ReputationState;
  applicationState: ApplicationState;
  dailyStats: DailyStats;
  greenFees: GreenFeeStructure;

  gameTime: number;
  gameDay: number;
  timeScale: number;

  lastPayrollHour: number;
  lastArrivalHour: number;
  lastAutoSaveHour: number;
  lastPrestigeUpdateHour: number;
  lastTeeTimeUpdateHour: number;
  accumulatedResearchTime: number;

  terrainSystem: TerrainSystem;
  scenarioManager: ScenarioManager | null;
  uiManager: UIManager;
  employeeVisualSystem: EmployeeVisualSystem | null;
  irrigationRenderSystem: IrrigationRenderSystem | null;

  currentCourse: CourseData;
  currentScenario: ScenarioDefinition | null;
  gameOptions: GameOptions;

  saveCurrentGame: () => void;
  showDaySummary: () => void;
}

function tickWeather(ctx: SimulationContext): void {
  const weatherResult = coreTickWeather(
    ctx.weatherState,
    ctx.gameTime,
    ctx.gameDay
  );
  if (weatherResult.changed || weatherResult.state !== ctx.weatherState) {
    ctx.weatherState = weatherResult.state;
    ctx.weather = ctx.weatherState.current;
    if (weatherResult.changed) {
      const impact = getWeatherImpactDescription(ctx.weather);
      ctx.uiManager.showNotification(
        `Weather: ${getWeatherDescription(ctx.weather)}`,
        undefined,
        3000
      );
      if (impact) {
        setTimeout(() => {
          ctx.uiManager.showNotification(impact, undefined, 4000);
        }, 500);
      }
    }
  }
}

function tickPayroll(ctx: SimulationContext, hours: number, timestamp: number): void {
  if (
    hours !== ctx.lastPayrollHour &&
    ctx.employeeRoster.employees.length > 0
  ) {
    ctx.lastPayrollHour = hours;
    const payrollResult = processPayroll(ctx.employeeRoster, timestamp);
    ctx.employeeRoster = payrollResult.roster;
    if (payrollResult.totalPaid > 0) {
      const expenseResult = addExpense(
        ctx.economyState,
        payrollResult.totalPaid,
        "employee_wages",
        "Hourly wages",
        timestamp,
        true
      );
      if (expenseResult) {
        ctx.economyState = expenseResult;
        ctx.dailyStats.expenses.wages += payrollResult.totalPaid;
      }
    }
  }
}

function tickAutoSave(ctx: SimulationContext, hours: number): void {
  if (hours !== ctx.lastAutoSaveHour) {
    ctx.lastAutoSaveHour = hours;
    ctx.saveCurrentGame();
  }
}

function tickPrestige(ctx: SimulationContext, hours: number): void {
  if (hours !== ctx.lastPrestigeUpdateHour) {
    ctx.lastPrestigeUpdateHour = hours;
    const conditionsScore = calculateCurrentConditionsFromFaces(ctx.terrainSystem.getAllFaceStates());
    ctx.prestigeState = updatePrestigeScore(
      ctx.prestigeState,
      conditionsScore
    );
    const demandMult = calculateDemandMultiplier(
      ctx.greenFees.weekday18Holes,
      ctx.prestigeState.tolerance
    );
    const rejectionRate = Math.round((1 - demandMult) * 100);
    const recommendedMax = ctx.prestigeState.tolerance.rejectionThreshold;
    ctx.uiManager.updatePrestige(
      ctx.prestigeState,
      rejectionRate,
      recommendedMax
    );
  }
}

function tickTeeTimes(ctx: SimulationContext, hours: number, timestamp: number): void {
  if (hours !== ctx.lastTeeTimeUpdateHour) {
    ctx.lastTeeTimeUpdateHour = hours;
    const currentGameTime: GameTime = {
      day: ctx.gameDay,
      hour: hours,
      minute: 0,
    };

    if (hours === 5) {
      const newSlots = generateDailySlots(
        ctx.gameDay,
        ctx.teeTimeState.spacingConfig,
        ctx.teeTimeState.operatingHours
      );
      const updatedTeeTimes = new Map(ctx.teeTimeState.teeTimes);
      updatedTeeTimes.set(ctx.gameDay, newSlots);
      ctx.teeTimeState = {
        ...ctx.teeTimeState,
        teeTimes: updatedTeeTimes,
        currentDay: ctx.gameDay,
      };

      const marketingMultiplier = calculateCombinedDemandMultiplier(
        ctx.marketingState
      );
      const bookings = simulateDailyBookings(
        ctx.teeTimeState,
        ctx.gameDay,
        ctx.gameDay,
        {
          prestigeScore: ctx.prestigeState.currentScore / 200,
          marketingBonus: marketingMultiplier,
        },
        ctx.greenFees.weekday18Holes,
        20
      );
      ctx.teeTimeState = applyBookingSimulation(
        ctx.teeTimeState,
        bookings,
        ctx.gameDay
      );
    }

    if (hours >= 6 && hours <= 19) {
      const availableSlots = getAvailableSlots(
        ctx.teeTimeState,
        ctx.gameDay
      );
      const walkOnResult = processWalkOns(
        ctx.walkOnState,
        currentGameTime,
        availableSlots,
        ctx.greenFees.weekday18Holes,
        20
      );
      ctx.walkOnState = walkOnResult.state;
    }

    if (hours === 22) {
      processEndOfDay(ctx, timestamp);
    }
  }
}

function processEndOfDay(ctx: SimulationContext, timestamp: number): void {
  ctx.revenueState = finalizeDailyRevenue(ctx.revenueState);

  const marketingResult = processDailyCampaigns(
    ctx.marketingState,
    ctx.gameDay,
    ctx.teeTimeState.bookingMetrics.totalBookingsToday,
    ctx.revenueState.todaysRevenue.grossRevenue
  );
  ctx.marketingState = marketingResult.state;
  for (const name of marketingResult.completedCampaignNames) {
    ctx.uiManager.showNotification(`📢 Campaign completed: ${name}`);
  }
  if (marketingResult.dailyCost > 0) {
    const expenseResult = addExpense(
      ctx.economyState,
      marketingResult.dailyCost,
      "marketing",
      "Marketing campaigns",
      timestamp,
      true
    );
    if (expenseResult) {
      ctx.economyState = expenseResult;
      ctx.dailyStats.expenses.other += marketingResult.dailyCost;
    }
  }

  const dailyUtilitiesCost = 50;
  const utilitiesResult = addExpense(
    ctx.economyState,
    dailyUtilitiesCost,
    "utilities",
    "Daily utilities",
    timestamp,
    true
  );
  if (utilitiesResult) {
    ctx.economyState = utilitiesResult;
    ctx.dailyStats.expenses.utilities += dailyUtilitiesCost;
  }

  const dailySnapshot = takeDailySnapshot(
    ctx.prestigeState.currentConditions,
    ctx.gameDay
  );
  const newHistoricalExcellence = updateHistoricalExcellence(
    ctx.prestigeState.historicalExcellence,
    dailySnapshot
  );
  ctx.prestigeState = {
    ...ctx.prestigeState,
    historicalExcellence: newHistoricalExcellence,
  };

  ctx.showDaySummary();
  ctx.saveCurrentGame();

  ctx.walkOnState = resetDailyWalkOnMetrics(ctx.walkOnState);
  ctx.teeTimeState = resetTeeTimeDailyMetrics(ctx.teeTimeState);
  ctx.prestigeState = resetPrestigeDailyStats(ctx.prestigeState);
  ctx.golferPool = resetGolferDailyStats(ctx.golferPool);
}

function tickGolferArrivals(
  ctx: SimulationContext,
  hours: number,
  isWeekend: boolean,
  isTwilight: boolean,
  timestamp: number
): void {
  if (hours !== ctx.lastArrivalHour && hours >= 6 && hours <= 19) {
    ctx.lastArrivalHour = hours;
    const courseStats = ctx.terrainSystem.getCourseStats();
    ctx.golferPool = updateCourseRating(ctx.golferPool, {
      condition: courseStats.health,
    });

    const baseArrivalRate = calculateArrivalRate(
      ctx.golferPool,
      ctx.weather,
      isWeekend,
      hours
    );

    const demandMultiplier = calculateDemandMultiplier(
      ctx.greenFees.weekday18Holes,
      ctx.prestigeState.tolerance
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
      const lostRevenue = rejectedCount * ctx.greenFees.weekday18Holes;
      ctx.prestigeState = {
        ...ctx.prestigeState,
        golfersRejectedToday:
          ctx.prestigeState.golfersRejectedToday + rejectedCount,
        revenueLostToday: ctx.prestigeState.revenueLostToday + lostRevenue,
      };
      if (
        ctx.prestigeState.golfersRejectedToday >= 5 &&
        rejectedCount >= 2
      ) {
        ctx.uiManager.showNotification(
          `⚠️ ${rejectedCount} golfers turned away! (Prices too high)`,
          "#ffaa44"
        );
      }
    }

    if (arrivalCount > 0) {
      const arrivals = generateArrivals(
        ctx.golferPool,
        arrivalCount,
        ctx.gameTime,
        ctx.greenFees,
        isWeekend,
        isTwilight
      );
      let totalFees = 0;
      for (const golfer of arrivals) {
        ctx.golferPool = addGolfer(ctx.golferPool, golfer);
        totalFees += golfer.paidAmount;
        ctx.economyState = addIncome(
          ctx.economyState,
          golfer.paidAmount,
          "green_fees",
          `Green fee: ${golfer.type}`,
          timestamp
        );
        ctx.dailyStats.revenue.greenFees += golfer.paidAmount;
        if (ctx.scenarioManager) {
          ctx.scenarioManager.addRevenue(golfer.paidAmount);
          ctx.scenarioManager.addGolfers(1);
        }
      }
      ctx.uiManager.showNotification(
        `${arrivalCount} golfer${
          arrivalCount > 1 ? "s" : ""
        } arrived (+$${totalFees.toFixed(0)})`
      );
    }
  }
}

function tickGolferSimulation(
  ctx: SimulationContext,
  gameMinutes: number,
  timestamp: number
): void {
  const courseStats = ctx.terrainSystem.getCourseStats();
  const staffQuality = getManagerBonus(ctx.employeeRoster) * 10 + 50;
  const tickResult = coreTickGolfers(
    ctx.golferPool,
    gameMinutes,
    courseStats.health,
    staffQuality,
    ctx.weather
  );
  ctx.golferPool = tickResult.state;

  const departureCount = tickResult.departures.length;
  if (departureCount > 0) {
    if (tickResult.tips > 0) {
      ctx.economyState = addIncome(
        ctx.economyState,
        tickResult.tips,
        "other_income",
        "Golfer tips",
        timestamp
      );
      if (ctx.scenarioManager) {
        ctx.scenarioManager.addRevenue(tickResult.tips);
      }
      ctx.uiManager.showNotification(
        `${departureCount} golfer${
          departureCount > 1 ? "s" : ""
        } finished (+$${tickResult.tips.toFixed(0)} tips)`
      );
    }
    ctx.dailyStats.revenue.tips += tickResult.tips;
    for (const departure of tickResult.departures) {
      ctx.dailyStats.golfersServed++;
      ctx.dailyStats.totalSatisfaction += departure.satisfaction;
      if (ctx.scenarioManager) {
        ctx.scenarioManager.addRound();
      }
    }
  }
}

function tickEmployees(
  ctx: SimulationContext,
  gameMinutes: number,
  deltaMs: number
): void {
  const trainingBonus = getEquipmentEfficiencyBonus(ctx.researchState);
  const tickEmployeesResult = coreTickEmployees(
    ctx.employeeRoster,
    gameMinutes,
    trainingBonus
  );
  ctx.employeeRoster = tickEmployeesResult.roster;

  const absoluteTime = ctx.gameDay * 24 * 60 + ctx.gameTime;
  const appResult = tickApplications(
    ctx.applicationState,
    absoluteTime,
    ctx.prestigeState.tier
  );
  ctx.applicationState = appResult.state;

  if (appResult.newApplicant) {
    ctx.uiManager.showNotification(
      `📋 New applicant: ${appResult.newApplicant.name} (${appResult.newApplicant.role})`
    );
  }
  for (const posting of appResult.expiredPostings) {
    ctx.uiManager.showNotification(
      `⏰ Job posting expired: ${posting.role}`,
      "#ffaa44"
    );
  }

  const absoluteGameTime = ctx.gameDay * 1440 + ctx.gameTime;
  const workResult = tickEmployeeWork(
    ctx.employeeWorkState,
    ctx.employeeRoster.employees,
    ctx.terrainSystem,
    gameMinutes,
    absoluteGameTime
  );
  ctx.employeeWorkState = workResult.state;

  for (const effect of workResult.effects) {
    const affected = ctx.terrainSystem.applyWorkEffect(
      effect.worldX,
      effect.worldZ,
      effect.radius,
      effect.type,
      effect.efficiency,
      absoluteGameTime
    );
    if (effect.type === "mow") {
      ctx.dailyStats.maintenance.tilesMowed += affected.length;
    } else if (effect.type === "water") {
      ctx.dailyStats.maintenance.tilesWatered += affected.length;
    } else if (effect.type === "fertilize") {
      ctx.dailyStats.maintenance.tilesFertilized += affected.length;
    }
  }

  for (const completion of workResult.completions) {
    const expReward = TASK_EXPERIENCE_REWARDS[completion.task];
    if (expReward > 0) {
      ctx.employeeRoster = awardExperience(
        ctx.employeeRoster,
        completion.employeeId,
        expReward
      );
    }
    ctx.dailyStats.maintenance.tasksCompleted++;

    const supplyCost = TASK_SUPPLY_COSTS[completion.task];
    if (supplyCost > 0) {
      const ts = ctx.gameDay * 24 * 60 + ctx.gameTime;
      const expenseResult = addExpense(
        ctx.economyState,
        supplyCost,
        "supplies",
        `Maintenance: ${completion.task}`,
        ts,
        true
      );
      if (expenseResult) {
        ctx.economyState = expenseResult;
        ctx.dailyStats.expenses.supplies += supplyCost;
      }
    }
  }

  const workerPositions = getWorkerPositions(ctx.employeeWorkState);
  if (ctx.employeeVisualSystem) {
    ctx.employeeVisualSystem.update(workerPositions, deltaMs);
  }

  ctx.uiManager.updateMinimapWorkers(
    workerPositions,
    ctx.currentCourse.width,
    ctx.currentCourse.height
  );
}

function tickResearch(ctx: SimulationContext, gameMinutes: number, timestamp: number): void {
  if (ctx.researchState.currentResearch) {
    ctx.accumulatedResearchTime += gameMinutes;
    if (ctx.accumulatedResearchTime >= 1) {
      const researchMinutes = Math.floor(ctx.accumulatedResearchTime);
      ctx.accumulatedResearchTime -= researchMinutes;
      const fundingCost =
        getFundingCostPerMinute(ctx.researchState) * researchMinutes;
      if (fundingCost > 0 && ctx.economyState.cash >= fundingCost) {
        const expenseResult = addExpense(
          ctx.economyState,
          fundingCost,
          "research",
          "Research funding",
          timestamp,
          true
        );
        if (expenseResult) {
          ctx.economyState = expenseResult;
        }
        const researchResult = coreTickResearch(
          ctx.researchState,
          researchMinutes,
          timestamp
        );
        ctx.researchState = researchResult.state;
        if (researchResult.completed) {
          const unlockDesc = describeResearchUnlock(researchResult.completed);
          ctx.uiManager.showNotification(`Research complete: ${unlockDesc}`);
        }
      }
    }
  }
}

function tickAutonomousEquipment(ctx: SimulationContext, gameMinutes: number, timestamp: number): void {
  if (ctx.autonomousState.robots.length > 0) {
    const cells = ctx.terrainSystem.getAllCells();
    const fleetAIActive =
      ctx.researchState.completedResearch.includes("fleet_ai");
    const robotResult = coreTickAutonomousEquipment(
      ctx.autonomousState,
      cells,
      gameMinutes,
      fleetAIActive
    );
    ctx.autonomousState = robotResult.state;

    if (robotResult.operatingCost > 0) {
      const expenseResult = addExpense(
        ctx.economyState,
        robotResult.operatingCost,
        "equipment_maintenance",
        "Robot operating costs",
        timestamp,
        true
      );
      if (expenseResult) {
        ctx.economyState = expenseResult;
      }
    }

    for (const effect of robotResult.effects) {
      if (effect.type === "mower") {
        ctx.terrainSystem.mowAt(effect.gridX, effect.gridY);
      } else if (effect.type === "sprayer") {
        ctx.terrainSystem.waterArea(
          effect.gridX,
          effect.gridY,
          1,
          10 * effect.efficiency
        );
      } else if (effect.type === "spreader") {
        const effectiveness = getBestFertilizerEffectiveness(
          ctx.researchState
        );
        ctx.terrainSystem.fertilizeArea(
          effect.gridX,
          effect.gridY,
          1,
          10 * effect.efficiency,
          effectiveness
        );
      }
    }
  }
}

function tickScenario(ctx: SimulationContext): void {
  if (ctx.scenarioManager) {
    const courseStats = ctx.terrainSystem.getCourseStats();
    ctx.scenarioManager.updateProgress({
      currentCash: ctx.economyState.cash,
      currentHealth: courseStats.health,
    });
  }
}

function tickIrrigation(ctx: SimulationContext, gameMinutes: number, timestamp: number): void {
  const hours = Math.floor(ctx.gameTime / 60);
  const minutes = ctx.gameTime % 60;

  ctx.irrigationSystem = updatePipePressures(ctx.irrigationSystem);

  const weatherEffect = ctx.weather
    ? {
        type:
          ctx.weather.type === "rainy"
            ? ("rainy" as const)
            : ctx.weather.type === "stormy"
            ? ("stormy" as const)
            : ctx.weather.type === "cloudy"
            ? ("cloudy" as const)
            : ("sunny" as const),
        temperature: ctx.weather.temperature ?? 70,
      }
    : undefined;
  ctx.irrigationSystem = checkForLeaks(
    ctx.irrigationSystem,
    timestamp,
    weatherEffect
  );

  for (const head of ctx.irrigationSystem.sprinklerHeads) {
    if (!head.schedule.enabled) continue;

    let shouldWater = false;
    for (const range of head.schedule.timeRanges) {
      const currentMinutes = hours * 60 + minutes;
      if (currentMinutes >= range.start && currentMinutes < range.end) {
        shouldWater = true;
        break;
      }
    }

    if (shouldWater && !head.isActive) {
      ctx.irrigationSystem = setSprinklerActive(
        ctx.irrigationSystem,
        head.id,
        true
      );
    } else if (!shouldWater && head.isActive) {
      ctx.irrigationSystem = setSprinklerActive(
        ctx.irrigationSystem,
        head.id,
        false
      );
    }

    if (head.isActive) {
      const pipe = getPipeAt(ctx.irrigationSystem, head.gridX, head.gridY);
      const pressure = pipe ? pipe.pressureLevel : 0;

      for (const tile of head.coverageTiles) {
        const cell = ctx.terrainSystem.getCell(tile.x, tile.y);
        if (cell) {
          const waterAmount = 15 * tile.efficiency * (pressure / 100);
          ctx.terrainSystem.waterArea(tile.x, tile.y, 0, waterAmount);
          ctx.dailyStats.maintenance.tilesWatered++;
        }
      }
    }
  }

  const activeHeads = ctx.irrigationSystem.sprinklerHeads.filter(
    (h) => h.isActive
  );
  if (
    activeHeads.length > 0 &&
    ctx.irrigationSystem.waterSources.length > 0
  ) {
    const source = ctx.irrigationSystem.waterSources[0];
    const waterUsage = calculateWaterUsage(
      activeHeads,
      gameMinutes,
      ctx.irrigationSystem
    );
    const waterCost = calculateWaterCost(waterUsage, source);

    if (waterCost > 0) {
      const expenseResult = addExpense(
        ctx.economyState,
        waterCost,
        "utilities",
        "Irrigation water",
        timestamp,
        true
      );
      if (expenseResult) {
        ctx.economyState = expenseResult;
        ctx.dailyStats.expenses.utilities += waterCost;
      }
    }
  }

  if (ctx.irrigationRenderSystem) {
    ctx.irrigationRenderSystem.update(ctx.irrigationSystem);
  }
}

import { getManagerBonus } from "../core/employees";

export function runSimulationTick(ctx: SimulationContext, deltaMs: number): void {
  const hours = Math.floor(ctx.gameTime / 60);
  const gameMinutes = (deltaMs / 1000) * 2 * ctx.timeScale;
  const isWeekendDay = ctx.gameDay % 7 >= 5;
  const isTwilight = hours >= 16;
  const timestamp = ctx.gameDay * 24 * 60 + ctx.gameTime;

  tickWeather(ctx);
  tickPayroll(ctx, hours, timestamp);
  tickAutoSave(ctx, hours);
  tickPrestige(ctx, hours);
  tickTeeTimes(ctx, hours, timestamp);
  tickGolferArrivals(ctx, hours, isWeekendDay, isTwilight, timestamp);
  tickGolferSimulation(ctx, gameMinutes, timestamp);
  tickEmployees(ctx, gameMinutes, deltaMs);
  tickResearch(ctx, gameMinutes, timestamp);
  tickAutonomousEquipment(ctx, gameMinutes, timestamp);
  tickScenario(ctx);
  tickIrrigation(ctx, gameMinutes, timestamp);
}
