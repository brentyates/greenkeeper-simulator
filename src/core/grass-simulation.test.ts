import { describe, it, expect } from 'vitest';
import {
  simulateGrowth,
  applyMowing,
  applyWatering,
  applyFertilizing,
  getAverageStats,
  countCellsNeedingMowing,
  countCellsNeedingWater,
  countCellsNeedingFertilizer,
  getOverallCondition,
  getWeatherMoistureEffect,
  WeatherEffect
} from './grass-simulation';
import { CellState } from './terrain';

function makeCell(overrides: Partial<CellState> = {}): CellState {
  return {
    x: 0, y: 0,
    type: 'fairway',
    height: 50,
    moisture: 50,
    nutrients: 50,
    health: 50,
    elevation: 0,
    obstacle: 'none',
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
    ...overrides
  };
}

describe('Grass Growth Simulation', () => {
  describe('simulateGrowth', () => {
    it('does not change bunker cells', () => {
      const cell = makeCell({ type: 'bunker', height: 0, moisture: 20, nutrients: 0 });
      const result = simulateGrowth(cell, 60);
      expect(result.height).toBe(0);
      expect(result.moisture).toBe(20);
      expect(result.nutrients).toBe(0);
    });

    it('does not change water cells', () => {
      const cell = makeCell({ type: 'water', height: 0, moisture: 100, nutrients: 0 });
      const result = simulateGrowth(cell, 60);
      expect(result.height).toBe(0);
      expect(result.moisture).toBe(100);
      expect(result.nutrients).toBe(0);
    });

    it('increases height over time', () => {
      const cell = makeCell({ height: 10, moisture: 30, nutrients: 30, health: 50 });
      const result = simulateGrowth(cell, 60);
      expect(result.height).toBeGreaterThan(10);
    });

    it('decreases moisture over time', () => {
      const cell = makeCell({ moisture: 50 });
      const result = simulateGrowth(cell, 60);
      expect(result.moisture).toBeLessThan(50);
    });

    it('decreases nutrients over time', () => {
      const cell = makeCell({ nutrients: 50 });
      const result = simulateGrowth(cell, 60);
      expect(result.nutrients).toBeLessThan(50);
    });

    it('grows faster with high moisture (> 50)', () => {
      const lowMoisture = makeCell({ height: 10, moisture: 30, nutrients: 30, health: 50 });
      const highMoisture = makeCell({ height: 10, moisture: 60, nutrients: 30, health: 50 });

      const lowResult = simulateGrowth(lowMoisture, 60);
      const highResult = simulateGrowth(highMoisture, 60);

      expect(highResult.height).toBeGreaterThan(lowResult.height);
    });

    it('grows faster with high nutrients (> 50)', () => {
      const lowNutrients = makeCell({ height: 10, moisture: 30, nutrients: 30, health: 50 });
      const highNutrients = makeCell({ height: 10, moisture: 30, nutrients: 60, health: 50 });

      const lowResult = simulateGrowth(lowNutrients, 60);
      const highResult = simulateGrowth(highNutrients, 60);

      expect(highResult.height).toBeGreaterThan(lowResult.height);
    });

    it('grows slower with low health (< 30)', () => {
      const lowHealth = makeCell({ height: 10, moisture: 30, nutrients: 30, health: 20 });
      const normalHealth = makeCell({ height: 10, moisture: 30, nutrients: 30, health: 50 });

      const lowResult = simulateGrowth(lowHealth, 60);
      const normalResult = simulateGrowth(normalHealth, 60);

      expect(lowResult.height).toBeLessThan(normalResult.height);
    });

    it('caps height at 100', () => {
      const cell = makeCell({ height: 99, moisture: 100, nutrients: 100, health: 100 });
      const result = simulateGrowth(cell, 600);
      expect(result.height).toBe(100);
    });

    it('caps moisture at 0', () => {
      const cell = makeCell({ moisture: 1 });
      const result = simulateGrowth(cell, 6000);
      expect(result.moisture).toBe(0);
    });

    it('caps nutrients at 0', () => {
      const cell = makeCell({ nutrients: 1 });
      const result = simulateGrowth(cell, 6000);
      expect(result.nutrients).toBe(0);
    });

    it('recalculates health after growth', () => {
      const cell = makeCell({ height: 10, moisture: 80, nutrients: 80, health: 90 });
      const result = simulateGrowth(cell, 60);
      expect(result.health).toBeDefined();
      expect(result.health).not.toBe(cell.health);
    });

    it('base growth rate is 0.1 per minute', () => {
      const cell = makeCell({ height: 0, moisture: 30, nutrients: 30, health: 50 });
      const result = simulateGrowth(cell, 100);
      expect(result.height).toBeCloseTo(10, 1);
    });

    it('moisture decays at 0.05 per minute', () => {
      const cell = makeCell({ moisture: 100, nutrients: 30, health: 50 });
      const result = simulateGrowth(cell, 100);
      expect(result.moisture).toBeCloseTo(95, 1);
    });

    it('nutrients decay at 0.02 per minute', () => {
      const cell = makeCell({ moisture: 30, nutrients: 100, health: 50 });
      const result = simulateGrowth(cell, 100);
      expect(result.nutrients).toBeCloseTo(98, 1);
    });

    describe('weather effects', () => {
      it('rain increases moisture', () => {
        const cell = makeCell({ moisture: 50 });
        const weather: WeatherEffect = { type: 'rainy', temperature: 70 };
        const result = simulateGrowth(cell, 60, weather);
        expect(result.moisture).toBeGreaterThan(50);
      });

      it('rain reduces moisture loss', () => {
        const cell = makeCell({ moisture: 50 });
        const noWeather = simulateGrowth(cell, 60);
        const withRain = simulateGrowth(cell, 60, { type: 'rainy', temperature: 70 });
        expect(withRain.moisture).toBeGreaterThan(noWeather.moisture);
      });

      it('storm adds more moisture than rain', () => {
        const cell = makeCell({ moisture: 50 });
        const rain = simulateGrowth(cell, 60, { type: 'rainy', temperature: 70 });
        const storm = simulateGrowth(cell, 60, { type: 'stormy', temperature: 70 });
        expect(storm.moisture).toBeGreaterThan(rain.moisture);
      });

      it('cloudy weather reduces moisture loss', () => {
        const cell = makeCell({ moisture: 50 });
        const sunny = simulateGrowth(cell, 60, { type: 'sunny', temperature: 70 });
        const cloudy = simulateGrowth(cell, 60, { type: 'cloudy', temperature: 70 });
        expect(cloudy.moisture).toBeGreaterThan(sunny.moisture);
      });

      it('hot sunny weather increases moisture loss', () => {
        const cell = makeCell({ moisture: 50 });
        const normal = simulateGrowth(cell, 60, { type: 'sunny', temperature: 75 });
        const hot = simulateGrowth(cell, 60, { type: 'sunny', temperature: 95 });
        expect(hot.moisture).toBeLessThan(normal.moisture);
      });

      it('very hot weather loses moisture faster', () => {
        const cell = makeCell({ moisture: 50 });
        const hot80 = simulateGrowth(cell, 60, { type: 'sunny', temperature: 85 });
        const hot95 = simulateGrowth(cell, 60, { type: 'sunny', temperature: 95 });
        expect(hot95.moisture).toBeLessThan(hot80.moisture);
      });

      it('moisture is capped at 100', () => {
        const cell = makeCell({ moisture: 95 });
        const result = simulateGrowth(cell, 60, { type: 'stormy', temperature: 70 });
        expect(result.moisture).toBeLessThanOrEqual(100);
      });
    });
  });
});

