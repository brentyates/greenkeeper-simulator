export interface TimeState {
  gameTime: number;
  currentDay: number;
  currentHour: number;
  timeScale: number;
  isPaused: boolean;
}

export const DAY_LENGTH = 24;
export const START_HOUR = 6;
export const MIN_TIME_SCALE = 0.5;
export const MAX_TIME_SCALE = 4;

export function createInitialTimeState(): TimeState {
  return {
    gameTime: 0,
    currentDay: 1,
    currentHour: 0,
    timeScale: 1,
    isPaused: false
  };
}

export function updateTime(state: TimeState, deltaMs: number): TimeState {
  if (state.isPaused) {
    return state;
  }

  const gameMinutes = (deltaMs * state.timeScale) / 60000;
  const newGameTime = state.gameTime + gameMinutes;

  const totalHours = (newGameTime / 60) % DAY_LENGTH;
  const previousHour = state.currentHour;
  const newCurrentHour = Math.floor(totalHours);

  let newCurrentDay = state.currentDay;
  if (previousHour === 23 && newCurrentHour === 0) {
    newCurrentDay = state.currentDay + 1;
  }

  return {
    ...state,
    gameTime: newGameTime,
    currentHour: newCurrentHour,
    currentDay: newCurrentDay
  };
}

export function clampTimeScale(scale: number): number {
  return Math.max(MIN_TIME_SCALE, Math.min(MAX_TIME_SCALE, scale));
}

export function setTimeScale(state: TimeState, scale: number): TimeState {
  return {
    ...state,
    timeScale: clampTimeScale(scale)
  };
}

export function increaseTimeScale(state: TimeState): TimeState {
  if (state.timeScale < MAX_TIME_SCALE) {
    return {
      ...state,
      timeScale: state.timeScale * 2
    };
  }
  return state;
}

export function decreaseTimeScale(state: TimeState): TimeState {
  if (state.timeScale > MIN_TIME_SCALE) {
    return {
      ...state,
      timeScale: state.timeScale / 2
    };
  }
  return state;
}

export function pause(state: TimeState): TimeState {
  return { ...state, isPaused: true };
}

export function resume(state: TimeState): TimeState {
  return { ...state, isPaused: false };
}

export function togglePause(state: TimeState): TimeState {
  return { ...state, isPaused: !state.isPaused };
}

export function getCurrentHour(state: TimeState): number {
  return (START_HOUR + state.currentHour) % 24;
}

export function getFormattedTime(state: TimeState): string {
  const hour = START_HOUR + state.currentHour;
  const displayHour = hour % 24;
  const minutes = Math.floor(state.gameTime % 60);
  const period = displayHour >= 12 ? 'PM' : 'AM';
  const hour12 = displayHour % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function getDayName(state: TimeState): string {
  return `Day ${state.currentDay}`;
}

export function lerpColor(color1: number, color2: number, t: number): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  const r = Math.floor(r1 + (r2 - r1) * t);
  const g = Math.floor(g1 + (g2 - g1) * t);
  const b = Math.floor(b1 + (b2 - b1) * t);

  return (r << 16) | (g << 8) | b;
}

export function getDaylightTint(state: TimeState): number {
  const hour = getCurrentHour(state);

  if (hour >= 6 && hour < 8) {
    const t = (hour - 6) / 2;
    return lerpColor(0xffcc88, 0xffffff, t);
  } else if (hour >= 8 && hour < 18) {
    return 0xffffff;
  } else if (hour >= 18 && hour < 20) {
    const t = (hour - 18) / 2;
    return lerpColor(0xffffff, 0xffaa66, t);
  } else {
    return 0x6688bb;
  }
}

export function loadTimeState(saved: {
  gameTime: number;
  currentDay: number;
  timeScale: number;
}): TimeState {
  const currentHour = Math.floor((saved.gameTime / 60) % DAY_LENGTH);
  return {
    gameTime: saved.gameTime,
    currentDay: saved.currentDay,
    currentHour,
    timeScale: saved.timeScale,
    isPaused: false
  };
}

export function serializeTimeState(state: TimeState): {
  gameTime: number;
  currentDay: number;
  timeScale: number;
} {
  return {
    gameTime: state.gameTime,
    currentDay: state.currentDay,
    timeScale: state.timeScale
  };
}
