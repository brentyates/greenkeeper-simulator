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
    [0,0,1,2,2,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,2,3,3,2,2,1,0,0,0,0,0],
    [0,0,1,2,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,2,3,3,3,2,1,0,0,0,0,0],
    // Row 3-5: Green center elevated, hills continue
    [0,0,1,1,2,3,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,2,3,2,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
    // Row 6-8: Transition slope, hills taper off
    [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    // Row 9-14: Water below ground, hill on right, FAIRWAY HILL in middle
    [0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,1,1,2,2,3,2,2,1,1,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,0,0,0,1,1,2,2,3,2,2,1,1,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    // Row 15-20: Rolling hills on left side, depression on right side
    [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0],
    [0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-2,-1,-1,0,0,0,0,0],
    [0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-2,-2,-2,-1,0,0,0,0,0],
    [0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-2,-2,-2,-1,0,0,0,0,0],
    [0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-2,-1,-1,0,0,0,0,0],
    [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0],
    // Row 21-26: Hill on right side near bunkers, fairway mound
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    // Row 27-32: Gentle hill near tee on left, rise on right, valley in middle
    [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-2,-1,-1,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,2,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-2,-2,-2,-1,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,2,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-2,-2,-2,-1,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-2,-1,-1,0,0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    // Row 33-37: Tee area with slight depression
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
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


// 3-hole beginner course - "Pine Valley Starter"
export const COURSE_3_HOLE: CourseData = {
  name: 'Pine Valley Starter',
  width: 30,
  height: 50,
  par: 12, // 3 holes: Par 4, Par 3, Par 5
  layout: Array(50).fill(null).map(() => Array(30).fill(R)),
  elevation: Array(50).fill(null).map(() => Array(30).fill(0)),
  obstacles: []
};

// Initialize 3-hole layout
for (let y = 0; y < 50; y++) {
  for (let x = 0; x < 30; x++) {
    // Hole 1 (Par 4): Rows 0-15
    if (y < 3 && x >= 12 && x <= 18) {
      COURSE_3_HOLE.layout[y][x] = G; // Green
    } else if (y >= 3 && y < 15 && x >= 10 && x <= 20) {
      COURSE_3_HOLE.layout[y][x] = F; // Fairway
    } else if (y >= 5 && y < 8 && x >= 4 && x <= 7) {
      COURSE_3_HOLE.layout[y][x] = W; // Water hazard
    } else if (y === 10 && x >= 8 && x <= 9) {
      COURSE_3_HOLE.layout[y][x] = B; // Bunker
    }
    // Hole 2 (Par 3): Rows 18-28
    else if (y >= 18 && y < 21 && x >= 10 && x <= 16) {
      COURSE_3_HOLE.layout[y][x] = G; // Green
    } else if (y >= 21 && y < 28 && x >= 12 && x <= 18) {
      COURSE_3_HOLE.layout[y][x] = F; // Fairway
    } else if (y >= 22 && y < 24 && x >= 8 && x <= 10) {
      COURSE_3_HOLE.layout[y][x] = B; // Bunker
    }
    // Hole 3 (Par 5): Rows 31-49
    else if (y >= 31 && y < 34 && x >= 14 && x <= 20) {
      COURSE_3_HOLE.layout[y][x] = G; // Green
    } else if (y >= 34 && y < 49 && x >= 10 && x <= 22) {
      COURSE_3_HOLE.layout[y][x] = F; // Fairway
    } else if (y >= 38 && y < 42 && x >= 5 && x <= 8) {
      COURSE_3_HOLE.layout[y][x] = W; // Water
    } else if (y >= 40 && y < 42 && x >= 23 && x <= 25) {
      COURSE_3_HOLE.layout[y][x] = B; // Bunker
    }
  }
}

COURSE_3_HOLE.obstacles = [
  { x: 5, y: 10, type: 1 }, { x: 25, y: 12, type: 2 },
  { x: 8, y: 25, type: 2 }, { x: 20, y: 26, type: 1 },
  { x: 6, y: 40, type: 1 }, { x: 24, y: 42, type: 2 }
];

// 9-hole course - "Meadowbrook Nine"
export const COURSE_9_HOLE: CourseData = {
  name: 'Meadowbrook Nine',
  width: 60,
  height: 80,
  par: 36, // Standard 9-hole par
  layout: Array(80).fill(null).map(() => Array(60).fill(R)),
  elevation: Array(80).fill(null).map(() => Array(60).fill(0)),
  obstacles: []
};

// Initialize 9-hole layout with varied terrain
for (let y = 0; y < 80; y++) {
  for (let x = 0; x < 60; x++) {
    const holeNum = Math.floor(y / 9);
    const localY = y % 9;

    if (holeNum < 9) {
      const centerX = 30 + (holeNum % 3) * 10 - 10;
      const dist = Math.abs(x - centerX);

      if (localY < 2 && dist < 4) {
        COURSE_9_HOLE.layout[y][x] = G;
      } else if (localY >= 2 && dist < 8) {
        COURSE_9_HOLE.layout[y][x] = F;
      }

      // Add hazards every 3rd hole
      if (holeNum % 3 === 0 && localY === 5 && dist === 10) {
        COURSE_9_HOLE.layout[y][x] = W;
      }
      if (holeNum % 3 === 1 && localY === 4 && dist === 9) {
        COURSE_9_HOLE.layout[y][x] = B;
      }
    }
  }
}

// Add some elevation variety to 9-hole
for (let y = 10; y < 20; y++) {
  for (let x = 20; x < 40; x++) {
    COURSE_9_HOLE.elevation[y][x] = 2;
  }
}

COURSE_9_HOLE.obstacles = Array(20).fill(null).map((_, i) => ({
  x: 5 + (i % 6) * 10,
  y: 5 + Math.floor(i / 6) * 18,
  type: (i % 3) + 1
}));

// 18-hole championship course - "Royal Highlands"
export const COURSE_18_HOLE_CHAMPIONSHIP: CourseData = {
  name: 'Royal Highlands Championship',
  width: 90,
  height: 120,
  par: 72, // Championship par
  layout: Array(120).fill(null).map(() => Array(90).fill(R)),
  elevation: Array(120).fill(null).map(() => Array(90).fill(0)),
  obstacles: []
};

// Initialize championship 18-hole layout
for (let y = 0; y < 120; y++) {
  for (let x = 0; x < 90; x++) {
    const holeNum = Math.floor(y / 6.5);
    const localY = y % 7;

    if (holeNum < 18) {
      const centerX = 45 + Math.sin(holeNum * 0.5) * 20;
      const dist = Math.abs(x - centerX);

      if (localY < 1 && dist < 5) {
        COURSE_18_HOLE_CHAMPIONSHIP.layout[y][x] = G;
      } else if (localY >= 1 && dist < 12) {
        COURSE_18_HOLE_CHAMPIONSHIP.layout[y][x] = F;
      }

      // Water hazards on holes 3, 7, 12, 15
      if ([3, 7, 12, 15].includes(holeNum) && localY === 4 && dist > 15 && dist < 20) {
        COURSE_18_HOLE_CHAMPIONSHIP.layout[y][x] = W;
      }

      // Bunkers scattered around greens
      if (localY === 1 && dist >= 5 && dist < 7) {
        COURSE_18_HOLE_CHAMPIONSHIP.layout[y][x] = B;
      }
    }
  }
}

// Add varied elevation
for (let y = 0; y < 120; y++) {
  for (let x = 0; x < 90; x++) {
    const wave = Math.sin(x / 10) * Math.cos(y / 15);
    COURSE_18_HOLE_CHAMPIONSHIP.elevation[y][x] = Math.floor(wave * 3);
  }
}

COURSE_18_HOLE_CHAMPIONSHIP.obstacles = Array(40).fill(null).map((_, i) => ({
  x: 8 + (i % 8) * 11,
  y: 8 + Math.floor(i / 8) * 28,
  type: ((i % 4) === 0 ? 2 : 1) // Mix of pine and regular trees
}));

// 27-hole finale course - "Grand Summit Resort"
export const COURSE_27_HOLE: CourseData = {
  name: 'Grand Summit Resort',
  width: 100,
  height: 140,
  par: 108, // 27 holes
  layout: Array(140).fill(null).map(() => Array(100).fill(R)),
  elevation: Array(140).fill(null).map(() => Array(100).fill(0)),
  obstacles: []
};

// Initialize massive 27-hole layout
for (let y = 0; y < 140; y++) {
  for (let x = 0; x < 100; x++) {
    const holeNum = Math.floor(y / 5.2);
    const localY = y % 6;

    if (holeNum < 27) {
      const centerX = 50 + Math.sin(holeNum * 0.3) * 25;
      const dist = Math.abs(x - centerX);

      if (localY < 1 && dist < 6) {
        COURSE_27_HOLE.layout[y][x] = G;
      } else if (localY >= 1 && dist < 14) {
        COURSE_27_HOLE.layout[y][x] = F;
      }

      // Major water features on signature holes
      if ([5, 9, 14, 18, 23, 26].includes(holeNum) && localY === 3 && dist > 16 && dist < 22) {
        COURSE_27_HOLE.layout[y][x] = W;
      }

      // Strategic bunker placement
      if (localY === 2 && dist >= 6 && dist < 9 && holeNum % 2 === 0) {
        COURSE_27_HOLE.layout[y][x] = B;
      }
    }
  }
}

// Dramatic elevation changes
for (let y = 0; y < 140; y++) {
  for (let x = 0; x < 100; x++) {
    const mountainEffect = Math.sin(x / 8) * Math.cos(y / 12) * 4;
    const valleyEffect = Math.sin((x + 50) / 15) * 2;
    COURSE_27_HOLE.elevation[y][x] = Math.floor(mountainEffect + valleyEffect);
  }
}

COURSE_27_HOLE.obstacles = Array(60).fill(null).map((_, i) => ({
  x: 10 + (i % 10) * 9,
  y: 10 + Math.floor(i / 10) * 23,
  type: (i % 4) + 1 // All obstacle types
}));

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

// Course registry for easy access
export const ALL_COURSES = {
  '3_hole': COURSE_3_HOLE,
  '9_hole': COURSE_9_HOLE,
  '18_hole_original': COURSE_HOLE_1,
  '18_hole_championship': COURSE_18_HOLE_CHAMPIONSHIP,
  '27_hole': COURSE_27_HOLE,
} as const;

export type CourseId = keyof typeof ALL_COURSES;
