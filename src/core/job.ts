import type { Point2D } from './spline-math';

export type JobTaskType = 'mow' | 'water' | 'fertilize' | 'rake';
export type MovementPatternType = 'linear_stripes' | 'diagonal_stripes' | 'concentric_circles' | 'perimeter_first' | 'random_coverage';
export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type JobWorkerType = 'player' | 'groundskeeper' | 'robot';

export interface Job {
  id: string;
  regionId: string;
  taskType: JobTaskType;
  status: JobStatus;
  assignedWorkerId: string | null;
  workerType: JobWorkerType | null;
  movementPattern: MovementPatternType;
  waypoints: Point2D[];
  waypointIndex: number;
  targetFaceIds: readonly number[];
  facesCompleted: Set<number>;
  progress: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  standingOrderId: string | null;
}

export interface StandingOrder {
  id: string;
  taskType: JobTaskType;
  regionSelector: RegionSelector;
  condition: {
    metric: ConditionMetric;
    op: ConditionOp;
    threshold: number;
  };
  assignTo: 'any_groundskeeper' | 'any_robot' | 'specific_worker';
  assignToId?: string;
  enabled: boolean;
  lastEvaluatedAt: number;
  cooldownMinutes: number;
}

export type RegionSelector =
  | { type: 'specific'; regionId: string }
  | { type: 'terrain'; terrainCode: number }
  | { type: 'hole'; holeNumber: number }
  | { type: 'all' };

export type ConditionMetric = 'avgGrassHeight' | 'avgMoisture' | 'avgNutrients' | 'avgHealth';
export type ConditionOp = 'above' | 'below';

export interface JobSystemState {
  jobs: Job[];
  standingOrders: StandingOrder[];
  regionLocks: Map<string, string>;
  nextJobId: number;
}

export function createJobSystemState(): JobSystemState {
  return {
    jobs: [],
    standingOrders: [],
    regionLocks: new Map(),
    nextJobId: 1,
  };
}

const PATTERN_MATRIX: Record<string, MovementPatternType> = {
  '0:mow': 'linear_stripes',
  '1:mow': 'linear_stripes',
  '2:mow': 'diagonal_stripes',
  '5:mow': 'diagonal_stripes',
  '3:rake': 'concentric_circles',
  'default:water': 'perimeter_first',
  'default:fertilize': 'random_coverage',
};

export function getPatternForTask(taskType: JobTaskType, terrainCode: number): MovementPatternType {
  return PATTERN_MATRIX[`${terrainCode}:${taskType}`]
    ?? PATTERN_MATRIX[`default:${taskType}`]
    ?? 'random_coverage';
}

export function isRegionLocked(state: JobSystemState, regionId: string): boolean {
  return state.regionLocks.has(regionId);
}

export function createJob(
  state: JobSystemState,
  regionId: string,
  taskType: JobTaskType,
  faceIds: readonly number[],
  pattern: MovementPatternType,
  waypoints: Point2D[],
  gameTime: number,
  standingOrderId: string | null = null,
): Job | null {
  if (state.regionLocks.has(regionId)) return null;

  const id = `job_${state.nextJobId++}`;
  const job: Job = {
    id,
    regionId,
    taskType,
    status: 'pending',
    assignedWorkerId: null,
    workerType: null,
    movementPattern: pattern,
    waypoints,
    waypointIndex: 0,
    targetFaceIds: faceIds,
    facesCompleted: new Set(),
    progress: 0,
    createdAt: gameTime,
    startedAt: null,
    completedAt: null,
    standingOrderId,
  };

  state.jobs.push(job);
  state.regionLocks.set(regionId, id);
  return job;
}

export function assignJob(
  state: JobSystemState,
  jobId: string,
  workerId: string,
  workerType: JobWorkerType,
): boolean {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status !== 'pending') return false;

  job.status = 'assigned';
  job.assignedWorkerId = workerId;
  job.workerType = workerType;
  return true;
}

export function startJob(state: JobSystemState, jobId: string, gameTime: number): boolean {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status !== 'assigned') return false;

  job.status = 'in_progress';
  job.startedAt = gameTime;
  return true;
}

export function advanceJobProgress(
  state: JobSystemState,
  jobId: string,
  completedFaceIds: number[],
): void {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status !== 'in_progress') return;

  for (const fid of completedFaceIds) {
    job.facesCompleted.add(fid);
  }
  job.progress = job.targetFaceIds.length > 0
    ? (job.facesCompleted.size / job.targetFaceIds.length) * 100
    : 100;
}

export function completeJob(state: JobSystemState, jobId: string, gameTime: number): boolean {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || (job.status !== 'in_progress' && job.status !== 'assigned')) return false;

  job.status = 'completed';
  job.completedAt = gameTime;
  job.progress = 100;
  state.regionLocks.delete(job.regionId);
  return true;
}

export function cancelJob(state: JobSystemState, jobId: string): boolean {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status === 'completed' || job.status === 'cancelled') return false;

  job.status = 'cancelled';
  state.regionLocks.delete(job.regionId);
  return true;
}

export function getAvailableJobs(
  state: JobSystemState,
  _workerType: JobWorkerType,
  terrainCode?: number,
): Job[] {
  return state.jobs.filter(j => {
    if (j.status !== 'pending') return false;
    if (terrainCode !== undefined) {
      const taskTerrainMatch = isTaskValidForTerrain(j.taskType, terrainCode);
      if (!taskTerrainMatch) return false;
    }
    return true;
  });
}

export function getJobForRegion(state: JobSystemState, regionId: string): Job | null {
  return state.jobs.find(j =>
    j.regionId === regionId &&
    (j.status === 'pending' || j.status === 'assigned' || j.status === 'in_progress')
  ) ?? null;
}

export function getJobById(state: JobSystemState, jobId: string): Job | null {
  return state.jobs.find(j => j.id === jobId) ?? null;
}

export function getActivePlayerJob(state: JobSystemState): Job | null {
  return state.jobs.find(j =>
    j.workerType === 'player' &&
    (j.status === 'assigned' || j.status === 'in_progress')
  ) ?? null;
}

export function getJobsForWorker(state: JobSystemState, workerId: string): Job[] {
  return state.jobs.filter(j =>
    j.assignedWorkerId === workerId &&
    (j.status === 'assigned' || j.status === 'in_progress')
  );
}

export function cleanupCompletedJobs(state: JobSystemState, maxAge: number, gameTime: number): void {
  state.jobs = state.jobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') {
      const age = gameTime - (j.completedAt ?? j.createdAt);
      return age < maxAge;
    }
    return true;
  });
}

function isTaskValidForTerrain(taskType: JobTaskType, terrainCode: number): boolean {
  if (taskType === 'rake') return terrainCode === 3;
  if (taskType === 'mow' || taskType === 'water' || taskType === 'fertilize') {
    return terrainCode === 0 || terrainCode === 1 || terrainCode === 2 || terrainCode === 5;
  }
  return false;
}
