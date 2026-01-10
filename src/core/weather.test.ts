import { describe, it, expect, vi } from 'vitest';
import {
  WeatherState,
  createInitialWeatherState,
  getSeasonFromDay,
  generateWeatherCondition,
  generateForecast,
  tickWeather,
  getWeatherDescription,
  getWeatherImpactDescription,
  shouldReduceGolferArrivals,
  getArrivalMultiplierFromWeather,
} from './weather';

describe('weather', () => {
  describe('getSeasonFromDay', () => {
    it('returns spring for days 0-89', () => {
      expect(getSeasonFromDay(0).season).toBe('spring');
      expect(getSeasonFromDay(45).season).toBe('spring');
      expect(getSeasonFromDay(89).season).toBe('spring');
    });

    it('returns summer for days 90-179', () => {
      expect(getSeasonFromDay(90).season).toBe('summer');
      expect(getSeasonFromDay(135).season).toBe('summer');
      expect(getSeasonFromDay(179).season).toBe('summer');
    });

    it('returns fall for days 180-269', () => {
      expect(getSeasonFromDay(180).season).toBe('fall');
      expect(getSeasonFromDay(225).season).toBe('fall');
      expect(getSeasonFromDay(269).season).toBe('fall');
    });

    it('returns winter for days 270-364', () => {
      expect(getSeasonFromDay(270).season).toBe('winter');
      expect(getSeasonFromDay(300).season).toBe('winter');
      expect(getSeasonFromDay(364).season).toBe('winter');
    });

    it('wraps around for days beyond 365', () => {
      expect(getSeasonFromDay(365).season).toBe('spring');
      expect(getSeasonFromDay(455).season).toBe('summer');
    });
  });

  describe('createInitialWeatherState', () => {
    it('creates state with current weather', () => {
      const state = createInitialWeatherState();
      expect(state.current).toBeDefined();
      expect(state.current.type).toMatch(/sunny|cloudy|rainy|stormy/);
      expect(state.current.temperature).toBeGreaterThan(0);
      expect(state.current.windSpeed).toBeGreaterThanOrEqual(0);
    });

    it('creates state with forecast', () => {
      const state = createInitialWeatherState();
      expect(state.forecast).toHaveLength(3);
      state.forecast.forEach((f, i) => {
        expect(f.dayOffset).toBe(i + 1);
        expect(f.predictedType).toMatch(/sunny|cloudy|rainy|stormy/);
        expect(f.confidence).toBeGreaterThan(0);
        expect(f.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('uses seasonal modifier based on game day', () => {
      const summerState = createInitialWeatherState(100);
      expect(summerState.seasonalModifier.season).toBe('summer');

      const winterState = createInitialWeatherState(300);
      expect(winterState.seasonalModifier.season).toBe('winter');
    });

    it('initializes lastChangeTime to 0', () => {
      const state = createInitialWeatherState();
      expect(state.lastChangeTime).toBe(0);
    });
  });

  describe('generateWeatherCondition', () => {
    it('generates sunny weather for high random values', () => {
      const seasonal = getSeasonFromDay(100);
      const weather = generateWeatherCondition(seasonal, 0.99);
      expect(weather.type).toBe('sunny');
    });

    it('generates stormy weather for low random values', () => {
      const seasonal = getSeasonFromDay(100);
      const weather = generateWeatherCondition(seasonal, 0.01);
      expect(weather.type).toBe('stormy');
    });

    it('generates temperature within seasonal range', () => {
      const seasonal = getSeasonFromDay(100);
      for (let i = 0; i < 20; i++) {
        const weather = generateWeatherCondition(seasonal, Math.random());
        expect(weather.temperature).toBeGreaterThanOrEqual(
          seasonal.baseTemperature - seasonal.temperatureVariance - 1
        );
        expect(weather.temperature).toBeLessThanOrEqual(
          seasonal.baseTemperature + seasonal.temperatureVariance + 1
        );
      }
    });

    it('generates higher wind for stormy weather', () => {
      const seasonal = getSeasonFromDay(100);
      const stormyWeather = generateWeatherCondition(seasonal, 0.01);
      expect(stormyWeather.windSpeed).toBeGreaterThanOrEqual(20);
    });
  });

  describe('generateForecast', () => {
    it('generates correct number of forecast days', () => {
      const seasonal = getSeasonFromDay(100);
      const forecast = generateForecast(seasonal, 5);
      expect(forecast).toHaveLength(5);
    });

    it('assigns correct day offsets', () => {
      const seasonal = getSeasonFromDay(100);
      const forecast = generateForecast(seasonal, 3);
      expect(forecast[0].dayOffset).toBe(1);
      expect(forecast[1].dayOffset).toBe(2);
      expect(forecast[2].dayOffset).toBe(3);
    });

    it('decreases confidence for further days', () => {
      const seasonal = getSeasonFromDay(100);
      const forecast = generateForecast(seasonal, 3);
      expect(forecast[0].confidence).toBeGreaterThan(forecast[1].confidence);
      expect(forecast[1].confidence).toBeGreaterThan(forecast[2].confidence);
    });

    it('keeps confidence above minimum threshold', () => {
      const seasonal = getSeasonFromDay(100);
      const forecast = generateForecast(seasonal, 10);
      forecast.forEach((f) => {
        expect(f.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('tickWeather', () => {
    it('returns unchanged state when not enough time has passed', () => {
      const state = createInitialWeatherState();
      const result = tickWeather(state, 60, 1);
      expect(result.changed).toBe(false);
      expect(result.previousType).toBeNull();
    });

    it('returns unchanged state when temp drift rounds to zero', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'sunny', temperature: 75, windSpeed: 5 },
        lastChangeTime: 180,
      };
      const result = tickWeather(state, 240, 1, false);
      expect(result.changed).toBe(false);
      expect(result.state.current.temperature).toBe(75);
      vi.restoreAllMocks();
    });

    it('can force weather change', () => {
      const state = createInitialWeatherState();
      const result = tickWeather(state, 0, 1, true);
      expect(result.changed).toBe(true);
      expect(result.previousType).toBe(state.current.type);
    });

    it('may naturally change weather after enough hours', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'sunny', temperature: 75, windSpeed: 5 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 300, 1, false);
      expect(result.changed).toBe(true);
      vi.restoreAllMocks();
    });

    it('updates lastChangeTime when weather changes', () => {
      const state = createInitialWeatherState();
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.lastChangeTime).toBe(500);
    });

    it('may drift temperature slightly without full change', () => {
      const state: WeatherState = {
        ...createInitialWeatherState(),
        lastChangeTime: 0,
        current: { type: 'sunny', temperature: 75, windSpeed: 5 },
      };

      let tempChanged = false;
      for (let i = 0; i < 50; i++) {
        const result = tickWeather(state, 60, 1);
        if (result.state.current.temperature !== 75) {
          tempChanged = true;
          break;
        }
      }
      expect(tempChanged).toBe(true);
    });

    it('updates seasonal modifier based on game day', () => {
      const springState = createInitialWeatherState(50);
      const result = tickWeather(springState, 500, 150, true);
      expect(result.state.seasonalModifier.season).toBe('summer');
    });

    it('generates new forecast on weather change', () => {
      const state = createInitialWeatherState();
      const originalForecast = state.forecast;
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.forecast).not.toBe(originalForecast);
    });
  });

  describe('weather transitions', () => {
    it('sunny tends to transition to cloudy', () => {
      let cloudyCount = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const state: WeatherState = {
          ...createInitialWeatherState(),
          current: { type: 'sunny', temperature: 75, windSpeed: 5 },
          lastChangeTime: 0,
        };
        const result = tickWeather(state, 500, 1, true);
        if (result.state.current.type === 'cloudy') cloudyCount++;
      }

      expect(cloudyCount).toBeGreaterThan(trials * 0.3);
    });

    it('stormy tends to transition to rainy or cloudy', () => {
      let rainOrCloudCount = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const state: WeatherState = {
          ...createInitialWeatherState(),
          current: { type: 'stormy', temperature: 65, windSpeed: 25 },
          lastChangeTime: 0,
        };
        const result = tickWeather(state, 500, 1, true);
        if (result.state.current.type === 'rainy' || result.state.current.type === 'cloudy') {
          rainOrCloudCount++;
        }
      }

      expect(rainOrCloudCount).toBeGreaterThan(trials * 0.6);
    });

    it('rainy can transition to stormy with high random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'rainy', temperature: 65, windSpeed: 15 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('stormy');
      vi.restoreAllMocks();
    });

    it('rainy can transition to sunny', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.7);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'rainy', temperature: 65, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('sunny');
      vi.restoreAllMocks();
    });

    it('cloudy can transition to rainy', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.75);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'cloudy', temperature: 65, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('rainy');
      vi.restoreAllMocks();
    });

    it('cloudy can transition to stormy', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.95);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'cloudy', temperature: 65, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('stormy');
      vi.restoreAllMocks();
    });

    it('cloudy can stay cloudy', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'cloudy', temperature: 65, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('cloudy');
      vi.restoreAllMocks();
    });

    it('cloudy can transition to sunny', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'cloudy', temperature: 70, windSpeed: 5 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('sunny');
      vi.restoreAllMocks();
    });

    it('rainy can transition to cloudy', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.15);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'rainy', temperature: 60, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('cloudy');
      vi.restoreAllMocks();
    });

    it('rainy can stay rainy', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.45);
      const state: WeatherState = {
        ...createInitialWeatherState(),
        current: { type: 'rainy', temperature: 60, windSpeed: 10 },
        lastChangeTime: 0,
      };
      const result = tickWeather(state, 500, 1, true);
      expect(result.state.current.type).toBe('rainy');
      vi.restoreAllMocks();
    });
  });

  describe('getWeatherDescription', () => {
    it('describes hot sunny weather', () => {
      const desc = getWeatherDescription({ type: 'sunny', temperature: 95, windSpeed: 5 });
      expect(desc).toContain('Sunny');
      expect(desc).toContain('Hot');
    });

    it('describes pleasant cloudy weather', () => {
      const desc = getWeatherDescription({ type: 'cloudy', temperature: 70, windSpeed: 8 });
      expect(desc).toContain('Cloudy');
      expect(desc).toContain('Pleasant');
    });

    it('includes wind description for windy conditions', () => {
      const desc = getWeatherDescription({ type: 'sunny', temperature: 75, windSpeed: 25 });
      expect(desc).toContain('Windy');
    });

    it('includes breezy for moderate wind', () => {
      const desc = getWeatherDescription({ type: 'sunny', temperature: 75, windSpeed: 15 });
      expect(desc).toContain('Breezy');
    });

    it('describes cold rainy weather', () => {
      const desc = getWeatherDescription({ type: 'rainy', temperature: 45, windSpeed: 10 });
      expect(desc).toContain('Rainy');
      expect(desc).toContain('Cold');
    });

    it('describes warm weather', () => {
      const desc = getWeatherDescription({ type: 'sunny', temperature: 85, windSpeed: 5 });
      expect(desc).toContain('Warm');
    });

    it('describes cool weather', () => {
      const desc = getWeatherDescription({ type: 'cloudy', temperature: 55, windSpeed: 5 });
      expect(desc).toContain('Cool');
    });
  });

  describe('getWeatherImpactDescription', () => {
    it('describes rain impact on course', () => {
      const desc = getWeatherImpactDescription({ type: 'rainy', temperature: 65, windSpeed: 10 });
      expect(desc).toContain('Rain');
      expect(desc).toContain('watering');
    });

    it('describes storm impact', () => {
      const desc = getWeatherImpactDescription({ type: 'stormy', temperature: 60, windSpeed: 30 });
      expect(desc).toContain('Storm');
      expect(desc).toContain('moisture');
    });

    it('warns about hot weather', () => {
      const desc = getWeatherImpactDescription({ type: 'sunny', temperature: 95, windSpeed: 5 });
      expect(desc).toContain('Hot');
      expect(desc).toContain('drying');
    });

    it('describes perfect conditions for moderate sunny weather', () => {
      const desc = getWeatherImpactDescription({ type: 'sunny', temperature: 72, windSpeed: 5 });
      expect(desc).toContain('Perfect');
    });

    it('describes cloudy weather impact', () => {
      const desc = getWeatherImpactDescription({ type: 'cloudy', temperature: 65, windSpeed: 8 });
      expect(desc).toContain('Overcast');
      expect(desc).toContain('moisture');
    });

    it('describes warm sunny weather impact', () => {
      const desc = getWeatherImpactDescription({ type: 'sunny', temperature: 85, windSpeed: 5 });
      expect(desc).toContain('Warm');
      expect(desc).toContain('sunny');
    });
  });

  describe('shouldReduceGolferArrivals', () => {
    it('returns true for stormy weather', () => {
      expect(shouldReduceGolferArrivals({ type: 'stormy', temperature: 60, windSpeed: 30 })).toBe(true);
    });

    it('returns true for rainy weather', () => {
      expect(shouldReduceGolferArrivals({ type: 'rainy', temperature: 65, windSpeed: 10 })).toBe(true);
    });

    it('returns false for cloudy weather', () => {
      expect(shouldReduceGolferArrivals({ type: 'cloudy', temperature: 70, windSpeed: 8 })).toBe(false);
    });

    it('returns false for sunny weather', () => {
      expect(shouldReduceGolferArrivals({ type: 'sunny', temperature: 75, windSpeed: 5 })).toBe(false);
    });
  });

  describe('getArrivalMultiplierFromWeather', () => {
    it('returns 0.1 for stormy weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'stormy', temperature: 60, windSpeed: 30 })).toBe(0.1);
    });

    it('returns 0.4 for rainy weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'rainy', temperature: 65, windSpeed: 10 })).toBe(0.4);
    });

    it('returns 0.9 for cloudy weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'cloudy', temperature: 70, windSpeed: 8 })).toBe(0.9);
    });

    it('returns 1.0 for pleasant sunny weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'sunny', temperature: 75, windSpeed: 5 })).toBe(1.0);
    });

    it('returns 0.6 for extreme heat', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'sunny', temperature: 100, windSpeed: 5 })).toBe(0.6);
    });

    it('returns 0.8 for hot weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'sunny', temperature: 92, windSpeed: 5 })).toBe(0.8);
    });

    it('returns 0.7 for cold weather', () => {
      expect(getArrivalMultiplierFromWeather({ type: 'sunny', temperature: 45, windSpeed: 5 })).toBe(0.7);
    });
  });
});
