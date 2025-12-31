export type TerrainType = 'fairway' | 'rough' | 'green' | 'bunker' | 'water';

export interface CourseData {
  name: string;
  width: number;
  height: number;
  par: number;
  layout: number[][];
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
  ]
};

export function getTerrainType(code: number): TerrainType {
  switch (code) {
    case 0: return 'fairway';
    case 1: return 'rough';
    case 2: return 'green';
    case 3: return 'bunker';
    case 4: return 'water';
    default: return 'rough';
  }
}

export const REFILL_STATIONS = [
  { x: 24, y: 35 },
  { x: 10, y: 20 }
];
