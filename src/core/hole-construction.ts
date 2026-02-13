export type HoleFeatureKind = 'tee_box' | 'pin_position';

export type HoleTeeSet =
  | 'championship'
  | 'middle'
  | 'forward'
  | 'senior'
  | 'custom';

export interface HoleFeatureAssignment {
  kind: HoleFeatureKind;
  holeNumber: number;
  teeSet?: HoleTeeSet;
}

export interface PlaceableHoleAsset {
  assetId: string;
  x: number;
  y: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
  gameplay?: {
    holeFeature?: HoleFeatureAssignment;
  };
}

export interface HoleTeeBoxDefinition {
  assetId: string;
  x: number;
  y: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
  teeSet: HoleTeeSet;
  yardageToPrimaryPin: number;
}

export interface HolePinPositionDefinition {
  assetId: string;
  x: number;
  y: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
  isPrimary: boolean;
}

export interface CourseHoleDefinition {
  holeNumber: number;
  teeBoxes: HoleTeeBoxDefinition[];
  pinPositions: HolePinPositionDefinition[];
  yardages: Record<string, number>;
  playable: boolean;
  validationIssues: string[];
}

export interface HoleGameplaySummary {
  totalHoles: number;
  playableHoles: number;
  totalTeeBoxes: number;
  totalPinPositions: number;
  coursePar: number;
}

interface ResolvedFeature {
  kind: HoleFeatureKind;
  holeNumber: number;
  teeSet: HoleTeeSet | null;
  asset: PlaceableHoleAsset;
  index: number;
}

interface UnresolvedFeature {
  kind: HoleFeatureKind;
  teeSet: HoleTeeSet | null;
  asset: PlaceableHoleAsset;
  index: number;
}

const TEE_SET_BY_ASSET_ID: Record<string, HoleTeeSet> = {
  'course.tee.marker.blue': 'championship',
  'course.tee.marker.white': 'middle',
  'course.tee.marker.red': 'forward',
  'course.tee.marker.gold': 'senior',
};

const PIN_ASSET_IDS = new Set<string>(['course.flag', 'course.cup']);

const TEE_SORT_PRIORITY: Record<HoleTeeSet, number> = {
  championship: 0,
  middle: 1,
  forward: 2,
  senior: 3,
  custom: 4,
};

const TEE_LABEL: Record<HoleTeeSet, string> = {
  championship: 'Championship',
  middle: 'Middle',
  forward: 'Forward',
  senior: 'Senior',
  custom: 'Custom',
};

export const YARDS_PER_WORLD_UNIT = 10;