describe('getWeatherMoistureEffect', () => {
  it('returns neutral effect for no weather', () => {
    const effect = getWeatherMoistureEffect();
    expect(effect.gainRate).toBe(0);
    expect(effect.lossMultiplier).toBe(1.0);
  });

  it('returns moisture gain for rain', () => {
    const effect = getWeatherMoistureEffect({ type: 'rainy', temperature: 70 });
    expect(effect.gainRate).toBeGreaterThan(0);
    expect(effect.lossMultiplier).toBeLessThan(1.0);
  });

  it('returns higher moisture gain for storm', () => {
    const rain = getWeatherMoistureEffect({ type: 'rainy', temperature: 70 });
    const storm = getWeatherMoistureEffect({ type: 'stormy', temperature: 70 });
    expect(storm.gainRate).toBeGreaterThan(rain.gainRate);
  });

  it('returns reduced loss for cloudy', () => {
    const effect = getWeatherMoistureEffect({ type: 'cloudy', temperature: 70 });
    expect(effect.gainRate).toBe(0);
    expect(effect.lossMultiplier).toBeLessThan(1.0);
  });

  it('returns increased loss for hot sunny weather', () => {
    const normalSunny = getWeatherMoistureEffect({ type: 'sunny', temperature: 75 });
    const hotSunny = getWeatherMoistureEffect({ type: 'sunny', temperature: 95 });
    expect(hotSunny.lossMultiplier).toBeGreaterThan(normalSunny.lossMultiplier);
  });
});

