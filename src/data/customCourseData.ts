import { CourseData, ObstacleData } from './courseData';
import { ScenarioDefinition } from './scenarioData';
import { SerializedTopology, gridToTopology, serializeTopology, Vec3 } from '../core/mesh-topology';

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
    yardsPerGrid: 20,
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
  const vertexWidth = width * MESH_RES + 1;
  const vertexHeight = height * MESH_RES + 1;

  const positions: Vec3[][] = [];
  for (let vy = 0; vy < vertexHeight; vy++) {
    positions[vy] = [];
    for (let vx = 0; vx < vertexWidth; vx++) {
      positions[vy][vx] = { x: vx / MESH_RES, y: 0, z: vy / MESH_RES };
    }
  }

  const topology = gridToTopology(positions, width, height);
  for (const [, tri] of topology.triangles) {
    tri.terrainCode = 1;
  }

  return {
    id: `custom_${Date.now()}`,
    name,
    width,
    height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    topology: serializeTopology(topology),
    placedAssets: [],
    obstacles: [],
  };
}
