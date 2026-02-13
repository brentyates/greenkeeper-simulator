import { describe, it, expect } from 'vitest';
import {
  FaceState,
  createFaceState,
  simulateFaceGrowth,
  applyFaceMowing,
  applyFaceWatering,
  applyFaceFertilizing,
  calculateFaceHealth,
  isGrassFace,
  getAverageFaceStats,
  getBunkerRakeFreshness,
  BUNKER_RAKE_VISUAL_FADE_MINUTES,
} from './face-state';
import { TERRAIN_CODES } from './terrain';

function makeFace(overrides: Partial<FaceState> = {}): FaceState {
  return {
    faceId: 0,
    terrainCode: TERRAIN_CODES.FAIRWAY,
    moisture: 50,
    nutrients: 50,
    grassHeight: 50,
    health: 50,
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
    lastRaked: 0,
    ...overrides,
  };
}

describe('FaceState', () => {
  describe('createFaceState', () => {
    it('creates fairway with correct initial values', () => {
      const state = createFaceState(1, TERRAIN_CODES.FAIRWAY);
      expect(state.faceId).toBe(1);
      expect(state.terrainCode).toBe(TERRAIN_CODES.FAIRWAY);
      expect(state.moisture).toBe(60);
      expect(state.nutrients).toBe(70);
      expect(state.grassHeight).toBe(30);
      expect(state.health).toBeGreaterThan(0);
    });

    it('creates green with correct initial values', () => {
      const state = createFaceState(2, TERRAIN_CODES.GREEN);
      expect(state.moisture).toBe(70);
      expect(state.nutrients).toBe(80);
      expect(state.grassHeight).toBe(10);
    });

    it('creates bunker with correct initial values', () => {
      const state = createFaceState(3, TERRAIN_CODES.BUNKER);
      expect(state.moisture).toBe(20);
      expect(state.nutrients).toBe(0);
      expect(state.grassHeight).toBe(0);
    });

    it('creates water with correct initial values', () => {
      const state = createFaceState(4, TERRAIN_CODES.WATER);
      expect(state.moisture).toBe(100);
      expect(state.nutrients).toBe(0);
      expect(state.grassHeight).toBe(0);
    });

    it('creates tee with correct initial values', () => {
      const state = createFaceState(5, TERRAIN_CODES.TEE);
      expect(state.moisture).toBe(65);
      expect(state.nutrients).toBe(75);
      expect(state.grassHeight).toBe(15);
    });

    it('initializes timestamps to 0', () => {
      const state = createFaceState(1, TERRAIN_CODES.FAIRWAY);
      expect(state.lastMowed).toBe(0);
      expect(state.lastWatered).toBe(0);
      expect(state.lastFertilized).toBe(0);
      expect(state.lastRaked).toBe(0);
    });
  });

  describe('isGrassFace', () => {
    it('returns true for grass terrain codes', () => {
      expect(isGrassFace(TERRAIN_CODES.FAIRWAY)).toBe(true);
      expect(isGrassFace(TERRAIN_CODES.ROUGH)).toBe(true);
      expect(isGrassFace(TERRAIN_CODES.GREEN)).toBe(true);
      expect(isGrassFace(TERRAIN_CODES.TEE)).toBe(true);
    });

    it('returns false for non-grass terrain codes', () => {
      expect(isGrassFace(TERRAIN_CODES.BUNKER)).toBe(false);
      expect(isGrassFace(TERRAIN_CODES.WATER)).toBe(false);
    });
  });

  describe('getBunkerRakeFreshness', () => {
    it('returns 0 when never raked', () => {
      expect(getBunkerRakeFreshness(0, 1000)).toBe(0);
    });

    it('returns 1 immediately after raking', () => {
      expect(getBunkerRakeFreshness(1000, 1000)).toBe(1);
    });

    it('fades linearly over configured time', () => {
      const half = BUNKER_RAKE_VISUAL_FADE_MINUTES / 2;
      expect(getBunkerRakeFreshness(1000, 1000 + half)).toBeCloseTo(0.5, 2);
    });

    it('returns 0 after fade window', () => {
      expect(getBunkerRakeFreshness(1000, 1000 + BUNKER_RAKE_VISUAL_FADE_MINUTES + 1)).toBe(0);
    });
  });

  describe('calculateFaceHealth', () => {
    it('returns 100 for non-grass faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.WATER });
      expect(calculateFaceHealth(state)).toBe(100);
    });

    it('returns 100 for non-grass bunker faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.BUNKER });
      expect(calculateFaceHealth(state)).toBe(100);
    });

    it('calculates health for grass faces based on moisture, nutrients, height', () => {
      const state = makeFace({
        terrainCode: TERRAIN_CODES.FAIRWAY,
        moisture: 100,
        nutrients: 100,
        grassHeight: 0,
      });
      expect(calculateFaceHealth(state)).toBe(100);
    });

    it('low moisture/nutrients reduce health', () => {
      const state = makeFace({
        terrainCode: TERRAIN_CODES.FAIRWAY,
        moisture: 0,
        nutrients: 0,
        grassHeight: 100,
      });
      expect(calculateFaceHealth(state)).toBe(0);
    });
  });

  describe('simulateFaceGrowth', () => {
    it('does not change bunker faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.BUNKER, grassHeight: 0, moisture: 20, nutrients: 0 });
      const result = simulateFaceGrowth(state, 60);
      expect(result.grassHeight).toBe(0);
      expect(result.moisture).toBe(20);
      expect(result.nutrients).toBe(0);
    });

    it('does not change water faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.WATER, grassHeight: 0, moisture: 100, nutrients: 0 });
      const result = simulateFaceGrowth(state, 60);
      expect(result.grassHeight).toBe(0);
      expect(result.moisture).toBe(100);
      expect(result.nutrients).toBe(0);
    });

    it('increases grass height over time', () => {
      const state = makeFace({ grassHeight: 30, moisture: 60, nutrients: 70 });
      const result = simulateFaceGrowth(state, 60);
      expect(result.grassHeight).toBeGreaterThan(30);
    });

    it('decreases moisture over time', () => {
      const state = makeFace({ moisture: 60 });
      const result = simulateFaceGrowth(state, 60);
      expect(result.moisture).toBeLessThan(60);
    });

    it('decreases nutrients over time', () => {
      const state = makeFace({ nutrients: 70 });
      const result = simulateFaceGrowth(state, 60);
      expect(result.nutrients).toBeLessThan(70);
    });

    it('caps grass height at 100', () => {
      const state = makeFace({ grassHeight: 99 });
      const result = simulateFaceGrowth(state, 1000);
      expect(result.grassHeight).toBe(100);
    });

    it('caps moisture at 0 minimum', () => {
      const state = makeFace({ moisture: 1 });
      const result = simulateFaceGrowth(state, 10000);
      expect(result.moisture).toBe(0);
    });

    it('grows faster with high moisture and nutrients', () => {
      const lowState = makeFace({ grassHeight: 30, moisture: 20, nutrients: 20 });
      const highState = makeFace({ grassHeight: 30, moisture: 80, nutrients: 80 });
      const lowResult = simulateFaceGrowth(lowState, 60);
      const highResult = simulateFaceGrowth(highState, 60);
      expect(highResult.grassHeight).toBeGreaterThan(lowResult.grassHeight);
    });

    it('rainy weather increases moisture', () => {
      const state = makeFace({ moisture: 50 });
      const result = simulateFaceGrowth(state, 60, { type: 'rainy', temperature: 70 });
      const dryResult = simulateFaceGrowth(state, 60);
      expect(result.moisture).toBeGreaterThan(dryResult.moisture);
    });

    it('hot sunny weather increases moisture loss', () => {
      const state = makeFace({ moisture: 50 });
      const hotResult = simulateFaceGrowth(state, 60, { type: 'sunny', temperature: 95 });
      const normalResult = simulateFaceGrowth(state, 60);
      expect(hotResult.moisture).toBeLessThan(normalResult.moisture);
    });
  });

  describe('applyFaceMowing', () => {
    it('sets grass height to 0 on grass face', () => {
      const state = makeFace({ grassHeight: 80 });
      const result = applyFaceMowing(state);
      expect(result).toBe(true);
      expect(state.grassHeight).toBe(0);
    });

    it('recalculates health after mowing', () => {
      const state = makeFace({ grassHeight: 80 });
      const healthBefore = state.health;
      applyFaceMowing(state);
      expect(state.health).not.toBe(healthBefore);
    });

    it('returns false for non-grass faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.WATER });
      expect(applyFaceMowing(state)).toBe(false);
    });

    it('returns false for bunker faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.BUNKER });
      expect(applyFaceMowing(state)).toBe(false);
    });
  });

  describe('applyFaceWatering', () => {
    it('increases moisture on grass face', () => {
      const state = makeFace({ moisture: 30 });
      const result = applyFaceWatering(state, 20);
      expect(result).toBe(true);
      expect(state.moisture).toBe(50);
    });

    it('caps moisture at 100', () => {
      const state = makeFace({ moisture: 90 });
      applyFaceWatering(state, 20);
      expect(state.moisture).toBe(100);
    });

    it('allows watering bunker at half effectiveness', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.BUNKER, moisture: 20 });
      const result = applyFaceWatering(state, 20);
      expect(result).toBe(true);
      expect(state.moisture).toBe(30);
    });

    it('returns false for water terrain', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.WATER });
      expect(applyFaceWatering(state, 20)).toBe(false);
    });
  });

  describe('applyFaceFertilizing', () => {
    it('increases nutrients on grass face', () => {
      const state = makeFace({ nutrients: 30 });
      const result = applyFaceFertilizing(state, 20);
      expect(result).toBe(true);
      expect(state.nutrients).toBe(50);
    });

    it('caps nutrients at 100', () => {
      const state = makeFace({ nutrients: 90 });
      applyFaceFertilizing(state, 20);
      expect(state.nutrients).toBe(100);
    });

    it('applies effectiveness multiplier', () => {
      const state = makeFace({ nutrients: 30 });
      applyFaceFertilizing(state, 20, 0.5);
      expect(state.nutrients).toBe(40);
    });

    it('returns false for non-grass faces', () => {
      const state = makeFace({ terrainCode: TERRAIN_CODES.BUNKER });
      expect(applyFaceFertilizing(state, 20)).toBe(false);
    });
  });

  describe('getAverageFaceStats', () => {
    it('returns averages across grass faces', () => {
      const states = new Map<number, FaceState>();
      states.set(0, makeFace({ faceId: 0, moisture: 60, nutrients: 80, grassHeight: 20, health: 70 }));
      states.set(1, makeFace({ faceId: 1, moisture: 40, nutrients: 60, grassHeight: 40, health: 50 }));

      const result = getAverageFaceStats(states);
      expect(result.moisture).toBe(50);
      expect(result.nutrients).toBe(70);
      expect(result.height).toBe(30);
      expect(result.health).toBe(60);
    });

    it('excludes water and bunker faces', () => {
      const states = new Map<number, FaceState>();
      states.set(0, makeFace({ faceId: 0, moisture: 60, nutrients: 80, grassHeight: 20, health: 70 }));
      states.set(1, makeFace({ faceId: 1, terrainCode: TERRAIN_CODES.WATER, moisture: 100, nutrients: 0 }));
      states.set(2, makeFace({ faceId: 2, terrainCode: TERRAIN_CODES.BUNKER, moisture: 20, nutrients: 0 }));

      const result = getAverageFaceStats(states);
      expect(result.moisture).toBe(60);
      expect(result.nutrients).toBe(80);
      expect(result.height).toBe(20);
      expect(result.health).toBe(70);
    });

    it('returns defaults for empty map', () => {
      const states = new Map<number, FaceState>();
      const result = getAverageFaceStats(states);
      expect(result.health).toBe(100);
      expect(result.moisture).toBe(100);
      expect(result.nutrients).toBe(100);
      expect(result.height).toBe(0);
    });

    it('returns defaults when only non-grass faces exist', () => {
      const states = new Map<number, FaceState>();
      states.set(0, makeFace({ terrainCode: TERRAIN_CODES.WATER }));
      states.set(1, makeFace({ terrainCode: TERRAIN_CODES.BUNKER }));

      const result = getAverageFaceStats(states);
      expect(result.health).toBe(100);
      expect(result.moisture).toBe(100);
      expect(result.nutrients).toBe(100);
      expect(result.height).toBe(0);
    });
  });
});
