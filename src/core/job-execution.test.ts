import { describe, it, expect } from 'vitest';
import { tickJobExecution } from './job-execution';
import { createJobSystemState, createJob, assignJob } from './job';

const FACE_IDS = [1, 2, 3];
const WAYPOINTS = [
  { x: 10, z: 10 },
  { x: 20, z: 10 },
  { x: 20, z: 20 },
];

describe('tickJobExecution', () => {
  it('starts an assigned job on first tick', () => {
    const state = createJobSystemState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');

    const positions = new Map([['w1', { x: 10, z: 10 }]]);
    tickJobExecution(state, positions, 0.1, 1);

    expect(job.status).toBe('in_progress');
    expect(job.startedAt).toBe(1);
  });

  it('moves worker toward waypoint', () => {
    const state = createJobSystemState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');

    const positions = new Map([['w1', { x: 5, z: 10 }]]);
    const result = tickJobExecution(state, positions, 1, 1);

    expect(result.workerMoves).toHaveLength(1);
    expect(result.workerMoves[0].worldX).toBeGreaterThan(5);
  });

  it('emits work effect when arriving at waypoint', () => {
    const state = createJobSystemState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');

    const positions = new Map([['w1', { x: 10, z: 10 }]]);
    const result = tickJobExecution(state, positions, 0.1, 1);

    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].type).toBe('mow');
    expect(result.effects[0].worldX).toBe(10);
    expect(result.effects[0].worldZ).toBe(10);
    expect(result.effects[0].radius).toBe(1.0);
  });

  it('advances waypoint index after arrival', () => {
    const state = createJobSystemState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');

    const positions = new Map([['w1', { x: 10, z: 10 }]]);
    tickJobExecution(state, positions, 0.1, 1);

    expect(job.waypointIndex).toBe(1);
  });

  it('completes job after visiting all waypoints', () => {
    const state = createJobSystemState();
    const singleWp = [{ x: 10, z: 10 }];
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', singleWp, 0)!;
    assignJob(state, job.id, 'w1', 'groundskeeper');

    const positions = new Map([['w1', { x: 10, z: 10 }]]);
    tickJobExecution(state, positions, 0.1, 10);

    expect(job.status).toBe('completed');
    expect(state.regionLocks.has('r1')).toBe(false);
  });

  it('skips player-assigned jobs', () => {
    const state = createJobSystemState();
    const job = createJob(state, 'r1', 'mow', FACE_IDS, 'linear_stripes', WAYPOINTS, 0)!;
    assignJob(state, job.id, 'player', 'player');

    const positions = new Map([['player', { x: 10, z: 10 }]]);
    const result = tickJobExecution(state, positions, 0.1, 1);

    expect(result.effects).toHaveLength(0);
    expect(result.workerMoves).toHaveLength(0);
  });

  it('handles multiple jobs simultaneously', () => {
    const state = createJobSystemState();
    const j1 = createJob(state, 'r1', 'mow', [1], 'linear_stripes', [{ x: 10, z: 10 }], 0)!;
    const j2 = createJob(state, 'r2', 'water', [2], 'perimeter_first', [{ x: 30, z: 30 }], 0)!;
    assignJob(state, j1.id, 'w1', 'groundskeeper');
    assignJob(state, j2.id, 'w2', 'groundskeeper');

    const positions = new Map([
      ['w1', { x: 10, z: 10 }],
      ['w2', { x: 30, z: 30 }],
    ]);
    const result = tickJobExecution(state, positions, 0.1, 1);

    expect(result.effects).toHaveLength(2);
    expect(result.effects[0].type).toBe('mow');
    expect(result.effects[1].type).toBe('water');
  });
});
