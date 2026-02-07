import { describe, it, expect } from 'vitest';
import {
  getOverallCondition,
  getWeatherMoistureEffect,
} from './grass-simulation';

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
