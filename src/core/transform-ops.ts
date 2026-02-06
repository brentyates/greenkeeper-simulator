import { Vec3 } from './mesh-topology';

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function rotateAroundPivot(
  position: Vec3,
  pivot: Vec3,
  angleX: number,
  angleY: number,
  angleZ: number
): Vec3 {
  let x = position.x - pivot.x;
  let y = position.y - pivot.y;
  let z = position.z - pivot.z;

  if (angleX !== 0) {
    const cos = Math.cos(angleX);
    const sin = Math.sin(angleX);
    const ny = y * cos - z * sin;
    const nz = y * sin + z * cos;
    y = ny;
    z = nz;
  }

  if (angleY !== 0) {
    const cos = Math.cos(angleY);
    const sin = Math.sin(angleY);
    const nx = x * cos + z * sin;
    const nz = -x * sin + z * cos;
    x = nx;
    z = nz;
  }

  if (angleZ !== 0) {
    const cos = Math.cos(angleZ);
    const sin = Math.sin(angleZ);
    const nx = x * cos - y * sin;
    const ny = x * sin + y * cos;
    x = nx;
    y = ny;
  }

  return {
    x: x + pivot.x,
    y: y + pivot.y,
    z: z + pivot.z,
  };
}
