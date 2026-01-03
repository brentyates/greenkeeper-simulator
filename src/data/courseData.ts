import { TerrainType, ObstacleType } from '../core/terrain';
import { HoleData } from '../core/golf-logic';

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
  holeData?: HoleData;
  yardsPerGrid?: number;
}

const F = 0; // Fairway
const R = 1; // Rough
const G = 2; // Green
const B = 3; // Bunker
const W = 4; // Water
const T = 5; // Tee

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
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,F,T,T,T,T,T,T,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,T,T,T,T,T,T,T,T,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
    [R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,F,F,F,F,T,T,T,T,T,F,F,F,F,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R,R],
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
  ],
  yardsPerGrid: 2,
  holeData: {
    holeNumber: 1,
    par: 4,
    teeBoxes: [
      {
        name: 'Championship',
        x: 25,
        y: 34,
        elevation: -1,
        yardage: 410,
        par: 4,
      },
      {
        name: 'Back',
        x: 24,
        y: 34,
        elevation: -1,
        yardage: 385,
        par: 4,
      },
      {
        name: 'Middle',
        x: 25,
        y: 35,
        elevation: -1,
        yardage: 350,
        par: 4,
      },
      {
        name: 'Forward',
        x: 24,
        y: 35,
        elevation: 0,
        yardage: 310,
        par: 4,
      },
    ],
    pinPosition: {
      x: 25,
      y: 3,
      elevation: 1,
    },
    green: {
      frontEdge: { x: 25, y: 5 },
      center: { x: 25, y: 3 },
      backEdge: { x: 25, y: 1 },
    },
    idealPath: [
      { x: 25, y: 34, description: 'Tee shot' },
      { x: 24, y: 25, description: 'Landing zone - avoid water left' },
      { x: 24, y: 15, description: 'Lay-up position' },
      { x: 25, y: 6, description: 'Approach to green' },
      { x: 25, y: 3, description: 'Pin position' },
    ],
    hazards: [
      {
        type: 'water',
        name: 'Left pond',
        positions: [
          { x: 13, y: 9 },
          { x: 14, y: 9 },
          { x: 15, y: 9 },
          { x: 12, y: 10 },
          { x: 13, y: 10 },
          { x: 14, y: 10 },
          { x: 15, y: 10 },
          { x: 16, y: 10 },
          { x: 12, y: 11 },
          { x: 13, y: 11 },
          { x: 14, y: 11 },
          { x: 15, y: 11 },
          { x: 16, y: 11 },
          { x: 12, y: 12 },
          { x: 13, y: 12 },
          { x: 14, y: 12 },
          { x: 15, y: 12 },
          { x: 16, y: 12 },
          { x: 13, y: 13 },
          { x: 14, y: 13 },
          { x: 15, y: 13 },
        ],
      },
      {
        type: 'bunker',
        name: 'Green side bunkers',
        positions: [
          { x: 18, y: 3 },
          { x: 18, y: 4 },
          { x: 31, y: 3 },
          { x: 31, y: 4 },
        ],
      },
      {
        type: 'bunker',
        name: 'Fairway bunkers right',
        positions: [
          { x: 32, y: 10 },
          { x: 33, y: 10 },
          { x: 32, y: 11 },
          { x: 33, y: 11 },
        ],
      },
    ],
  },
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