function getDistance(
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

function toValidHoleNumber(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function inferTeeSetFromAssetId(assetId: string): HoleTeeSet | null {
  if (assetId in TEE_SET_BY_ASSET_ID) {
    return TEE_SET_BY_ASSET_ID[assetId];
  }
  if (assetId.startsWith('course.tee.marker')) {
    return 'custom';
  }
  return null;
}

function getFeatureKey(asset: PlaceableHoleAsset): string {
  return `${asset.assetId}:${asset.x}:${asset.y}:${asset.z}:${asset.rotation}`;
}

export function inferHoleFeatureFromAssetId(
  assetId: string
): Omit<HoleFeatureAssignment, 'holeNumber'> | null {
  if (PIN_ASSET_IDS.has(assetId)) {
    return { kind: 'pin_position' };
  }

  const teeSet = inferTeeSetFromAssetId(assetId);
  if (teeSet) {
    return {
      kind: 'tee_box',
      teeSet,
    };
  }

  return null;
}

export function createHoleFeatureAssignment(
  assetId: string,
  holeNumber: number
): HoleFeatureAssignment | null {
  const inferred = inferHoleFeatureFromAssetId(assetId);
  if (!inferred) return null;

  return {
    ...inferred,
    holeNumber: toValidHoleNumber(holeNumber),
  };
}

export function getMaxAssignedHoleNumber(assets: PlaceableHoleAsset[]): number {
  let maxHole = 0;
  for (const asset of assets) {
    const holeNumber = asset.gameplay?.holeFeature?.holeNumber;
    if (holeNumber && holeNumber > maxHole) {
      maxHole = toValidHoleNumber(holeNumber);
    }
  }
  return maxHole;
}

export function buildHoleDefinitionsFromAssets(
  assets: PlaceableHoleAsset[]
): CourseHoleDefinition[] {
  const resolved: ResolvedFeature[] = [];
  const unresolved: UnresolvedFeature[] = [];

  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index];
    const explicit = asset.gameplay?.holeFeature;
    const inferred = inferHoleFeatureFromAssetId(asset.assetId);

    if (explicit) {
      const kind = explicit.kind;
      const teeSet = kind === 'tee_box'
        ? explicit.teeSet ?? inferred?.teeSet ?? 'custom'
        : null;

      resolved.push({
        kind,
        holeNumber: toValidHoleNumber(explicit.holeNumber),
        teeSet,
        asset,
        index,
      });
      continue;
    }

    if (inferred) {
      unresolved.push({
        kind: inferred.kind,
        teeSet: inferred.teeSet ?? null,
        asset,
        index,
      });
    }
  }

  if (resolved.length === 0 && unresolved.length === 0) {
    return [];
  }

  let nextHoleNumber = resolved.reduce(
    (max, item) => Math.max(max, item.holeNumber),
    0
  ) + 1;

  const unresolvedPins = unresolved
    .filter((item) => item.kind === 'pin_position')
    .sort((a, b) => a.index - b.index);

  for (const pin of unresolvedPins) {
    resolved.push({
      kind: 'pin_position',
      holeNumber: nextHoleNumber++,
      teeSet: null,
      asset: pin.asset,
      index: pin.index,
    });
  }

  const allPins = resolved.filter((item) => item.kind === 'pin_position');

  const unresolvedTees = unresolved
    .filter((item) => item.kind === 'tee_box')
    .sort((a, b) => a.index - b.index);

  for (const tee of unresolvedTees) {
    let holeNumber = 1;
    if (allPins.length > 0) {
      let closest = allPins[0];
      let closestDistance = getDistance(
        tee.asset.x,
        tee.asset.z,
        closest.asset.x,
        closest.asset.z
      );

      for (let i = 1; i < allPins.length; i++) {
        const pin = allPins[i];
        const distance = getDistance(
          tee.asset.x,
          tee.asset.z,
          pin.asset.x,
          pin.asset.z
        );
        if (distance < closestDistance) {
          closest = pin;
          closestDistance = distance;
        }
      }

      holeNumber = closest.holeNumber;
    }

    resolved.push({
      kind: 'tee_box',
      holeNumber,
      teeSet: tee.teeSet ?? 'custom',
      asset: tee.asset,
      index: tee.index,
    });
  }

  const byHole = new Map<number, ResolvedFeature[]>();
  for (const feature of resolved) {
    const bucket = byHole.get(feature.holeNumber);
    if (bucket) {
      bucket.push(feature);
    } else {
      byHole.set(feature.holeNumber, [feature]);
    }
  }

  const holes: CourseHoleDefinition[] = [];
  const sortedHoleNumbers = Array.from(byHole.keys()).sort((a, b) => a - b);

  for (const holeNumber of sortedHoleNumbers) {
    const features = byHole.get(holeNumber) ?? [];
    const tees = features
      .filter((item) => item.kind === 'tee_box')
      .sort((a, b) => {
        const aPriority = TEE_SORT_PRIORITY[a.teeSet ?? 'custom'];
        const bPriority = TEE_SORT_PRIORITY[b.teeSet ?? 'custom'];
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.index - b.index;
      });
    const pins = features
      .filter((item) => item.kind === 'pin_position')
      .sort((a, b) => a.index - b.index);

    const primaryPin = pins[0];
    const teeLabelUsage: Record<string, number> = {};
    const yardages: Record<string, number> = {};

    const teeBoxes: HoleTeeBoxDefinition[] = tees.map((tee) => {
      const teeSet = tee.teeSet ?? 'custom';
      const yardage = primaryPin
        ? Math.max(
            1,
            Math.round(
              getDistance(
                tee.asset.x,
                tee.asset.z,
                primaryPin.asset.x,
                primaryPin.asset.z
              ) * YARDS_PER_WORLD_UNIT
            )
          )
        : 0;

      const baseLabel = TEE_LABEL[teeSet];
      const count = (teeLabelUsage[baseLabel] ?? 0) + 1;
      teeLabelUsage[baseLabel] = count;
      const finalLabel = count === 1 ? baseLabel : `${baseLabel} ${count}`;
      yardages[finalLabel] = yardage;

      return {
        assetId: tee.asset.assetId,
        x: tee.asset.x,
        y: tee.asset.y,
        z: tee.asset.z,
        rotation: tee.asset.rotation,
        teeSet,
        yardageToPrimaryPin: yardage,
      };
    });

    const pinPositions: HolePinPositionDefinition[] = pins.map((pin, index) => ({
      assetId: pin.asset.assetId,
      x: pin.asset.x,
      y: pin.asset.y,
      z: pin.asset.z,
      rotation: pin.asset.rotation,
      isPrimary: index === 0,
    }));

    const validationIssues: string[] = [];
    if (teeBoxes.length === 0) {
      validationIssues.push('Hole requires at least one tee box.');
    }
    if (pinPositions.length === 0) {
      validationIssues.push('Hole requires at least one pin position.');
    }

    holes.push({
      holeNumber,
      teeBoxes,
      pinPositions,
      yardages,
      playable: validationIssues.length === 0,
      validationIssues,
    });
  }

  return holes;
}

