import { TerrainType, ObstacleType } from '../core/terrain';

export type { TerrainType, ObstacleType };

export interface ObstacleData {
  x: number;
  y: number;
  type: number;
}

export interface CourseData {
  name: string;
  width: number;
  height: number;
  par: number;
  layout: number[][];
  elevation: number[][];
  obstacles?: ObstacleData[];
}

const F = 0; // Fairway
const R = 1; // Rough
const G = 2; // Green
const B = 3; // Bunker
const W = 4; // Water

export const COURSE_HOLE_1: CourseData = {
  name: 'Sunrise Valley - Hole 1',
  width: 50,
  height: 38,
  par: 4,
  layout: [
    // Row 0-2: Top rough with green
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,G,G,G,G,G,G,G,G,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,G,G,G,G,G,G,G,G,G,G,G,G,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 3-5: Green and surrounding bunkers
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,B,G,G,G,G,G,G,G,G,G,G,G,G,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,B,G,G,G,G,G,G,G,G,G,G,G,G,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,G,G,G,G,G,G,G,G,G,G,G,G,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 6-8: Transition to fairway
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 9-14: Main fairway with water hazard on left
    [R,R,R,R,R,R,R,R,R,R,R,R,R,W,W,W,R,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,W,W,W,W,W,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,B,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,W,W,W,W,W,R,R,R,F,F,F,F,F,F,F,F,F,R,R,R,B,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,W,W,W,W,W,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,W,W,W,R,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 15-20: Fairway continues
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 21-26: Fairway with bunkers on sides
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,B,B,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,B,B,F,F,F,F,F,F,F,F,F,F,F,F,F,B,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,B,B,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 27-32: Fairway widens towards tee
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    // Row 33-37: Tee box area
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,F,F,F,F,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
  ],
  elevation: [
    // Row 0-2: Green area elevated, hills on sides
    [0,0,1,1,2,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0],
    [0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    // Row 3-5: Green center elevated, hills continue
    [0,0,1,1,2,2,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
    // Row 6-8: Transition slope, hills taper off
    [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    // Row 9-14: Water below ground, small hill on right
    [0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    // Row 15-20: Rolling hills on left side
    [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    // Row 21-26: Hill on right side near bunkers
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    // Row 27-32: Gentle hill near tee on left
    [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    // Row 33-37: Tee area
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  obstacles: [
    // Trees on left hills near green (rows 0-5)
    { x: 4, y: 1, type: 2 },
    { x: 6, y: 2, type: 1 },
    { x: 5, y: 4, type: 2 },
    // Trees on right hills near green
    { x: 41, y: 1, type: 1 },
    { x: 43, y: 2, type: 2 },
    { x: 42, y: 4, type: 1 },
    // Trees on right hill near water (rows 10-14)
    { x: 36, y: 11, type: 2 },
    { x: 38, y: 12, type: 1 },
    { x: 37, y: 13, type: 2 },
    // Trees on left rolling hills (rows 15-20)
    { x: 4, y: 16, type: 1 },
    { x: 5, y: 17, type: 2 },
    { x: 6, y: 18, type: 1 },
    { x: 4, y: 19, type: 2 },
    // Trees on right hill (rows 21-26)
    { x: 36, y: 22, type: 2 },
    { x: 37, y: 23, type: 1 },
    { x: 38, y: 24, type: 2 },
    { x: 36, y: 25, type: 1 },
    // Trees on left hill near tee (rows 27-32)
    { x: 6, y: 28, type: 1 },
    { x: 7, y: 29, type: 2 },
    { x: 6, y: 30, type: 1 },
    { x: 7, y: 31, type: 2 },
  ]
};


export function getObstacleTexture(type: ObstacleType): string | null {
  switch (type) {
    case 'tree': return 'iso_tree';
    case 'pine_tree': return 'iso_pine_tree';
    case 'shrub': return 'iso_shrub';
    case 'bush': return 'iso_bush';
    default: return null;
  }
}

export const REFILL_STATIONS = [
  { x: 24, y: 35 },
  { x: 10, y: 20 }
];
