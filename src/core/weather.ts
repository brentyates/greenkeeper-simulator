import { WeatherCondition } from './golfers';

export interface WeatherState {
  readonly current: WeatherCondition;
  readonly forecast: WeatherForecast[];
  readonly lastChangeTime: number;
  readonly seasonalModifier: SeasonalModifier;
}

export interface WeatherForecast {
  readonly dayOffset: number;
  readonly predictedType: WeatherCondition['type'];
  readonly confidence: number;
}

export interface SeasonalModifier {
  readonly season: 'spring' | 'summer' | 'fall' | 'winter';
  readonly baseTemperature: number;
  readonly temperatureVariance: number;
  readonly rainChance: number;
  readonly stormChance: number;
}

const SEASONAL_MODIFIERS: Record<string, SeasonalModifier> = {
  spring: { season: 'spring', baseTemperature: 65, temperatureVariance: 15, rainChance: 0.3, stormChance: 0.1 },
  summer: { season: 'summer', baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 },
  fall: { season: 'fall', baseTemperature: 60, temperatureVariance: 18, rainChance: 0.25, stormChance: 0.05 },
  winter: { season: 'winter', baseTemperature: 45, temperatureVariance: 20, rainChance: 0.2, stormChance: 0.02 },
};

export function getSeasonFromDay(gameDay: number): SeasonalModifier {
  const dayOfYear = gameDay % 365;
  if (dayOfYear < 90) return SEASONAL_MODIFIERS.spring;
  if (dayOfYear < 180) return SEASONAL_MODIFIERS.summer;
  if (dayOfYear < 270) return SEASONAL_MODIFIERS.fall;
  return SEASONAL_MODIFIERS.winter;
}

export function createInitialWeatherState(gameDay: number = 1): WeatherState {
  const seasonalModifier = getSeasonFromDay(gameDay);
  const current = generateWeatherCondition(seasonalModifier, Math.random());

  return {
    current,
    forecast: generateForecast(seasonalModifier, 3),
    lastChangeTime: 0,
    seasonalModifier,
  };
}

export function generateWeatherCondition(
  seasonal: SeasonalModifier,
  random: number
): WeatherCondition {
  let type: WeatherCondition['type'];

  if (random < seasonal.stormChance) {
    type = 'stormy';
  } else if (random < seasonal.stormChance + seasonal.rainChance) {
    type = 'rainy';
  } else if (random < seasonal.stormChance + seasonal.rainChance + 0.25) {
    type = 'cloudy';
  } else {
    type = 'sunny';
  }

  const tempVariation = (Math.random() - 0.5) * 2 * seasonal.temperatureVariance;
  const temperature = Math.round(seasonal.baseTemperature + tempVariation);

  const baseWind = type === 'stormy' ? 20 : type === 'rainy' ? 10 : 5;
  const windSpeed = Math.round(baseWind + Math.random() * 10);

  return { type, temperature, windSpeed };
}

export function generateForecast(seasonal: SeasonalModifier, days: number): WeatherForecast[] {
  const forecasts: WeatherForecast[] = [];

  for (let i = 1; i <= days; i++) {
    const random = Math.random();
    let predictedType: WeatherCondition['type'];

    if (random < seasonal.stormChance) {
      predictedType = 'stormy';
    } else if (random < seasonal.stormChance + seasonal.rainChance) {
      predictedType = 'rainy';
    } else if (random < seasonal.stormChance + seasonal.rainChance + 0.25) {
      predictedType = 'cloudy';
    } else {
      predictedType = 'sunny';
    }

    const confidence = Math.max(0.5, 0.9 - i * 0.15);

    forecasts.push({
      dayOffset: i,
      predictedType,
      confidence,
    });
  }

  return forecasts;
}

export interface WeatherChangeResult {
  state: WeatherState;
  changed: boolean;
  previousType: WeatherCondition['type'] | null;
}

