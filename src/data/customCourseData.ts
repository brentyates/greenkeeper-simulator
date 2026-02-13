import { CourseData, ObstacleData } from './courseData';
import { ScenarioDefinition } from './scenarioData';
import { SerializedTopology, SerializedVertex, SerializedTriangle } from '../core/mesh-topology';
import {
  buildHoleDefinitionsFromAssets,
  calculateCoursePar,
  syncHoleFeatureAssignments,
  type CourseHoleDefinition,
  type PlaceableHoleAsset,
  type HoleTeeSet,
} from '../core/hole-construction';

export interface PlacedAsset extends PlaceableHoleAsset {}

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
  holes: CourseHoleDefinition[];
}

const STORAGE_KEY = 'greenkeeper_custom_courses';
const VALID_TEE_SETS: ReadonlySet<HoleTeeSet> = new Set([
  'championship',
  'middle',
  'forward',
  'senior',
  'custom',
]);

function getStorageIndex(): Record<string, boolean> {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function setStorageIndex(index: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  return rotations.includes(value as 0 | 90 | 180 | 270)
    ? (value as 0 | 90 | 180 | 270)
    : 0;
}

function normalizePlacedAsset(raw: unknown): PlacedAsset | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.assetId !== 'string') return null;
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number' || typeof candidate.z !== 'number') {
    return null;
  }

  const normalized: PlacedAsset = {
    assetId: candidate.assetId,
    x: candidate.x,
    y: candidate.y,
    z: candidate.z,
    rotation: normalizeRotation(candidate.rotation),
  };

  const gameplay = candidate.gameplay;
  if (gameplay && typeof gameplay === 'object') {
    const feature = (gameplay as Record<string, unknown>).holeFeature;
    if (feature && typeof feature === 'object') {
      const featureObj = feature as Record<string, unknown>;
      if (
        (featureObj.kind === 'tee_box' || featureObj.kind === 'pin_position') &&
        typeof featureObj.holeNumber === 'number'
      ) {
        normalized.gameplay = {
          holeFeature: {
            kind: featureObj.kind,
            holeNumber: featureObj.holeNumber,
            teeSet: (
              typeof featureObj.teeSet === 'string' &&
              VALID_TEE_SETS.has(featureObj.teeSet as HoleTeeSet)
            ) ? featureObj.teeSet as HoleTeeSet : undefined,
          },
        };
      }
    }
  }

  return normalized;
}

function deriveHoleData(placedAssets: PlacedAsset[]): {
  normalizedAssets: PlacedAsset[];
  holes: CourseHoleDefinition[];
} {
  const normalizedAssets = syncHoleFeatureAssignments(placedAssets);
  const holes = buildHoleDefinitionsFromAssets(normalizedAssets);
  return { normalizedAssets, holes };
}

export function saveCustomCourse(course: CustomCourseData): void {
  const { normalizedAssets, holes } = deriveHoleData(course.placedAssets);
  course.placedAssets = normalizedAssets;
  course.holes = holes;
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

  const placedAssetsRaw: unknown[] = Array.isArray(parsed.placedAssets) ? parsed.placedAssets : [];
  const placedAssets = placedAssetsRaw
    .map((asset: unknown) => normalizePlacedAsset(asset))
    .filter((asset: PlacedAsset | null): asset is PlacedAsset => asset !== null);
  const { normalizedAssets, holes } = deriveHoleData(placedAssets);

  const loaded: CustomCourseData = {
    ...parsed,
    placedAssets: normalizedAssets,
    obstacles: Array.isArray(parsed.obstacles) ? parsed.obstacles : [],
    holes,
  };

  return loaded;
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
  const par = calculateCoursePar(course.holes);
  return {
    name: course.name,
    width: course.width,
    height: course.height,
    par: par > 0 ? par : 3,
    topology: course.topology,
    obstacles: course.obstacles,
    holes: course.holes,
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
    holes: [],
  };
}
