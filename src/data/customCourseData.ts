import { CourseData, ObstacleData } from './courseData';
import { ScenarioDefinition } from './scenarioData';
import { SerializedTopology, SerializedVertex, SerializedTriangle } from '../core/mesh-topology';

export interface PlacedAsset {
  assetId: string;
  x: number;
  y: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface CustomCourseData {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  topology: SerializedTopology;
  placedAssets: PlacedAsset[];
  obstacles: ObstacleData[];
}

const STORAGE_KEY = 'greenkeeper_custom_courses';

function getStorageIndex(): Record<string, boolean> {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function setStorageIndex(index: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

export function saveCustomCourse(course: CustomCourseData): void {
  course.updatedAt = Date.now();
  localStorage.setItem(`course_${course.id}`, JSON.stringify(course));
  const index = getStorageIndex();
  index[course.id] = true;
  setStorageIndex(index);
}

export function loadCustomCourse(id: string): CustomCourseData | null {
  const raw = localStorage.getItem(`course_${id}`);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed.topology) return null;
  return parsed;
}

export function listCustomCourses(): CustomCourseData[] {
  const index = getStorageIndex();
  const courses: CustomCourseData[] = [];
  for (const id of Object.keys(index)) {
    const course = loadCustomCourse(id);
    if (course) courses.push(course);
  }
  return courses.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteCustomCourse(id: string): void {
  localStorage.removeItem(`course_${id}`);
  const index = getStorageIndex();
  delete index[id];
  setStorageIndex(index);
}

export function customCourseToCourseData(course: CustomCourseData): CourseData {
  return {
    name: course.name,
    width: course.width,
    height: course.height,
    par: 3,
    topology: course.topology,
    obstacles: course.obstacles,
  };
}

export function createSandboxScenario(course: CustomCourseData): ScenarioDefinition {
  return {
    id: course.id,
    name: course.name,
    description: `Custom sandbox course: ${course.name}`,
    courseId: course.id as any,
    objective: {
      type: 'economic',
      targetProfit: 999999,
    },
    conditions: {
      startingCash: 100000,
      startingHealth: 80,
      timeLimitDays: 0,
    },
    difficulty: 'beginner',
    isSandbox: true,
  };
}

export function createBlankCourse(width: number, height: number, name: string): CustomCourseData {
  const MESH_RES = 2;
  const vw = width * MESH_RES + 1;
  const vh = height * MESH_RES + 1;

  const vertices: SerializedVertex[] = [];
  let nextId = 0;
  const idAt = (vx: number, vy: number) => vy * vw + vx;

  for (let vy = 0; vy < vh; vy++) {
    for (let vx = 0; vx < vw; vx++) {
      vertices.push({ id: nextId++, position: { x: vx / MESH_RES, y: 0, z: vy / MESH_RES } });
    }
  }

  const triangles: SerializedTriangle[] = [];
  let triId = 0;
  for (let gy = 0; gy < vh - 1; gy++) {
    for (let gx = 0; gx < vw - 1; gx++) {
      const tl = idAt(gx, gy);
      const tr = idAt(gx + 1, gy);
      const bl = idAt(gx, gy + 1);
      const br = idAt(gx + 1, gy + 1);
      triangles.push({ id: triId++, vertices: [tl, bl, tr], terrainCode: 1 });
      triangles.push({ id: triId++, vertices: [tr, bl, br], terrainCode: 1 });
    }
  }

  return {
    id: `custom_${Date.now()}`,
    name,
    width,
    height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    topology: { vertices, triangles, worldWidth: width, worldHeight: height },
    placedAssets: [],
    obstacles: [],
  };
}
