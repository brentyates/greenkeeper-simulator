import { CourseData, ObstacleData } from './courseData';
import { ScenarioDefinition } from './scenarioData';

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
  layout: number[][];
  vertexElevations: number[][];
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
  return raw ? JSON.parse(raw) : null;
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
    layout: course.layout,
    vertexElevations: course.vertexElevations,
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

  const layout: number[][] = [];
  for (let y = 0; y < height; y++) {
    layout.push(new Array(width).fill(1)); // 1 = Rough
  }

  const vertexElevations: number[][] = [];
  for (let vy = 0; vy < vertexHeight; vy++) {
    vertexElevations.push(new Array(vertexWidth).fill(0));
  }

  return {
    id: `custom_${Date.now()}`,
    name,
    width,
    height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    layout,
    vertexElevations,
    placedAssets: [],
    obstacles: [],
  };
}
