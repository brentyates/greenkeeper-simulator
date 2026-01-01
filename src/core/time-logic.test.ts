import { describe, it, expect } from 'vitest';
import {
  createInitialTimeState,
  updateTime,
  clampTimeScale,
  setTimeScale,
  increaseTimeScale,
  decreaseTimeScale,
  pause,
  resume,
  togglePause,
  getCurrentHour,
  getFormattedTime,
  getDayName,
  getDaylightTint,
  lerpColor,
  loadTimeState,
  serializeTimeState,
  DAY_LENGTH,
  START_HOUR,
  MIN_TIME_SCALE,
  MAX_TIME_SCALE,
  TimeState
} from './time-logic';

describe('Time State Initialization', () => {
  it('starts at game time 0', () => {
    const state = createInitialTimeState();
    expect(state.gameTime).toBe(0);
  });

  it('starts on day 1', () => {
    const state = createInitialTimeState();
    expect(state.currentDay).toBe(1);
  });

  it('starts at hour 0 (which maps to 6 AM)', () => {
    const state = createInitialTimeState();
    expect(state.currentHour).toBe(0);
    expect(getCurrentHour(state)).toBe(6);
  });

  it('starts with time scale of 1', () => {
    const state = createInitialTimeState();
    expect(state.timeScale).toBe(1);
  });

  it('starts unpaused', () => {
    const state = createInitialTimeState();
    expect(state.isPaused).toBe(false);
  });
});

describe('Time Progression', () => {
  describe('updateTime', () => {
    it('advances game time based on delta', () => {
      const state = createInitialTimeState();
      const updated = updateTime(state, 60000);
      expect(updated.gameTime).toBe(1);
    });

    it('does not advance time when paused', () => {
      const state = pause(createInitialTimeState());
      const updated = updateTime(state, 60000);
      expect(updated.gameTime).toBe(0);
    });

    it('respects time scale', () => {
      const state = setTimeScale(createInitialTimeState(), 2);
      const updated = updateTime(state, 60000);
      expect(updated.gameTime).toBe(2);
    });

    it('increments hour after 60 minutes', () => {
      let state = createInitialTimeState();
      state = updateTime(state, 60 * 60000);
      expect(state.currentHour).toBe(1);
    });

    it('wraps hour at 24', () => {
      let state = createInitialTimeState();
      state = updateTime(state, 24 * 60 * 60000);
      expect(state.currentHour).toBe(0);
    });

    it('increments day when hour transitions from 23 to 0', () => {
      let state: TimeState = {
        ...createInitialTimeState(),
        gameTime: 23 * 60,
        currentHour: 23
      };
      state = updateTime(state, 60 * 60000);
      expect(state.currentDay).toBe(2);
      expect(state.currentHour).toBe(0);
    });

    it('does not increment day on other hour transitions', () => {
      let state: TimeState = {
        ...createInitialTimeState(),
        currentHour: 10
      };
      state = updateTime(state, 60 * 60000);
      expect(state.currentDay).toBe(1);
    });

    it('does not modify original state', () => {
      const state = createInitialTimeState();
      updateTime(state, 60000);
      expect(state.gameTime).toBe(0);
    });

    it('handles fractional time correctly', () => {
      const state = createInitialTimeState();
      const updated = updateTime(state, 30000);
      expect(updated.gameTime).toBe(0.5);
    });
  });
});

