import type { JobSystemState, StandingOrder, RegionSelector } from './job';
import { createJob, isRegionLocked, getPatternForTask, getJobForRegion } from './job';
import type { NamedRegion } from './named-region';
import { generateWaypoints } from './movement-patterns';
import type { SerializedTopology } from './mesh-topology';

export interface RegionStats {
  avgGrassHeight: number;
  avgMoisture: number;
  avgNutrients: number;
  avgHealth: number;
  faceCount: number;
}

export interface FaceStateSampler {
  getFaceState(faceId: number): { grassHeight: number; moisture: number; nutrients: number; health: number } | undefined;
}

export function computeRegionStats(region: NamedRegion, sampler: FaceStateSampler): RegionStats {
  let totalHeight = 0, totalMoisture = 0, totalNutrients = 0, totalHealth = 0;
  let count = 0;

  for (const fid of region.faceIds) {
    const fs = sampler.getFaceState(fid);
    if (!fs) continue;
    totalHeight += fs.grassHeight;
    totalMoisture += fs.moisture;
    totalNutrients += fs.nutrients;
    totalHealth += fs.health;
    count++;
  }

  if (count === 0) {
    return { avgGrassHeight: 0, avgMoisture: 0, avgNutrients: 0, avgHealth: 0, faceCount: 0 };
  }

  return {
    avgGrassHeight: totalHeight / count,
    avgMoisture: totalMoisture / count,
    avgNutrients: totalNutrients / count,
    avgHealth: totalHealth / count,
    faceCount: count,
  };
}

function resolveRegions(selector: RegionSelector, allRegions: NamedRegion[]): NamedRegion[] {
  switch (selector.type) {
    case 'specific':
      return allRegions.filter(r => r.id === selector.regionId);
    case 'terrain':
      return allRegions.filter(r => r.terrainCode === selector.terrainCode);
    case 'hole':
      return allRegions.filter(r => r.holeNumber === selector.holeNumber);
    case 'all':
      return allRegions;
  }
}

function checkCondition(stats: RegionStats, order: StandingOrder): boolean {
  const value = stats[order.condition.metric];
  if (order.condition.op === 'above') return value > order.condition.threshold;
  return value < order.condition.threshold;
}

export function evaluateStandingOrders(
  jobState: JobSystemState,
  regions: NamedRegion[],
  sampler: FaceStateSampler,
  gameTime: number,
  topology?: SerializedTopology,
): number {
  let jobsCreated = 0;

  for (const order of jobState.standingOrders) {
    if (!order.enabled) continue;
    if (gameTime - order.lastEvaluatedAt < order.cooldownMinutes) continue;

    order.lastEvaluatedAt = gameTime;

    const targetRegions = resolveRegions(order.regionSelector, regions);

    for (const region of targetRegions) {
      if (isRegionLocked(jobState, region.id)) continue;
      if (getJobForRegion(jobState, region.id)) continue;

      const stats = computeRegionStats(region, sampler);
      if (stats.faceCount === 0) continue;

      if (checkCondition(stats, order)) {
        const pattern = getPatternForTask(order.taskType, region.terrainCode);
        const waypoints = generateWaypoints(pattern, region, topology);
        if (waypoints.length === 0) continue;

        const job = createJob(
          jobState, region.id, order.taskType, region.faceIds,
          pattern, waypoints, gameTime, order.id,
        );
        if (job) jobsCreated++;
      }
    }
  }

  return jobsCreated;
}

