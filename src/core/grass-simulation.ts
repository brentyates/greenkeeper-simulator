export interface WeatherEffect {
  readonly type: "sunny" | "cloudy" | "rainy" | "stormy";
  readonly temperature: number;
}

export function getWeatherMoistureEffect(weather?: WeatherEffect): { gainRate: number; lossMultiplier: number } {
  if (!weather) {
    return { gainRate: 0, lossMultiplier: 1.0 };
  }

  let gainRate = 0;
  let lossMultiplier = 1.0;

  switch (weather.type) {
    case "rainy":
      gainRate = 0.15;
      lossMultiplier = 0.3;
      break;
    case "stormy":
      gainRate = 0.25;
      lossMultiplier = 0.2;
      break;
    case "cloudy":
      lossMultiplier = 0.7;
      break;
    case "sunny":
      if (weather.temperature > 90) {
        lossMultiplier = 1.8;
      } else if (weather.temperature > 80) {
        lossMultiplier = 1.3;
      }
      break;
  }

  return { gainRate, lossMultiplier };
}

export function getOverallCondition(averageHealth: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (averageHealth >= 80) return 'Excellent';
  if (averageHealth >= 60) return 'Good';
  if (averageHealth >= 40) return 'Fair';
  return 'Poor';
}