describe('Time Scale', () => {
  describe('clampTimeScale', () => {
    it('allows 0.5x scale', () => {
      expect(clampTimeScale(0.5)).toBe(0.5);
    });

    it('allows 4x scale', () => {
      expect(clampTimeScale(4)).toBe(4);
    });

    it('clamps below minimum to 0.5', () => {
      expect(clampTimeScale(0.1)).toBe(0.5);
    });

    it('clamps above maximum to 4', () => {
      expect(clampTimeScale(10)).toBe(4);
    });

    it('allows values between min and max', () => {
      expect(clampTimeScale(1)).toBe(1);
      expect(clampTimeScale(2)).toBe(2);
    });
  });

  describe('setTimeScale', () => {
    it('sets valid scale', () => {
      const state = createInitialTimeState();
      const updated = setTimeScale(state, 2);
      expect(updated.timeScale).toBe(2);
    });

    it('clamps invalid scale', () => {
      const state = createInitialTimeState();
      const updated = setTimeScale(state, 10);
      expect(updated.timeScale).toBe(4);
    });
  });

  describe('increaseTimeScale', () => {
    it('doubles time scale', () => {
      const state = createInitialTimeState();
      const updated = increaseTimeScale(state);
      expect(updated.timeScale).toBe(2);
    });

    it('stops at max scale', () => {
      const state = setTimeScale(createInitialTimeState(), 4);
      const updated = increaseTimeScale(state);
      expect(updated.timeScale).toBe(4);
    });

    it('can increase from 0.5 to 1', () => {
      const state = setTimeScale(createInitialTimeState(), 0.5);
      const updated = increaseTimeScale(state);
      expect(updated.timeScale).toBe(1);
    });
  });

  describe('decreaseTimeScale', () => {
    it('halves time scale', () => {
      const state = setTimeScale(createInitialTimeState(), 2);
      const updated = decreaseTimeScale(state);
      expect(updated.timeScale).toBe(1);
    });

    it('stops at min scale', () => {
      const state = setTimeScale(createInitialTimeState(), 0.5);
      const updated = decreaseTimeScale(state);
      expect(updated.timeScale).toBe(0.5);
    });

    it('can decrease from 1 to 0.5', () => {
      const state = createInitialTimeState();
      const updated = decreaseTimeScale(state);
      expect(updated.timeScale).toBe(0.5);
    });
  });
});

describe('Pause Control', () => {
  describe('pause', () => {
    it('pauses the game', () => {
      const state = createInitialTimeState();
      const paused = pause(state);
      expect(paused.isPaused).toBe(true);
    });

    it('is idempotent', () => {
      const state = pause(createInitialTimeState());
      const paused = pause(state);
      expect(paused.isPaused).toBe(true);
    });
  });

  describe('resume', () => {
    it('resumes the game', () => {
      const state = pause(createInitialTimeState());
      const resumed = resume(state);
      expect(resumed.isPaused).toBe(false);
    });

    it('is idempotent', () => {
      const state = createInitialTimeState();
      const resumed = resume(state);
      expect(resumed.isPaused).toBe(false);
    });
  });

  describe('togglePause', () => {
    it('pauses when unpaused', () => {
      const state = createInitialTimeState();
      const toggled = togglePause(state);
      expect(toggled.isPaused).toBe(true);
    });

    it('unpauses when paused', () => {
      const state = pause(createInitialTimeState());
      const toggled = togglePause(state);
      expect(toggled.isPaused).toBe(false);
    });
  });
});

describe('Time Display', () => {
  describe('getCurrentHour', () => {
    it('returns 6 for hour 0 (start of day)', () => {
      const state = createInitialTimeState();
      expect(getCurrentHour(state)).toBe(6);
    });

    it('returns 12 for hour 6 (noon)', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 6 };
      expect(getCurrentHour(state)).toBe(12);
    });

    it('returns 0 for hour 18 (midnight)', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 18 };
      expect(getCurrentHour(state)).toBe(0);
    });

    it('wraps at 24', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 20 };
      expect(getCurrentHour(state)).toBe(2);
    });
  });

  describe('getFormattedTime', () => {
    it('formats 6:00 AM at start', () => {
      const state = createInitialTimeState();
      expect(getFormattedTime(state)).toBe('6:00 AM');
    });

    it('formats 12:00 PM at noon', () => {
      const state: TimeState = {
        ...createInitialTimeState(),
        gameTime: 6 * 60,
        currentHour: 6
      };
      expect(getFormattedTime(state)).toBe('12:00 PM');
    });

    it('pads minutes with zero', () => {
      const state: TimeState = {
        ...createInitialTimeState(),
        gameTime: 5
      };
      expect(getFormattedTime(state)).toBe('6:05 AM');
    });

    it('shows 12 instead of 0 for noon/midnight', () => {
      const state: TimeState = {
        ...createInitialTimeState(),
        currentHour: 18,
        gameTime: 18 * 60
      };
      expect(getFormattedTime(state)).toBe('12:00 AM');
    });

    it('uses 12-hour format', () => {
      const state: TimeState = {
        ...createInitialTimeState(),
        currentHour: 8,
        gameTime: 8 * 60
      };
      expect(getFormattedTime(state)).toBe('2:00 PM');
    });
  });

  describe('getDayName', () => {
    it('returns Day 1 on first day', () => {
      const state = createInitialTimeState();
      expect(getDayName(state)).toBe('Day 1');
    });

    it('returns correct day number', () => {
      const state: TimeState = { ...createInitialTimeState(), currentDay: 5 };
      expect(getDayName(state)).toBe('Day 5');
    });
  });
});

