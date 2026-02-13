export type TraversalRule<TEntity = unknown> = (
  entity: TEntity,
  worldX: number,
  worldZ: number
) => boolean;

export interface SegmentTraversalOptions {
  readonly sampleStep?: number;
  readonly maxSteps?: number;
}

export interface MoveTowardOptions {
  readonly sampleStep?: number;
  readonly detourAnglesDegrees?: readonly number[];
  readonly escapeStepLengths?: readonly number[];
  readonly escapeRadialAngleStepDegrees?: number;
  readonly includeAxisFallback?: boolean;
}

export interface NavigationStepResult {
  readonly worldX: number;
  readonly worldZ: number;
  readonly arrived: boolean;
  readonly blocked: boolean;
  readonly moved: boolean;
  readonly distanceMoved: number;
}

const DEFAULT_PATH_CHECK_SAMPLE_STEP = 1.0;
const DEFAULT_MAX_PATH_CHECK_STEPS = 24;

const DEFAULT_MOVE_SAMPLE_STEP = 0.25;
const DEFAULT_DETOUR_ANGLES_DEGREES: readonly number[] = [
  0,
  25,
  -25,
  50,
  -50,
  75,
  -75,
  110,
  -110,
  145,
  -145,
  180,
];
const DEFAULT_ESCAPE_STEP_LENGTHS: readonly number[] = [0.5, 0.75, 1.0, 1.25];
const DEFAULT_ESCAPE_RADIAL_ANGLE_STEP_DEGREES = 30;

export function isDirectSegmentTraversable<TEntity>(
  entity: TEntity,
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number,
  canTraverse?: TraversalRule<TEntity>,
  options: SegmentTraversalOptions = {}
): boolean {
  if (!canTraverse) return true;

  const sampleStep = options.sampleStep ?? DEFAULT_PATH_CHECK_SAMPLE_STEP;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_PATH_CHECK_STEPS;
  const dx = targetX - startX;
  const dz = targetZ - startZ;
  const maxAxisDistance = Math.max(Math.abs(dx), Math.abs(dz));
  if (maxAxisDistance <= sampleStep) {
    return canTraverse(entity, targetX, targetZ);
  }

  const steps = Math.max(
    1,
    Math.min(maxSteps, Math.ceil(maxAxisDistance / sampleStep))
  );

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sampleX = startX + dx * t;
    const sampleZ = startZ + dz * t;
    if (!canTraverse(entity, sampleX, sampleZ)) {
      return false;
    }
  }
  return true;
}