export function syncHoleFeatureAssignments(
  assets: PlaceableHoleAsset[]
): PlaceableHoleAsset[] {
  const holes = buildHoleDefinitionsFromAssets(assets);
  if (holes.length === 0) return assets.map((asset) => ({ ...asset }));

  const holeLookup = new Map<string, HoleFeatureAssignment>();

  for (const hole of holes) {
    for (const tee of hole.teeBoxes) {
      const key = `${tee.assetId}:${tee.x}:${tee.y}:${tee.z}:${tee.rotation}`;
      holeLookup.set(key, {
        kind: 'tee_box',
        holeNumber: hole.holeNumber,
        teeSet: tee.teeSet,
      });
    }
    for (const pin of hole.pinPositions) {
      const key = `${pin.assetId}:${pin.x}:${pin.y}:${pin.z}:${pin.rotation}`;
      holeLookup.set(key, {
        kind: 'pin_position',
        holeNumber: hole.holeNumber,
      });
    }
  }

  return assets.map((asset) => {
    const key = getFeatureKey(asset);
    const feature = holeLookup.get(key) ?? asset.gameplay?.holeFeature;
    if (!feature) return { ...asset };

    return {
      ...asset,
      gameplay: {
        ...asset.gameplay,
        holeFeature: feature,
      },
    };
  });
}

export function estimateParForHole(hole: CourseHoleDefinition): number {
  const yardages = Object.values(hole.yardages).filter((yards) => yards > 0);
  const maxYardage = yardages.length > 0
    ? Math.max(...yardages)
    : Math.max(...hole.teeBoxes.map((tee) => tee.yardageToPrimaryPin), 0);

  if (maxYardage <= 250) return 3;
  if (maxYardage <= 470) return 4;
  return 5;
}

export function calculateCoursePar(holes: CourseHoleDefinition[]): number {
  if (holes.length === 0) return 0;
  return holes.reduce((sum, hole) => sum + estimateParForHole(hole), 0);
}

export function summarizeHoleGameplay(
  holes: CourseHoleDefinition[]
): HoleGameplaySummary {
  const totalHoles = holes.length;
  const playableHoles = holes.filter((hole) => hole.playable).length;
  const totalTeeBoxes = holes.reduce((sum, hole) => sum + hole.teeBoxes.length, 0);
  const totalPinPositions = holes.reduce((sum, hole) => sum + hole.pinPositions.length, 0);
  const coursePar = calculateCoursePar(holes);

  return {
    totalHoles,
    playableHoles,
    totalTeeBoxes,
    totalPinPositions,
    coursePar,
  };
}
