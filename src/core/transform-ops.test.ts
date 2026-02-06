import { describe, it, expect } from 'vitest';
import { rotateAroundPivot, degreesToRadians } from './transform-ops';

describe('transform-ops', () => {
  describe('degreesToRadians', () => {
    it('converts 0 degrees', () => {
      expect(degreesToRadians(0)).toBe(0);
    });

    it('converts 90 degrees', () => {
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
    });

    it('converts 180 degrees', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    });

    it('converts negative degrees', () => {
      expect(degreesToRadians(-45)).toBeCloseTo(-Math.PI / 4);
    });
  });

  describe('rotateAroundPivot', () => {
    const origin = { x: 0, y: 0, z: 0 };

    it('identity rotation returns original position', () => {
      const pos = { x: 1, y: 2, z: 3 };
      const result = rotateAroundPivot(pos, origin, 0, 0, 0);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(2);
      expect(result.z).toBeCloseTo(3);
    });

    it('90-degree Y rotation rotates X to Z', () => {
      const pos = { x: 1, y: 0, z: 0 };
      const result = rotateAroundPivot(pos, origin, 0, degreesToRadians(90), 0);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(-1);
    });

    it('90-degree X rotation rotates Y to Z', () => {
      const pos = { x: 0, y: 1, z: 0 };
      const result = rotateAroundPivot(pos, origin, degreesToRadians(90), 0, 0);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(1);
    });

    it('90-degree Z rotation rotates X to Y', () => {
      const pos = { x: 1, y: 0, z: 0 };
      const result = rotateAroundPivot(pos, origin, 0, 0, degreesToRadians(90));
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(0);
    });

    it('pivot offset works correctly', () => {
      const pos = { x: 2, y: 0, z: 0 };
      const pivot = { x: 1, y: 0, z: 0 };
      const result = rotateAroundPivot(pos, pivot, 0, degreesToRadians(90), 0);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(-1);
    });

    it('multiple vertices rotate consistently', () => {
      const angle = degreesToRadians(45);
      const p1 = { x: 1, y: 0, z: 0 };
      const p2 = { x: 0, y: 0, z: 1 };
      const r1 = rotateAroundPivot(p1, origin, 0, angle, 0);
      const r2 = rotateAroundPivot(p2, origin, 0, angle, 0);

      const d1 = Math.sqrt(r1.x * r1.x + r1.z * r1.z);
      const d2 = Math.sqrt(r2.x * r2.x + r2.z * r2.z);
      expect(d1).toBeCloseTo(1);
      expect(d2).toBeCloseTo(1);
    });

    it('small angle rotation for typical slope (10 degrees)', () => {
      const pos = { x: 5, y: 0, z: 0 };
      const pivot = { x: 5, y: 0, z: 5 };
      const angle = degreesToRadians(10);
      const result = rotateAroundPivot(pos, pivot, angle, 0, 0);
      expect(result.x).toBeCloseTo(5);
      expect(result.y).toBeCloseTo(5 * Math.sin(angle));
      expect(result.z).toBeCloseTo(5 - 5 * Math.cos(angle));
    });
  });
});
