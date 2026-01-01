import { describe, it, expect } from 'vitest';
import {
  createEquipmentState,
  activateEquipment,
  deactivateEquipment,
  refillEquipment,
  getResourcePercent,
  consumeResource,
  canActivate,
  isEmpty,
  getIsoOffset,
  getDepthOffset,
  EQUIPMENT_CONFIGS,
  EquipmentState
} from './equipment-logic';

describe('Equipment Configuration', () => {
  describe('Mower', () => {
    it('has 100 max resource', () => {
      expect(EQUIPMENT_CONFIGS.mower.resourceMax).toBe(100);
    });

    it('has 0.5 resource use rate', () => {
      expect(EQUIPMENT_CONFIGS.mower.resourceUseRate).toBe(0.5);
    });

    it('has effect radius of 1', () => {
      expect(EQUIPMENT_CONFIGS.mower.effectRadius).toBe(1);
    });
  });

  describe('Sprinkler', () => {
    it('has 100 max resource', () => {
      expect(EQUIPMENT_CONFIGS.sprinkler.resourceMax).toBe(100);
    });

    it('has 1.0 resource use rate', () => {
      expect(EQUIPMENT_CONFIGS.sprinkler.resourceUseRate).toBe(1.0);
    });

    it('has effect radius of 2', () => {
      expect(EQUIPMENT_CONFIGS.sprinkler.effectRadius).toBe(2);
    });
  });

  describe('Spreader', () => {
    it('has 100 max resource', () => {
      expect(EQUIPMENT_CONFIGS.spreader.resourceMax).toBe(100);
    });

    it('has 0.8 resource use rate', () => {
      expect(EQUIPMENT_CONFIGS.spreader.resourceUseRate).toBe(0.8);
    });

    it('has effect radius of 2', () => {
      expect(EQUIPMENT_CONFIGS.spreader.effectRadius).toBe(2);
    });
  });
});

describe('Equipment State Creation', () => {
  it('creates mower with full resources', () => {
    const state = createEquipmentState('mower');
    expect(state.type).toBe('mower');
    expect(state.resourceCurrent).toBe(100);
    expect(state.resourceMax).toBe(100);
    expect(state.isActive).toBe(false);
  });

  it('creates sprinkler with full resources', () => {
    const state = createEquipmentState('sprinkler');
    expect(state.type).toBe('sprinkler');
    expect(state.resourceCurrent).toBe(100);
    expect(state.resourceUseRate).toBe(1.0);
  });

  it('creates spreader with correct effect radius', () => {
    const state = createEquipmentState('spreader');
    expect(state.effectRadius).toBe(2);
  });

  it('starts inactive', () => {
    const state = createEquipmentState('mower');
    expect(state.isActive).toBe(false);
  });
});

describe('Equipment Activation', () => {
  describe('activateEquipment', () => {
    it('activates equipment with resources', () => {
      const state = createEquipmentState('mower');
      const activated = activateEquipment(state);
      expect(activated.isActive).toBe(true);
    });

    it('does not activate when resource is 0', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0
      };
      const result = activateEquipment(state);
      expect(result.isActive).toBe(false);
    });

    it('does not modify original state', () => {
      const state = createEquipmentState('mower');
      activateEquipment(state);
      expect(state.isActive).toBe(false);
    });
  });

  describe('deactivateEquipment', () => {
    it('deactivates active equipment', () => {
      const state = activateEquipment(createEquipmentState('mower'));
      const deactivated = deactivateEquipment(state);
      expect(deactivated.isActive).toBe(false);
    });

    it('is idempotent on inactive equipment', () => {
      const state = createEquipmentState('mower');
      const result = deactivateEquipment(state);
      expect(result.isActive).toBe(false);
    });
  });

  describe('canActivate', () => {
    it('returns true when resource > 0', () => {
      const state = createEquipmentState('mower');
      expect(canActivate(state)).toBe(true);
    });

    it('returns false when resource is 0', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0
      };
      expect(canActivate(state)).toBe(false);
    });

    it('returns true even with very low resource', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0.001
      };
      expect(canActivate(state)).toBe(true);
    });
  });
});

describe('Resource Management', () => {
  describe('refillEquipment', () => {
    it('restores resource to max', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0
      };
      const refilled = refillEquipment(state);
      expect(refilled.resourceCurrent).toBe(100);
    });

    it('works when already full', () => {
      const state = createEquipmentState('mower');
      const refilled = refillEquipment(state);
      expect(refilled.resourceCurrent).toBe(100);
    });

    it('works when partially depleted', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 50
      };
      const refilled = refillEquipment(state);
      expect(refilled.resourceCurrent).toBe(100);
    });
  });

  describe('getResourcePercent', () => {
    it('returns 100 for full resource', () => {
      const state = createEquipmentState('mower');
      expect(getResourcePercent(state)).toBe(100);
    });

    it('returns 0 for empty resource', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0
      };
      expect(getResourcePercent(state)).toBe(0);
    });

    it('returns 50 for half resource', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 50
      };
      expect(getResourcePercent(state)).toBe(50);
    });
  });

  describe('isEmpty', () => {
    it('returns false for full resource', () => {
      const state = createEquipmentState('mower');
      expect(isEmpty(state)).toBe(false);
    });

    it('returns true for empty resource', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0
      };
      expect(isEmpty(state)).toBe(true);
    });

    it('returns false for partial resource', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 1
      };
      expect(isEmpty(state)).toBe(false);
    });
  });
});

