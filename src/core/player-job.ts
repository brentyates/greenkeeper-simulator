import type { JobSystemState, JobTaskType } from './job';
import { createJob, assignJob, startJob, advanceJobProgress, completeJob, cancelJob, getActivePlayerJob, getPatternForTask } from './job';
import type { NamedRegion } from './named-region';
import type { SerializedTopology } from './mesh-topology';
import { generateWaypoints } from './movement-patterns';

export interface PlayerJobTickResult {
  moved: boolean;
  newX: number;
  newZ: number;
  effect: {
    worldX: number;
    worldZ: number;
    radius: number;
    type: 'mow' | 'water' | 'fertilize' | 'rake';
    efficiency: number;
  } | null;
  completed: boolean;
}

const WAYPOINT_ARRIVE_DIST = 0.3;
const PLAYER_JOB_SPEED = 4.0;

const WORK_RADII: Record<JobTaskType, number> = {
  mow: 1.0,
  water: 2.0,
  fertilize: 2.0,
  rake: 1.5,
};

export function createPlayerJob(
  jobState: JobSystemState,
  region: NamedRegion,
  taskType: JobTaskType,
  gameTime: number,
  topology?: SerializedTopology,
): boolean {
  if (getActivePlayerJob(jobState)) return false;

  const pattern = getPatternForTask(taskType, region.terrainCode);
  const waypoints = generateWaypoints(pattern, region, topology);
  if (waypoints.length === 0) return false;

  const job = createJob(jobState, region.id, taskType, region.faceIds, pattern, waypoints, gameTime);
  if (!job) return false;

  assignJob(jobState, job.id, 'player', 'player');
  startJob(jobState, job.id, gameTime);
  return true;
}

export function tickPlayerJob(
  jobState: JobSystemState,
  playerX: number,
  playerZ: number,
  deltaMinutes: number,
  gameTime: number,
): PlayerJobTickResult {
  const job = getActivePlayerJob(jobState);
  if (!job) {
    return { moved: false, newX: playerX, newZ: playerZ, effect: null, completed: false };
  }

  if (job.waypointIndex >= job.waypoints.length) {
    completeJob(jobState, job.id, gameTime);
    return { moved: false, newX: playerX, newZ: playerZ, effect: null, completed: true };
  }

  const target = job.waypoints[job.waypointIndex];
  const dx = target.x - playerX;
  const dz = target.z - playerZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= WAYPOINT_ARRIVE_DIST) {
    job.waypointIndex++;

    const effect = {
      worldX: target.x,
      worldZ: target.z,
      radius: WORK_RADII[job.taskType],
      type: job.taskType,
      efficiency: 1.0,
    };

    const completed = job.waypointIndex >= job.waypoints.length;
    if (completed) {
      completeJob(jobState, job.id, gameTime);
    }

    return { moved: false, newX: playerX, newZ: playerZ, effect, completed };
  }

  const moveDistance = PLAYER_JOB_SPEED * deltaMinutes;
  const t = Math.min(1, moveDistance / dist);

  return {
    moved: true,
    newX: playerX + dx * t,
    newZ: playerZ + dz * t,
    effect: null,
    completed: false,
  };
}

export function reportPlayerJobProgress(jobState: JobSystemState, affectedFaceIds: number[]): void {
  const job = getActivePlayerJob(jobState);
  if (!job) return;
  advanceJobProgress(jobState, job.id, affectedFaceIds);
}

export function cancelPlayerJob(jobState: JobSystemState): boolean {
  const job = getActivePlayerJob(jobState);
  if (!job) return false;
  return cancelJob(jobState, job.id);
}

export function hasActivePlayerJob(jobState: JobSystemState): boolean {
  return getActivePlayerJob(jobState) !== null;
}