export function advanceTowardPoint<TEntity>(
  entity: TEntity,
  currentXStart: number,
  currentZStart: number,
  targetX: number,
  targetZ: number,
  maxDistance: number,
  canTraverse?: TraversalRule<TEntity>,
  options: MoveTowardOptions = {}
): NavigationStepResult {
  if (maxDistance <= 0) {
    return {
      worldX: currentXStart,
      worldZ: currentZStart,
      arrived: false,
      blocked: false,
      moved: false,
      distanceMoved: 0,
    };
  }

  const sampleStep = options.sampleStep ?? DEFAULT_MOVE_SAMPLE_STEP;
  const detourAnglesDegrees = options.detourAnglesDegrees ?? DEFAULT_DETOUR_ANGLES_DEGREES;
  const escapeStepLengths = options.escapeStepLengths ?? DEFAULT_ESCAPE_STEP_LENGTHS;
  const escapeRadialAngleStepDegrees =
    options.escapeRadialAngleStepDegrees ?? DEFAULT_ESCAPE_RADIAL_ANGLE_STEP_DEGREES;
  const includeAxisFallback = options.includeAxisFallback ?? true;

  const chooseStep = (
    currentX: number,
    currentZ: number,
    stepLength: number,
    headingAnglesDegrees: readonly number[] = detourAnglesDegrees,
    allowAxisFallback: boolean = includeAxisFallback
  ): { x: number; z: number } | null => {
    const toTargetX = targetX - currentX;
    const toTargetZ = targetZ - currentZ;
    const toTargetLength = Math.hypot(toTargetX, toTargetZ);
    if (toTargetLength < 1e-6) return null;

    const unitX = toTargetX / toTargetLength;
    const unitZ = toTargetZ / toTargetLength;
    const currentDistance = Math.abs(toTargetX) + Math.abs(toTargetZ);
    const candidates: Array<{ x: number; z: number; headingPenalty: number }> = [];

    for (const angleDeg of headingAnglesDegrees) {
      const angleRad = angleDeg * (Math.PI / 180);
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rotatedX = unitX * cos - unitZ * sin;
      const rotatedZ = unitX * sin + unitZ * cos;
      const normalizedPenalty = Math.min(Math.abs(angleDeg), 360 - Math.abs(angleDeg));
      candidates.push({
        x: currentX + rotatedX * stepLength,
        z: currentZ + rotatedZ * stepLength,
        headingPenalty: normalizedPenalty,
      });
    }

    if (allowAxisFallback) {
      if (Math.abs(toTargetX) >= Math.abs(toTargetZ)) {
        candidates.push({ x: currentX, z: currentZ + stepLength, headingPenalty: 110 });
        candidates.push({ x: currentX, z: currentZ - stepLength, headingPenalty: 110 });
      } else {
        candidates.push({ x: currentX + stepLength, z: currentZ, headingPenalty: 110 });
        candidates.push({ x: currentX - stepLength, z: currentZ, headingPenalty: 110 });
      }
    }

    let best: { x: number; z: number; score: number } | null = null;
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const key = `${candidate.x.toFixed(3)},${candidate.z.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (canTraverse && !canTraverse(entity, candidate.x, candidate.z)) continue;

      const candidateDistance =
        Math.abs(targetX - candidate.x) + Math.abs(targetZ - candidate.z);
      const distanceIncrease = Math.max(0, candidateDistance - currentDistance);
      const score =
        candidateDistance +
        distanceIncrease * 0.75 +
        candidate.headingPenalty * 0.003;

      if (!best || score < best.score) {
        best = { x: candidate.x, z: candidate.z, score };
      }
    }

    if (!best) return null;
    return { x: best.x, z: best.z };
  };

  let remaining = maxDistance;
  let currentX = currentXStart;
  let currentZ = currentZStart;
  let progressed = false;

  while (remaining > 1e-6) {
    const remainingToTarget = Math.hypot(targetX - currentX, targetZ - currentZ);
    if (remainingToTarget <= 1e-6) {
      return {
        worldX: targetX,
        worldZ: targetZ,
        arrived: true,
        blocked: false,
        moved: progressed,
        distanceMoved: maxDistance - remaining,
      };
    }

    const baseStepLength = Math.min(sampleStep, remaining, remainingToTarget);
    let next = chooseStep(currentX, currentZ, baseStepLength);

    if (
      !next &&
      canTraverse &&
      !canTraverse(entity, currentX, currentZ)
    ) {
      const testedLengths = new Set<string>([baseStepLength.toFixed(4)]);

      for (const escapeLength of escapeStepLengths) {
        const stepLength = Math.min(escapeLength, remaining);
        if (stepLength <= 1e-6) continue;
        const key = stepLength.toFixed(4);
        if (testedLengths.has(key)) continue;
        testedLengths.add(key);
        next = chooseStep(currentX, currentZ, stepLength);
        if (next) {
          break;
        }
      }

      if (!next) {
        const radialAngles: number[] = [];
        for (let angle = 0; angle < 360; angle += escapeRadialAngleStepDegrees) {
          radialAngles.push(angle);
        }
        for (const escapeLength of escapeStepLengths) {
          const stepLength = Math.min(escapeLength, remaining);
          if (stepLength <= 1e-6) continue;
          next = chooseStep(currentX, currentZ, stepLength, radialAngles, false);
          if (next) {
            break;
          }
        }
      }
    }

    if (!next) {
      return {
        worldX: currentX,
        worldZ: currentZ,
        arrived: false,
        blocked: !progressed,
        moved: progressed,
        distanceMoved: maxDistance - remaining,
      };
    }

    const movedDistance = Math.hypot(next.x - currentX, next.z - currentZ);
    currentX = next.x;
    currentZ = next.z;
    progressed = true;
    remaining -= movedDistance;
  }

  const finalDistance = Math.hypot(targetX - currentX, targetZ - currentZ);
  if (finalDistance <= 1e-6) {
    return {
      worldX: targetX,
      worldZ: targetZ,
      arrived: true,
      blocked: false,
      moved: true,
      distanceMoved: maxDistance,
    };
  }

  return {
    worldX: currentX,
    worldZ: currentZ,
    arrived: false,
    blocked: false,
    moved: progressed,
    distanceMoved: maxDistance - remaining,
  };
}