describe('Daylight Tint', () => {
  describe('lerpColor', () => {
    it('returns color1 when t=0', () => {
      expect(lerpColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000);
    });

    it('returns color2 when t=1', () => {
      expect(lerpColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
    });

    it('returns midpoint when t=0.5', () => {
      const result = lerpColor(0x000000, 0xffffff, 0.5);
      const r = (result >> 16) & 0xff;
      const g = (result >> 8) & 0xff;
      const b = result & 0xff;
      expect(r).toBe(127);
      expect(g).toBe(127);
      expect(b).toBe(127);
    });
  });

  describe('getDaylightTint', () => {
    it('returns sunrise tint (warm) at 6 AM', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 0 };
      const tint = getDaylightTint(state);
      expect(tint).toBe(0xffcc88);
    });

    it('returns full daylight (white) at noon', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 6 };
      expect(getDaylightTint(state)).toBe(0xffffff);
    });

    it('returns full daylight at 5 PM', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 11 };
      expect(getDaylightTint(state)).toBe(0xffffff);
    });

    it('returns sunset tint at 6 PM', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 12 };
      expect(getDaylightTint(state)).toBe(0xffffff);
    });

    it('returns night tint at 8 PM', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 14 };
      expect(getDaylightTint(state)).toBe(0x6688bb);
    });

    it('returns night tint at midnight', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 18 };
      expect(getDaylightTint(state)).toBe(0x6688bb);
    });

    it('returns night tint at 3 AM', () => {
      const state: TimeState = { ...createInitialTimeState(), currentHour: 21 };
      expect(getDaylightTint(state)).toBe(0x6688bb);
    });
  });
});

describe('Serialization', () => {
  describe('serializeTimeState', () => {
    it('serializes game time', () => {
      const state: TimeState = { ...createInitialTimeState(), gameTime: 120 };
      const serialized = serializeTimeState(state);
      expect(serialized.gameTime).toBe(120);
    });

    it('serializes current day', () => {
      const state: TimeState = { ...createInitialTimeState(), currentDay: 3 };
      const serialized = serializeTimeState(state);
      expect(serialized.currentDay).toBe(3);
    });

    it('serializes time scale', () => {
      const state: TimeState = { ...createInitialTimeState(), timeScale: 2 };
      const serialized = serializeTimeState(state);
      expect(serialized.timeScale).toBe(2);
    });

    it('does not serialize pause state', () => {
      const state = pause(createInitialTimeState());
      const serialized = serializeTimeState(state);
      expect(serialized).not.toHaveProperty('isPaused');
    });
  });

  describe('loadTimeState', () => {
    it('restores game time', () => {
      const loaded = loadTimeState({ gameTime: 120, currentDay: 1, timeScale: 1 });
      expect(loaded.gameTime).toBe(120);
    });

    it('restores current day', () => {
      const loaded = loadTimeState({ gameTime: 0, currentDay: 5, timeScale: 1 });
      expect(loaded.currentDay).toBe(5);
    });

    it('restores time scale', () => {
      const loaded = loadTimeState({ gameTime: 0, currentDay: 1, timeScale: 2 });
      expect(loaded.timeScale).toBe(2);
    });

    it('calculates current hour from game time', () => {
      const loaded = loadTimeState({ gameTime: 120, currentDay: 1, timeScale: 1 });
      expect(loaded.currentHour).toBe(2);
    });

    it('starts unpaused', () => {
      const loaded = loadTimeState({ gameTime: 0, currentDay: 1, timeScale: 1 });
      expect(loaded.isPaused).toBe(false);
    });
  });

  it('round-trips correctly', () => {
    const original: TimeState = {
      gameTime: 360,
      currentDay: 3,
      currentHour: 6,
      timeScale: 2,
      isPaused: true
    };
    const serialized = serializeTimeState(original);
    const loaded = loadTimeState(serialized);

    expect(loaded.gameTime).toBe(original.gameTime);
    expect(loaded.currentDay).toBe(original.currentDay);
    expect(loaded.currentHour).toBe(original.currentHour);
    expect(loaded.timeScale).toBe(original.timeScale);
  });
});

describe('Constants', () => {
  it('day length is 24 hours', () => {
    expect(DAY_LENGTH).toBe(24);
  });

  it('start hour is 6 AM', () => {
    expect(START_HOUR).toBe(6);
  });

  it('min time scale is 0.5x', () => {
    expect(MIN_TIME_SCALE).toBe(0.5);
  });

  it('max time scale is 4x', () => {
    expect(MAX_TIME_SCALE).toBe(4);
  });
});