describe('Equipment Effects', () => {
  describe('applyMowing', () => {
    it('sets height to 0', () => {
      const cell = makeCell({ height: 80 });
      const result = applyMowing(cell);
      expect(result?.height).toBe(0);
    });

    it('returns null for bunker', () => {
      const cell = makeCell({ type: 'bunker' });
      expect(applyMowing(cell)).toBeNull();
    });

    it('returns null for water', () => {
      const cell = makeCell({ type: 'water' });
      expect(applyMowing(cell)).toBeNull();
    });

    it('improves health after mowing (due to lower height)', () => {
      const cell = makeCell({ height: 80, moisture: 60, nutrients: 60 });
      const result = applyMowing(cell);
      expect(result?.health).toBeGreaterThan(cell.health);
    });

    it('does not modify original cell', () => {
      const cell = makeCell({ height: 80 });
      applyMowing(cell);
      expect(cell.height).toBe(80);
    });

    it('works on fairway terrain', () => {
      const cell = makeCell({ type: 'fairway', height: 50 });
      const result = applyMowing(cell);
      expect(result).not.toBeNull();
      expect(result?.height).toBe(0);
    });

    it('works on rough terrain', () => {
      const cell = makeCell({ type: 'rough', height: 70 });
      const result = applyMowing(cell);
      expect(result).not.toBeNull();
      expect(result?.height).toBe(0);
    });

    it('works on green terrain', () => {
      const cell = makeCell({ type: 'green', height: 20 });
      const result = applyMowing(cell);
      expect(result).not.toBeNull();
      expect(result?.height).toBe(0);
    });
  });

  describe('applyWatering', () => {
    it('increases moisture by specified amount', () => {
      const cell = makeCell({ moisture: 30 });
      const result = applyWatering(cell, 20);
      expect(result?.moisture).toBe(50);
    });

    it('caps moisture at 100', () => {
      const cell = makeCell({ moisture: 90 });
      const result = applyWatering(cell, 20);
      expect(result?.moisture).toBe(100);
    });

    it('returns null for water terrain', () => {
      const cell = makeCell({ type: 'water' });
      expect(applyWatering(cell, 20)).toBeNull();
    });

    it('halves effect on bunker terrain', () => {
      const cell = makeCell({ type: 'bunker', moisture: 20 });
      const result = applyWatering(cell, 20);
      expect(result?.moisture).toBe(30);
    });

    it('recalculates health after watering', () => {
      const cell = makeCell({ moisture: 10, nutrients: 50, height: 30, health: 40 });
      const result = applyWatering(cell, 40);
      expect(result?.health).toBeGreaterThan(cell.health);
    });

    it('does not modify original cell', () => {
      const cell = makeCell({ moisture: 30 });
      applyWatering(cell, 20);
      expect(cell.moisture).toBe(30);
    });
  });

  describe('applyFertilizing', () => {
    it('increases nutrients by specified amount', () => {
      const cell = makeCell({ nutrients: 30 });
      const result = applyFertilizing(cell, 20);
      expect(result?.nutrients).toBe(50);
    });

    it('caps nutrients at 100', () => {
      const cell = makeCell({ nutrients: 90 });
      const result = applyFertilizing(cell, 20);
      expect(result?.nutrients).toBe(100);
    });

    it('returns null for bunker terrain', () => {
      const cell = makeCell({ type: 'bunker' });
      expect(applyFertilizing(cell, 20)).toBeNull();
    });

    it('returns null for water terrain', () => {
      const cell = makeCell({ type: 'water' });
      expect(applyFertilizing(cell, 20)).toBeNull();
    });

    it('recalculates health after fertilizing', () => {
      const cell = makeCell({ moisture: 50, nutrients: 10, height: 30, health: 40 });
      const result = applyFertilizing(cell, 40);
      expect(result?.health).toBeGreaterThan(cell.health);
    });

    it('does not modify original cell', () => {
      const cell = makeCell({ nutrients: 30 });
      applyFertilizing(cell, 20);
      expect(cell.nutrients).toBe(30);
    });
  });
});

