import { describe, it, expect } from 'vitest';
import {
  createJobSystemState,
  createJob,
  assignJob,
  startJob,
  advanceJobProgress,
  completeJob,
  getAvailableJobs,
  getJobForRegion,
  isRegionLocked,
  getPatternForTask,
  cleanupCompletedJobs,
} from './job';

function makeState() {
  return createJobSystemState();
}

const FACE_IDS = [1, 2, 3, 4, 5];
const WAYPOINTS = [{ x: 10, z: 10 }, { x: 20, z: 10 }, { x: 20, z: 20 }];

describe('createJob', () => {
  it('creates a pending job and locks the region', () => {
    const state = makeState();
    const job = createJob(state, 'fairway_1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 100);
    expect(job).not.toBeNull();
    expect(job!.status).toBe('pending');
    expect(job!.regionId).toBe('fairway_1');
    expect(job!.taskType).toBe('mow');
    expect(job!.targetFaceIds).toEqual(FACE_IDS);
    expect(job!.waypoints).toEqual(WAYPOINTS);
    expect(job!.progress).toBe(0);
    expect(state.jobs).toHaveLength(1);
    expect(isRegionLocked(state, 'fairway_1')).toBe(true);
  });

  it('returns null if region is already locked', () => {
    const state = makeState();
    createJob(state, 'fairway_1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 100);
    const second = createJob(state, 'fairway_1', 'water', FACE_IDS, 'perimeter_first', WAYPOINTS, 100);
    expect(second).toBeNull();
    expect(state.jobs).toHaveLength(1);
  });

  it('allows jobs on different regions', () => {
    const state = makeState();
    const j1 = createJob(state, 'fairway_1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 100);
    const j2 = createJob(state, 'green_1', 'mow', [6, 7], 'diagonal_stripes', WAYPOINTS, 100);
    expect(j1).not.toBeNull();
    expect(j2).not.toBeNull();
    expect(state.jobs).toHaveLength(2);
  });

  it('increments job IDs', () => {
    const state = makeState();
    const j1 = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    const j2 = createJob(state, 'r2', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    expect(j1!.id).toBe('job_1');
    expect(j2!.id).toBe('job_2');
  });
});

describe('assignJob', () => {
  it('assigns a pending job to a worker', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    const ok = assignJob(state, job.id, 'worker_1', 'groundskeeper');
    expect(ok).toBe(true);
    expect(job.status).toBe('assigned');
    expect(job.assignedWorkerId).toBe('worker_1');
    expect(job.workerType).toBe('groundskeeper');
  });

  it('fails on non-pending job', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    const ok = assignJob(state, job.id, 'w2', 'groundskeeper');
    expect(ok).toBe(false);
  });
});

describe('startJob', () => {
  it('transitions assigned to in_progress', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    const ok = startJob(state, job.id, 50);
    expect(ok).toBe(true);
    expect(job.status).toBe('in_progress');
    expect(job.startedAt).toBe(50);
  });

  it('fails on pending job', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    expect(startJob(state, job.id, 50)).toBe(false);
  });
});

describe('advanceJobProgress', () => {
  it('tracks completed faces and calculates progress', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    startJob(state, job.id, 0);

    advanceJobProgress(state, job.id, [1, 2]);
    expect(job.facesCompleted.size).toBe(2);
    expect(job.progress).toBeCloseTo(40);

    advanceJobProgress(state, job.id, [2, 3, 4]);
    expect(job.facesCompleted.size).toBe(4);
    expect(job.progress).toBeCloseTo(80);
  });

  it('deduplicates face IDs', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    startJob(state, job.id, 0);

    advanceJobProgress(state, job.id, [1, 1, 1]);
    expect(job.facesCompleted.size).toBe(1);
  });
});

describe('completeJob', () => {
  it('completes job and releases region lock', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    startJob(state, job.id, 0);

    const ok = completeJob(state, job.id, 100);
    expect(ok).toBe(true);
    expect(job.status).toBe('completed');
    expect(job.progress).toBe(100);
    expect(isRegionLocked(state, 'r1')).toBe(false);
  });
});

describe('getAvailableJobs', () => {
  it('returns only pending jobs', () => {
    const state = makeState();
    createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    const j2 = createJob(state, 'r2', 'water', FACE_IDS, 'perimeter_first', WAYPOINTS, 0)!;
    assignJob(state, j2.id, 'w1', 'groundskeeper');

    const available = getAvailableJobs(state, 'groundskeeper');
    expect(available).toHaveLength(1);
    expect(available[0].regionId).toBe('r1');
  });

  it('filters by terrain code', () => {
    const state = makeState();
    createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    createJob(state, 'r2', 'rake', FACE_IDS, 'concentric_circles', WAYPOINTS, 0);

    const mowJobs = getAvailableJobs(state, 'groundskeeper', 0);
    expect(mowJobs).toHaveLength(1);
    expect(mowJobs[0].taskType).toBe('mow');

    const rakeJobs = getAvailableJobs(state, 'groundskeeper', 3);
    expect(rakeJobs).toHaveLength(1);
    expect(rakeJobs[0].taskType).toBe('rake');
  });
});

describe('getJobForRegion', () => {
  it('finds active job on a region', () => {
    const state = makeState();
    createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    const job = getJobForRegion(state, 'r1');
    expect(job).not.toBeNull();
    expect(job!.regionId).toBe('r1');
  });

  it('returns null for region with no active job', () => {
    const state = makeState();
    expect(getJobForRegion(state, 'r1')).toBeNull();
  });
});

describe('getPatternForTask', () => {
  it('returns linear_stripes for fairway mow', () => {
    expect(getPatternForTask('mow', 0)).toBe('linear_stripes');
  });

  it('returns diagonal_stripes for green mow', () => {
    expect(getPatternForTask('mow', 2)).toBe('diagonal_stripes');
  });

  it('returns concentric_circles for bunker rake', () => {
    expect(getPatternForTask('rake', 3)).toBe('concentric_circles');
  });

  it('returns perimeter_first for watering', () => {
    expect(getPatternForTask('water', 0)).toBe('perimeter_first');
    expect(getPatternForTask('water', 2)).toBe('perimeter_first');
  });

  it('returns random_coverage for fertilize', () => {
    expect(getPatternForTask('fertilize', 0)).toBe('random_coverage');
  });
});

describe('cleanupCompletedJobs', () => {
  it('removes old completed jobs', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    startJob(state, job.id, 0);
    completeJob(state, job.id, 10);

    cleanupCompletedJobs(state, 100, 200);
    expect(state.jobs).toHaveLength(0);
  });

  it('keeps recent completed jobs', () => {
    const state = makeState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');
    startJob(state, job.id, 0);
    completeJob(state, job.id, 90);

    cleanupCompletedJobs(state, 100, 100);
    expect(state.jobs).toHaveLength(1);
  });

  it('keeps active jobs', () => {
    const state = makeState();
    createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0);
    cleanupCompletedJobs(state, 0, 1000);
    expect(state.jobs).toHaveLength(1);
  });
});
