import type { Point2D } from './spline-math';
import type { JobSystemState, Job, JobTaskType } from './job';
import { startJob, completeJob } from './job';

export interface WorkerPosition {
  workerId: string;
  worldX: number;
  worldZ: number;
}

interface JobWorkEffect {
  worldX: number;
  worldZ: number;
  radius: number;
  type: 'mow' | 'water' | 'fertilize' | 'rake';
  efficiency: number;
}

interface JobExecutionResult {
  effects: JobWorkEffect[];
  workerMoves: WorkerPosition[];
}

const WORK_RADII: Record<JobTaskType, number> = {
  mow: 1.0,
  water: 2.0,
  fertilize: 2.0,
  rake: 1.5,
};

const WAYPOINT_ARRIVE_DIST = 0.3;
const WORKER_SPEED = 3.0;

export function tickJobExecution(
  jobState: JobSystemState,
  workerPositions: Map<string, Point2D>,
  deltaMinutes: number,
  gameTime: number,
): JobExecutionResult {
  const effects: JobWorkEffect[] = [];
  const workerMoves: WorkerPosition[] = [];

  for (const job of jobState.jobs) {
    if (job.status !== 'assigned' && job.status !== 'in_progress') continue;
    if (!job.assignedWorkerId) continue;
    if (job.workerType === 'player') continue;

    const pos = workerPositions.get(job.assignedWorkerId);
    if (!pos) continue;

    if (job.status === 'assigned') {
      startJob(jobState, job.id, gameTime);
    }

    const result = advanceWorkerAlongPattern(job, pos, deltaMinutes, gameTime);
    if (result.moved) {
      workerMoves.push({
        workerId: job.assignedWorkerId,
        worldX: result.newPos.x,
        worldZ: result.newPos.z,
      });
    }
    if (result.effect) {
      effects.push(result.effect);
    }
    if (result.completed) {
      completeJob(jobState, job.id, gameTime);
    }
  }

  return { effects, workerMoves };
}

interface AdvanceResult {
  moved: boolean;
  newPos: Point2D;
  effect: JobWorkEffect | null;
  completed: boolean;
}

function advanceWorkerAlongPattern(
  job: Job,
  currentPos: Point2D,
  deltaMinutes: number,
  _gameTime: number,
): AdvanceResult {
  if (job.waypointIndex >= job.waypoints.length) {
    return { moved: false, newPos: currentPos, effect: null, completed: true };
  }

  const target = job.waypoints[job.waypointIndex];
  const dx = target.x - currentPos.x;
  const dz = target.z - currentPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= WAYPOINT_ARRIVE_DIST) {
    job.waypointIndex++;

    const effect: JobWorkEffect = {
      worldX: target.x,
      worldZ: target.z,
      radius: WORK_RADII[job.taskType],
      type: job.taskType,
      efficiency: 1.0,
    };

    const completed = job.waypointIndex >= job.waypoints.length;
    return { moved: false, newPos: currentPos, effect, completed };
  }

  const moveDistance = WORKER_SPEED * deltaMinutes;
  const t = Math.min(1, moveDistance / dist);
  const newPos: Point2D = {
    x: currentPos.x + dx * t,
    z: currentPos.z + dz * t,
  };

  return { moved: true, newPos, effect: null, completed: false };
}