describe('Course Statistics', () => {
  describe('getAverageStats', () => {
    it('returns correct averages for uniform grid', () => {
      const cells: CellState[][] = [
        [makeCell({ health: 80, moisture: 60, nutrients: 70, height: 20 })],
        [makeCell({ health: 80, moisture: 60, nutrients: 70, height: 20 })]
      ];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(80);
      expect(stats.moisture).toBe(60);
      expect(stats.nutrients).toBe(70);
      expect(stats.height).toBe(20);
    });

    it('calculates correct average for varied values', () => {
      const cells: CellState[][] = [
        [makeCell({ health: 60, moisture: 40, nutrients: 50, height: 10 })],
        [makeCell({ health: 80, moisture: 60, nutrients: 70, height: 30 })]
      ];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(70);
      expect(stats.moisture).toBe(50);
      expect(stats.nutrients).toBe(60);
      expect(stats.height).toBe(20);
    });

    it('excludes bunker cells from averages', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 80, moisture: 60, nutrients: 70, height: 20 })],
        [makeCell({ type: 'bunker', health: 100, moisture: 20, nutrients: 0, height: 0 })]
      ];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(80);
      expect(stats.moisture).toBe(60);
      expect(stats.nutrients).toBe(70);
      expect(stats.height).toBe(20);
    });

    it('excludes water cells from averages', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 80 })],
        [makeCell({ type: 'water', health: 100 })]
      ];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(80);
    });

    it('returns defaults when all cells are non-grass', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'bunker' })],
        [makeCell({ type: 'water' })]
      ];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(100);
      expect(stats.moisture).toBe(100);
      expect(stats.nutrients).toBe(100);
      expect(stats.height).toBe(0);
    });

    it('handles empty grid', () => {
      const cells: CellState[][] = [];
      const stats = getAverageStats(cells);
      expect(stats.health).toBe(100);
    });
  });

  describe('countCellsNeedingMowing', () => {
    it('counts cells with height > 60', () => {
      const cells: CellState[][] = [
        [makeCell({ height: 70 }), makeCell({ height: 50 })],
        [makeCell({ height: 80 }), makeCell({ height: 60 })]
      ];
      expect(countCellsNeedingMowing(cells)).toBe(2);
    });

    it('excludes bunker cells', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'bunker', height: 70 })],
        [makeCell({ type: 'fairway', height: 70 })]
      ];
      expect(countCellsNeedingMowing(cells)).toBe(1);
    });

    it('excludes water cells', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'water', height: 0 })],
        [makeCell({ type: 'fairway', height: 70 })]
      ];
      expect(countCellsNeedingMowing(cells)).toBe(1);
    });

    it('returns 0 for well-maintained course', () => {
      const cells: CellState[][] = [
        [makeCell({ height: 20 }), makeCell({ height: 30 })],
        [makeCell({ height: 40 }), makeCell({ height: 50 })]
      ];
      expect(countCellsNeedingMowing(cells)).toBe(0);
    });
  });

  describe('countCellsNeedingWater', () => {
    it('counts cells with moisture < 30', () => {
      const cells: CellState[][] = [
        [makeCell({ moisture: 20 }), makeCell({ moisture: 40 })],
        [makeCell({ moisture: 10 }), makeCell({ moisture: 30 })]
      ];
      expect(countCellsNeedingWater(cells)).toBe(2);
    });

    it('excludes bunker and water cells', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'bunker', moisture: 10 })],
        [makeCell({ type: 'water', moisture: 100 })],
        [makeCell({ type: 'fairway', moisture: 10 })]
      ];
      expect(countCellsNeedingWater(cells)).toBe(1);
    });
  });

  describe('countCellsNeedingFertilizer', () => {
    it('counts cells with nutrients < 30', () => {
      const cells: CellState[][] = [
        [makeCell({ nutrients: 20 }), makeCell({ nutrients: 40 })],
        [makeCell({ nutrients: 10 }), makeCell({ nutrients: 30 })]
      ];
      expect(countCellsNeedingFertilizer(cells)).toBe(2);
    });

    it('excludes bunker and water cells', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'bunker', nutrients: 0 })],
        [makeCell({ type: 'water', nutrients: 0 })],
        [makeCell({ type: 'fairway', nutrients: 10 })]
      ];
      expect(countCellsNeedingFertilizer(cells)).toBe(1);
    });
  });

  describe('getOverallCondition', () => {
    it('returns Excellent for health >= 80', () => {
      expect(getOverallCondition(80)).toBe('Excellent');
      expect(getOverallCondition(100)).toBe('Excellent');
    });

    it('returns Good for health >= 60', () => {
      expect(getOverallCondition(60)).toBe('Good');
      expect(getOverallCondition(79)).toBe('Good');
    });

    it('returns Fair for health >= 40', () => {
      expect(getOverallCondition(40)).toBe('Fair');
      expect(getOverallCondition(59)).toBe('Fair');
    });

    it('returns Poor for health < 40', () => {
      expect(getOverallCondition(39)).toBe('Poor');
      expect(getOverallCondition(0)).toBe('Poor');
    });
  });
});
