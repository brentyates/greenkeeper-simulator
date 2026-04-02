import { describe, it, expect } from 'vitest';
import type { Direction } from './movement';

describe('Direction type', () => {
  it('accepts valid direction values', () => {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    expect(directions).toHaveLength(4);
  });
});
