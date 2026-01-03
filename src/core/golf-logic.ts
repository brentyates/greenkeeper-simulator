/**
 * Golf-specific logic and data structures
 * Handles pin positions, tee boxes, hole layouts, and yardage calculations
 */

export interface PinPosition {
  x: number;
  y: number;
  elevation: number;
}

export interface TeeBox {
  name: string;
  x: number;
  y: number;
  elevation: number;
  yardage: number;
  par: number;
}

export interface GreenInfo {
  frontEdge: { x: number; y: number };
  center: { x: number; y: number };
  backEdge: { x: number; y: number };
}

export interface HoleLayoutPoint {
  x: number;
  y: number;
  description: string;
}

export interface HoleData {
  holeNumber: number;
  par: number;
  teeBoxes: TeeBox[];
  pinPosition: PinPosition;
  green: GreenInfo;
  idealPath: HoleLayoutPoint[];
  hazards?: Array<{
    type: "water" | "bunker";
    name: string;
    positions: Array<{ x: number; y: number }>;
  }>;
}

/**
 * Calculate the Euclidean distance between two points in grid coordinates
 */
export function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance accounting for elevation changes
 */
export function calculate3DDistance(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convert grid distance to yards
 * Assumes 1 grid unit = 2 yards (configurable)
 */
export function gridToYards(gridDistance: number, yardsPerGrid: number = 2): number {
  return Math.round(gridDistance * yardsPerGrid);
}

/**
 * Calculate yardage from a position to the pin
 */
export function getYardageToPin(
  fromX: number,
  fromY: number,
  fromElevation: number,
  pinPosition: PinPosition,
  yardsPerGrid: number = 2
): number {
  const distance = calculate3DDistance(
    fromX,
    fromY,
    fromElevation,
    pinPosition.x,
    pinPosition.y,
    pinPosition.elevation
  );
  return gridToYards(distance, yardsPerGrid);
}

/**
 * Calculate yardage to front, center, and back of green
 */
export function getYardagesToGreen(
  fromX: number,
  fromY: number,
  fromElevation: number,
  green: GreenInfo,
  pinElevation: number,
  yardsPerGrid: number = 2
): { front: number; center: number; back: number } {
  const frontDist = calculate3DDistance(
    fromX,
    fromY,
    fromElevation,
    green.frontEdge.x,
    green.frontEdge.y,
    pinElevation
  );
  const centerDist = calculate3DDistance(
    fromX,
    fromY,
    fromElevation,
    green.center.x,
    green.center.y,
    pinElevation
  );
  const backDist = calculate3DDistance(
    fromX,
    fromY,
    fromElevation,
    green.backEdge.x,
    green.backEdge.y,
    pinElevation
  );

  return {
    front: gridToYards(frontDist, yardsPerGrid),
    center: gridToYards(centerDist, yardsPerGrid),
    back: gridToYards(backDist, yardsPerGrid),
  };
}

/**
 * Get the active tee box for a player based on skill level or preference
 */
export function getActiveTeeBox(
  teeBoxes: TeeBox[],
  preference: "championship" | "back" | "middle" | "forward" = "middle"
): TeeBox {
  const sortedByYardage = [...teeBoxes].sort((a, b) => b.yardage - a.yardage);

  switch (preference) {
    case "championship":
      return sortedByYardage[0];
    case "back":
      return sortedByYardage[Math.min(1, sortedByYardage.length - 1)];
    case "forward":
      return sortedByYardage[sortedByYardage.length - 1];
    case "middle":
    default:
      return sortedByYardage[Math.floor(sortedByYardage.length / 2)];
  }
}

/**
 * Calculate the ideal club distance for reaching the pin
 * Accounts for elevation change
 */
export function calculateClubDistance(
  yardageToPin: number,
  elevationChange: number
): number {
  const elevationAdjustment = elevationChange * 1.5;
  return Math.round(yardageToPin + elevationAdjustment);
}

/**
 * Determine if a position is on the green
 */
export function isOnGreen(
  x: number,
  y: number,
  green: GreenInfo,
  tolerance: number = 15
): boolean {
  const distToCenter = calculateDistance(x, y, green.center.x, green.center.y);
  return distToCenter <= tolerance;
}

/**
 * Calculate the approach angle to the green
 * Returns angle in degrees (0 = straight on, 90 = perpendicular)
 */
export function getApproachAngle(
  fromX: number,
  fromY: number,
  green: GreenInfo
): number {
  const toCenter = {
    x: green.center.x - fromX,
    y: green.center.y - fromY,
  };

  const greenOrientation = {
    x: green.backEdge.x - green.frontEdge.x,
    y: green.backEdge.y - green.frontEdge.y,
  };

  const dot =
    toCenter.x * greenOrientation.x + toCenter.y * greenOrientation.y;
  const magTo = Math.sqrt(toCenter.x ** 2 + toCenter.y ** 2);
  const magGreen = Math.sqrt(
    greenOrientation.x ** 2 + greenOrientation.y ** 2
  );

  if (magTo === 0 || magGreen === 0) return 0;

  const cosAngle = dot / (magTo * magGreen);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  return (angle * 180) / Math.PI;
}

/**
 * Get the direction from one point to another in degrees
 * 0° = North, 90° = East, 180° = South, 270° = West
 */
export function getDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const radians = Math.atan2(dy, dx);
  let degrees = (radians * 180) / Math.PI;
  degrees = (degrees + 90) % 360;
  if (degrees < 0) degrees += 360;
  return degrees;
}

/**
 * Get compass direction as a string
 */
export function getCompassDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Calculate par for a hole based on yardage (standard golf formula)
 */
export function calculateParFromYardage(yardage: number): number {
  if (yardage < 250) return 3;
  if (yardage < 470) return 4;
  return 5;
}

/**
 * Validate that hole data is consistent
 */
export function validateHoleData(hole: HoleData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (hole.teeBoxes.length === 0) {
    errors.push("Hole must have at least one tee box");
  }

  if (hole.par < 3 || hole.par > 5) {
    errors.push("Par must be between 3 and 5");
  }

  hole.teeBoxes.forEach((tee) => {
    if (tee.par !== hole.par) {
      errors.push(`Tee box ${tee.name} has par ${tee.par}, expected ${hole.par}`);
    }
  });

  if (hole.idealPath.length < 2) {
    errors.push("Ideal path must have at least 2 points (tee to green)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