export function tickWeather(
  state: WeatherState,
  gameTime: number,
  gameDay: number,
  forceChange: boolean = false
): WeatherChangeResult {
  const hoursSinceChange = (gameTime - state.lastChangeTime) / 60;
  const minHoursBetweenChanges = 3;
  const maxHoursBetweenChanges = 8;

  let shouldChange = forceChange;

  if (!shouldChange && hoursSinceChange >= minHoursBetweenChanges) {
    const changeChance = (hoursSinceChange - minHoursBetweenChanges) /
                         (maxHoursBetweenChanges - minHoursBetweenChanges);
    shouldChange = Math.random() < Math.min(changeChance, 0.3);
  }

  if (!shouldChange) {
    const tempDrift = (Math.random() - 0.5) * 2;
    const newTemp = Math.round(state.current.temperature + tempDrift);
    const clampedTemp = Math.max(20, Math.min(110, newTemp));

    if (clampedTemp !== state.current.temperature) {
      return {
        state: {
          ...state,
          current: { ...state.current, temperature: clampedTemp },
        },
        changed: false,
        previousType: null,
      };
    }

    return { state, changed: false, previousType: null };
  }

  const previousType = state.current.type;
  const seasonalModifier = getSeasonFromDay(gameDay);
  const transitionRandom = Math.random();

  let newType: WeatherCondition['type'];

  switch (state.current.type) {
    case 'sunny':
      if (transitionRandom < 0.6) newType = 'cloudy';
      else if (transitionRandom < 0.85) newType = 'sunny';
      else newType = 'rainy';
      break;
    case 'cloudy':
      if (transitionRandom < 0.35) newType = 'sunny';
      else if (transitionRandom < 0.65) newType = 'cloudy';
      else if (transitionRandom < 0.9) newType = 'rainy';
      else newType = 'stormy';
      break;
    case 'rainy':
      if (transitionRandom < 0.3) newType = 'cloudy';
      else if (transitionRandom < 0.6) newType = 'rainy';
      else if (transitionRandom < 0.85) newType = 'sunny';
      else newType = 'stormy';
      break;
    case 'stormy':
      if (transitionRandom < 0.5) newType = 'rainy';
      else if (transitionRandom < 0.8) newType = 'cloudy';
      else newType = 'stormy';
      break;
    default:
      newType = 'sunny';
  }

  const newCondition = generateWeatherCondition(
    { ...seasonalModifier },
    newType === 'stormy' ? 0 : newType === 'rainy' ? 0.1 : newType === 'cloudy' ? 0.4 : 0.7
  );

  const newForecast = generateForecast(seasonalModifier, 3);

  return {
    state: {
      current: { ...newCondition, type: newType },
      forecast: newForecast,
      lastChangeTime: gameTime,
      seasonalModifier,
    },
    changed: true,
    previousType,
  };
}

export function getWeatherDescription(weather: WeatherCondition): string {
  const tempDesc = weather.temperature > 90 ? 'Hot' :
                   weather.temperature > 80 ? 'Warm' :
                   weather.temperature > 65 ? 'Pleasant' :
                   weather.temperature > 50 ? 'Cool' : 'Cold';

  const windDesc = weather.windSpeed > 20 ? 'Windy' :
                   weather.windSpeed > 12 ? 'Breezy' : '';

  const typeDesc = weather.type.charAt(0).toUpperCase() + weather.type.slice(1);

  if (windDesc) {
    return `${typeDesc}, ${tempDesc}, ${windDesc}`;
  }
  return `${typeDesc}, ${tempDesc}`;
}

export function getWeatherImpactDescription(weather: WeatherCondition): string {
  switch (weather.type) {
    case 'rainy':
      return 'Rain is watering the course naturally. Fewer golfers expected.';
    case 'stormy':
      return 'Storm conditions! Course moisture high, very few golfers.';
    case 'cloudy':
      return 'Overcast skies reduce moisture loss.';
    case 'sunny':
      if (weather.temperature > 90) {
        return 'Hot weather! Grass drying quickly, watch moisture levels.';
      } else if (weather.temperature > 80) {
        return 'Warm and sunny. Good golf weather, moderate moisture loss.';
      }
      return 'Perfect conditions for golf!';
    default:
      return '';
  }
}

export function shouldReduceGolferArrivals(weather: WeatherCondition): boolean {
  return weather.type === 'stormy' || weather.type === 'rainy';
}

export function getArrivalMultiplierFromWeather(weather: WeatherCondition): number {
  switch (weather.type) {
    case 'stormy':
      return 0.1;
    case 'rainy':
      return 0.4;
    case 'cloudy':
      return 0.9;
    case 'sunny':
      if (weather.temperature > 95) return 0.6;
      if (weather.temperature > 90) return 0.8;
      if (weather.temperature < 50) return 0.7;
      return 1.0;
    default:
      return 1.0;
  }
}
