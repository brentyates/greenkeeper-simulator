import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculate3DDistance,
  gridToYards,
  getYardageToPin,
  getYardagesToGreen,
  getActiveTeeBox,
  calculateClubDistance,
  isOnGreen,
  getApproachAngle,
  getDirection,
  getCompassDirection,
  calculateParFromYardage,
  validateHoleData,
  type PinPosition,
  type TeeBox,
  type GreenInfo,
  type HoleData,
} from './golf-logic';

describe('golf-logic', () => {
  describe('calculateDistance', () => {
    it('calculates horizontal distance correctly', () => {
      expect(calculateDistance(0, 0, 3, 4)).toBe(5);
      expect(calculateDistance(0, 0, 0, 0)).toBe(0);
      expect(calculateDistance(10, 10, 13, 14)).toBe(5);
    });

    it('handles negative coordinates', () => {
      expect(calculateDistance(-3, -4, 0, 0)).toBe(5);
    });
  });

  describe('calculate3DDistance', () => {
    it('calculates 3D distance correctly', () => {
      expect(calculate3DDistance(0, 0, 0, 3, 4, 0)).toBe(5);
      expect(calculate3DDistance(0, 0, 0, 0, 0, 12)).toBe(12);
    });

    it('accounts for elevation changes', () => {
      const dist = calculate3DDistance(0, 0, 0, 3, 4, 12);
      expect(dist).toBe(13);
    });
  });

  describe('gridToYards', () => {
    it('converts grid distance to yards with default scale (20 yards/tile)', () => {
      expect(gridToYards(10)).toBe(200);
      expect(gridToYards(5)).toBe(100);
    });

    it('uses custom yards per grid', () => {
      expect(gridToYards(10, 2)).toBe(20);
      expect(gridToYards(5, 1)).toBe(5);
    });

    it('rounds to nearest yard', () => {
      expect(gridToYards(10.4)).toBe(208);
      expect(gridToYards(10.6)).toBe(212);
    });
  });

  describe('getYardageToPin', () => {
    it('calculates yardage to pin', () => {
      const pin: PinPosition = { x: 10, y: 10, elevation: 1 };
      const yardage = getYardageToPin(0, 0, 0, pin);
      expect(yardage).toBeGreaterThan(0);
    });

    it('accounts for elevation in distance', () => {
      const pin: PinPosition = { x: 10, y: 0, elevation: 5 };
      const flatYardage = getYardageToPin(0, 0, 0, { ...pin, elevation: 0 });
      const elevatedYardage = getYardageToPin(0, 0, 0, pin);
      expect(elevatedYardage).toBeGreaterThan(flatYardage);
    });
  });

  describe('getYardagesToGreen', () => {
    const green: GreenInfo = {
      frontEdge: { x: 10, y: 8 },
      center: { x: 10, y: 10 },
      backEdge: { x: 10, y: 12 },
    };

    it('calculates front, center, and back yardages', () => {
      const yardages = getYardagesToGreen(0, 0, 0, green, 1);
      expect(yardages.front).toBeLessThan(yardages.center);
      expect(yardages.center).toBeLessThan(yardages.back);
    });

    it('returns reasonable golf yardages', () => {
      const yardages = getYardagesToGreen(0, 0, 0, green, 0);
      expect(yardages.front).toBeGreaterThan(0);
      expect(yardages.center).toBeGreaterThan(0);
      expect(yardages.back).toBeGreaterThan(0);
    });
  });

  describe('getActiveTeeBox', () => {
    const teeBoxes: TeeBox[] = [
      { name: 'Championship', x: 0, y: 0, elevation: 0, yardage: 450, par: 4 },
      { name: 'Back', x: 1, y: 0, elevation: 0, yardage: 420, par: 4 },
      { name: 'Middle', x: 2, y: 0, elevation: 0, yardage: 380, par: 4 },
      { name: 'Forward', x: 3, y: 0, elevation: 0, yardage: 340, par: 4 },
    ];

    it('selects championship tee', () => {
      const tee = getActiveTeeBox(teeBoxes, 'championship');
      expect(tee.name).toBe('Championship');
      expect(tee.yardage).toBe(450);
    });

    it('selects back tee', () => {
      const tee = getActiveTeeBox(teeBoxes, 'back');
      expect(tee.name).toBe('Back');
      expect(tee.yardage).toBe(420);
    });

    it('selects middle tee', () => {
      const tee = getActiveTeeBox(teeBoxes, 'middle');
      expect(tee.name).toBe('Middle');
      expect(tee.yardage).toBe(380);
    });

    it('selects forward tee', () => {
      const tee = getActiveTeeBox(teeBoxes, 'forward');
      expect(tee.name).toBe('Forward');
      expect(tee.yardage).toBe(340);
    });
  });

  describe('calculateClubDistance', () => {
    it('adjusts for uphill elevation', () => {
      const adjusted = calculateClubDistance(150, 10);
      expect(adjusted).toBe(165);
    });

    it('adjusts for downhill elevation', () => {
      const adjusted = calculateClubDistance(150, -10);
      expect(adjusted).toBe(135);
    });

    it('handles flat lies', () => {
      const adjusted = calculateClubDistance(150, 0);
      expect(adjusted).toBe(150);
    });
  });

  describe('isOnGreen', () => {
    const green: GreenInfo = {
      frontEdge: { x: 100, y: 90 },
      center: { x: 100, y: 100 },
      backEdge: { x: 100, y: 110 },
    };

    it('returns true when on green', () => {
      expect(isOnGreen(100, 100, green)).toBe(true);
      expect(isOnGreen(105, 100, green)).toBe(true);
    });

    it('returns false when off green', () => {
      expect(isOnGreen(100, 120, green)).toBe(false);
      expect(isOnGreen(80, 100, green)).toBe(false);
    });

    it('uses custom tolerance', () => {
      expect(isOnGreen(120, 100, green, 19)).toBe(false);
      expect(isOnGreen(120, 100, green, 20)).toBe(true);
    });
  });

  describe('getApproachAngle', () => {
    const green: GreenInfo = {
      frontEdge: { x: 100, y: 90 },
      center: { x: 100, y: 100 },
      backEdge: { x: 100, y: 110 },
    };

    it('returns angle in degrees', () => {
      const angle = getApproachAngle(100, 50, green);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    });

    it('calculates straight-on approach', () => {
      const angle = getApproachAngle(100, 50, green);
      expect(angle).toBeLessThan(45);
    });

    it('returns 0 when from position is at green center', () => {
      const angle = getApproachAngle(100, 100, green);
      expect(angle).toBe(0);
    });

    it('returns 0 when green has zero-length orientation', () => {
      const pointGreen: GreenInfo = {
        frontEdge: { x: 100, y: 100 },
        center: { x: 100, y: 100 },
        backEdge: { x: 100, y: 100 },
      };
      const angle = getApproachAngle(50, 50, pointGreen);
      expect(angle).toBe(0);
    });
  });

  describe('getDirection', () => {
    it('calculates north direction', () => {
      const dir = getDirection(10, 10, 10, 5);
      expect(dir).toBeCloseTo(0, 0);
    });

    it('calculates east direction', () => {
      const dir = getDirection(10, 10, 15, 10);
      expect(dir).toBeCloseTo(90, 0);
    });

    it('calculates south direction', () => {
      const dir = getDirection(10, 10, 10, 15);
      expect(dir).toBeCloseTo(180, 0);
    });

    it('calculates west direction', () => {
      const dir = getDirection(10, 10, 5, 10);
      expect(dir).toBeCloseTo(270, 0);
    });

    it('calculates northwest direction', () => {
      const dir = getDirection(10, 10, 5, 5);
      expect(dir).toBeCloseTo(315, 0);
    });
  });

  describe('getCompassDirection', () => {
    it('returns correct compass directions', () => {
      expect(getCompassDirection(0)).toBe('N');
      expect(getCompassDirection(45)).toBe('NE');
      expect(getCompassDirection(90)).toBe('E');
      expect(getCompassDirection(135)).toBe('SE');
      expect(getCompassDirection(180)).toBe('S');
      expect(getCompassDirection(225)).toBe('SW');
      expect(getCompassDirection(270)).toBe('W');
      expect(getCompassDirection(315)).toBe('NW');
    });

    it('handles edge cases', () => {
      expect(getCompassDirection(360)).toBe('N');
      expect(getCompassDirection(22)).toBe('N');
      expect(getCompassDirection(23)).toBe('NE');
    });
  });

  describe('calculateParFromYardage', () => {
    it('returns par 3 for short holes', () => {
      expect(calculateParFromYardage(150)).toBe(3);
      expect(calculateParFromYardage(240)).toBe(3);
    });

    it('returns par 4 for medium holes', () => {
      expect(calculateParFromYardage(300)).toBe(4);
      expect(calculateParFromYardage(450)).toBe(4);
    });

    it('returns par 5 for long holes', () => {
      expect(calculateParFromYardage(500)).toBe(5);
      expect(calculateParFromYardage(600)).toBe(5);
    });
  });

  describe('validateHoleData', () => {
    const validHole: HoleData = {
      holeNumber: 1,
      par: 4,
      teeBoxes: [
        { name: 'Middle', x: 0, y: 0, elevation: 0, yardage: 380, par: 4 },
      ],
      pinPosition: { x: 100, y: 100, elevation: 0 },
      green: {
        frontEdge: { x: 100, y: 90 },
        center: { x: 100, y: 100 },
        backEdge: { x: 100, y: 110 },
      },
      idealPath: [
        { x: 0, y: 0, description: 'Tee' },
        { x: 100, y: 100, description: 'Green' },
      ],
    };

    it('validates correct hole data', () => {
      const result = validateHoleData(validHole);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails with no tee boxes', () => {
      const invalidHole = { ...validHole, teeBoxes: [] };
      const result = validateHoleData(invalidHole);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('fails with invalid par', () => {
      const invalidHole = { ...validHole, par: 6 };
      const result = validateHoleData(invalidHole);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Par'))).toBe(true);
    });

    it('fails when tee box par does not match hole par', () => {
      const invalidHole = {
        ...validHole,
        teeBoxes: [
          { name: 'Middle', x: 0, y: 0, elevation: 0, yardage: 380, par: 5 },
        ],
      };
      const result = validateHoleData(invalidHole);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('par'))).toBe(true);
    });

    it('fails with insufficient ideal path points', () => {
      const invalidHole = {
        ...validHole,
        idealPath: [{ x: 0, y: 0, description: 'Tee' }],
      };
      const result = validateHoleData(invalidHole);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('path'))).toBe(true);
    });
  });
});