describe('Resource Consumption', () => {
  describe('consumeResource', () => {
    it('does not consume when inactive', () => {
      const state = createEquipmentState('mower');
      const result = consumeResource(state, 1000);
      expect(result.resourceCurrent).toBe(100);
    });

    it('consumes resource when active', () => {
      const state = activateEquipment(createEquipmentState('mower'));
      const result = consumeResource(state, 1000);
      expect(result.resourceCurrent).toBeLessThan(100);
    });

    it('consumes at correct rate for mower (0.5/s)', () => {
      const state = activateEquipment(createEquipmentState('mower'));
      const result = consumeResource(state, 2000);
      expect(result.resourceCurrent).toBeCloseTo(99, 1);
    });

    it('consumes at correct rate for sprinkler (1.0/s)', () => {
      const state = activateEquipment(createEquipmentState('sprinkler'));
      const result = consumeResource(state, 1000);
      expect(result.resourceCurrent).toBeCloseTo(99, 1);
    });

    it('consumes at correct rate for spreader (0.8/s)', () => {
      const state = activateEquipment(createEquipmentState('spreader'));
      const result = consumeResource(state, 1000);
      expect(result.resourceCurrent).toBeCloseTo(99.2, 1);
    });

    it('auto-deactivates when resource depleted', () => {
      const state: EquipmentState = {
        ...activateEquipment(createEquipmentState('mower')),
        resourceCurrent: 0.1
      };
      const result = consumeResource(state, 10000);
      expect(result.resourceCurrent).toBe(0);
      expect(result.isActive).toBe(false);
    });

    it('does not consume when already empty', () => {
      const state: EquipmentState = {
        ...createEquipmentState('mower'),
        resourceCurrent: 0,
        isActive: true
      };
      const result = consumeResource(state, 1000);
      expect(result.resourceCurrent).toBe(0);
    });

    it('clamps to 0 instead of going negative', () => {
      const state: EquipmentState = {
        ...activateEquipment(createEquipmentState('sprinkler')),
        resourceCurrent: 0.5
      };
      const result = consumeResource(state, 2000);
      expect(result.resourceCurrent).toBe(0);
      expect(result.resourceCurrent).not.toBeLessThan(0);
    });

    it('accumulates consumption over multiple calls', () => {
      let state = activateEquipment(createEquipmentState('mower'));
      state = consumeResource(state, 1000);
      state = consumeResource(state, 1000);
      state = consumeResource(state, 1000);
      expect(state.resourceCurrent).toBeCloseTo(98.5, 1);
    });
  });
});

describe('Equipment Positioning', () => {
  describe('getIsoOffset', () => {
    it('returns correct offset for up direction', () => {
      const offset = getIsoOffset('up');
      expect(offset).toEqual({ x: 16, y: -8 });
    });

    it('returns correct offset for down direction', () => {
      const offset = getIsoOffset('down');
      expect(offset).toEqual({ x: -16, y: 8 });
    });

    it('returns correct offset for left direction', () => {
      const offset = getIsoOffset('left');
      expect(offset).toEqual({ x: -16, y: -8 });
    });

    it('returns correct offset for right direction', () => {
      const offset = getIsoOffset('right');
      expect(offset).toEqual({ x: 16, y: 8 });
    });
  });

  describe('getDepthOffset', () => {
    it('returns -1 for up direction (behind player)', () => {
      expect(getDepthOffset('up')).toBe(-1);
    });

    it('returns -1 for left direction (behind player)', () => {
      expect(getDepthOffset('left')).toBe(-1);
    });

    it('returns 1 for down direction (in front of player)', () => {
      expect(getDepthOffset('down')).toBe(1);
    });

    it('returns 1 for right direction (in front of player)', () => {
      expect(getDepthOffset('right')).toBe(1);
    });
  });
});

describe('Equipment Lifecycle', () => {
  it('supports full use cycle: activate -> consume -> auto-deactivate -> refill', () => {
    let state = createEquipmentState('sprinkler');

    state = activateEquipment(state);
    expect(state.isActive).toBe(true);

    for (let i = 0; i < 110; i++) {
      state = consumeResource(state, 1000);
    }
    expect(state.resourceCurrent).toBe(0);
    expect(state.isActive).toBe(false);

    state = refillEquipment(state);
    expect(state.resourceCurrent).toBe(100);
    expect(state.isActive).toBe(false);

    state = activateEquipment(state);
    expect(state.isActive).toBe(true);
  });

  it('maintains immutability through entire lifecycle', () => {
    const original = createEquipmentState('mower');
    const activated = activateEquipment(original);
    const consumed = consumeResource(activated, 1000);
    const deactivated = deactivateEquipment(consumed);
    const refilled = refillEquipment(deactivated);

    expect(original.isActive).toBe(false);
    expect(original.resourceCurrent).toBe(100);
    expect(activated.isActive).toBe(true);
    expect(consumed.resourceCurrent).toBeLessThan(100);
    expect(deactivated.isActive).toBe(false);
    expect(refilled.resourceCurrent).toBe(100);
  });
});
