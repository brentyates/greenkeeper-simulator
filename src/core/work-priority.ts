export interface WorkPriorityConfig {
  readonly localWorkRadius: number;
  readonly extremeNeedThreshold: number;
  readonly needWeight: number;
  readonly nearDistanceWeight: number;
  readonly farDistanceWeight: number;
  readonly localStickinessBonus: number;
}

export const DEFAULT_WORK_PRIORITY_CONFIG: Readonly<WorkPriorityConfig> = {
  localWorkRadius: 8,
  extremeNeedThreshold: 95,
  needWeight: 1.4,
  nearDistanceWeight: 1.2,
  farDistanceWeight: 2.8,
  localStickinessBonus: 12,
};

export function getDistancePenalty(
  distance: number,
  config: WorkPriorityConfig = DEFAULT_WORK_PRIORITY_CONFIG
): number {
  const nearDistance = Math.min(distance, config.localWorkRadius);
  const farDistance = Math.max(0, distance - config.localWorkRadius);
  return nearDistance * config.nearDistanceWeight + farDistance * config.farDistanceWeight;
}

export function getLocalityBonus(
  distance: number,
  config: WorkPriorityConfig = DEFAULT_WORK_PRIORITY_CONFIG
): number {
  if (distance > config.localWorkRadius) return 0;
  return ((config.localWorkRadius - distance) / config.localWorkRadius) * config.localStickinessBonus;
}

export function scoreNeedWithDistance(
  need: number,
  distance: number,
  extraBonus: number = 0,
  config: WorkPriorityConfig = DEFAULT_WORK_PRIORITY_CONFIG
): number {
  return (
    need * config.needWeight +
    extraBonus +
    getLocalityBonus(distance, config) -
    getDistancePenalty(distance, config)
  );
}

export function isExtremeNeed(
  need: number,
  config: WorkPriorityConfig = DEFAULT_WORK_PRIORITY_CONFIG
): boolean {
  return need >= config.extremeNeedThreshold;
}
