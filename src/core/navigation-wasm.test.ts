import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findPath as findPathJS } from './navigation';
import { findPathWasm } from './navigation-wasm';

vi.mock('./navigation-backend', () => {
  const mockFindPath = vi.fn();
  return {
    isWasmAvailable: vi.fn(() => false),
    getWasmModule: vi.fn(() => null),
    initWasmPathfinding: vi.fn(async () => false),
    __mockFindPath: mockFindPath,
  };
});

describe('findPathWasm', () => {
  const alwaysTraversable = () => true;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to JS when WASM unavailable', () => {
    const result = findPathWasm({}, 0, 0, 5, 0, alwaysTraversable);
    const jsResult = findPathJS({}, 0, 0, 5, 0, alwaysTraversable);
    expect(result).toEqual(jsResult);
  });

  it('returns single point when start equals goal', () => {
    const result = findPathWasm({}, 3, 3, 3, 3, alwaysTraversable);
    expect(result).toEqual([{ x: 3, z: 3 }]);
  });

  it('finds path in open field (JS fallback)', () => {
    const result = findPathWasm({}, 0, 0, 5, 5, alwaysTraversable);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(result![result!.length - 1]).toEqual({ x: 5, z: 5 });
  });

  it('returns null when fully blocked (JS fallback)', () => {
    const blocked = (_e: unknown, _x: number, _z: number) => false;
    const result = findPathWasm({}, 0, 0, 5, 5, blocked);
    expect(result).toBeNull();
  });

  it('routes around wall (JS fallback)', () => {
    const wall = (_e: unknown, x: number, z: number) => {
      if (Math.round(x) === 5 && Math.round(z) !== 5) return false;
      return true;
    };
    const result = findPathWasm({}, 0, 5, 9, 5, wall);
    expect(result).not.toBeNull();
    expect(result![result!.length - 1]).toEqual({ x: 9, z: 5 });
  });

  it('respects gridStep parameter', () => {
    const result = findPathWasm({}, 0, 0, 10, 0, alwaysTraversable, 2);
    expect(result).not.toBeNull();
    expect(result![result!.length - 1]).toEqual({ x: 10, z: 0 });
  });

  describe('parity with JS findPath', () => {
    const scenarios = [
      { name: 'straight line', sx: 0, sz: 0, gx: 8, gz: 0 },
      { name: 'diagonal', sx: 0, sz: 0, gx: 5, gz: 5 },
      { name: 'same start/goal', sx: 3, sz: 3, gx: 3, gz: 3 },
    ];

    for (const { name, sx, sz, gx, gz } of scenarios) {
      it(`produces same result as JS for ${name}`, () => {
        const wasmResult = findPathWasm({}, sx, sz, gx, gz, alwaysTraversable);
        const jsResult = findPathJS({}, sx, sz, gx, gz, alwaysTraversable);
        expect(wasmResult).toEqual(jsResult);
      });
    }
  });
});
