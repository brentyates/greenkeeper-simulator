import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { GolferPoolState, Golfer, GolferStatus } from "../../core/golfers";
import { gridTo3D } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import {
  EntityVisualState,
  ElevationProvider,
  EntityAppearance,
  createEntityMesh,
  disposeEntityMesh,
} from "./EntityVisualSystem";

const GOLFER_MALE_APPEARANCE: EntityAppearance = {
  assetId: "character.golfer.male",
  scale: 1.4,
};

const GOLFER_FEMALE_APPEARANCE: EntityAppearance = {
  assetId: "character.golfer.female",
  scale: 1.4,
};

const STATUS_MARKER_COLORS: Record<GolferStatus, Color3> = {
  arriving: new Color3(0.95, 0.85, 0.3),
  checking_in: new Color3(0.95, 0.65, 0.2),
  playing: new Color3(0.3, 0.85, 0.4),
  finishing: new Color3(0.5, 0.7, 0.95),
  leaving: new Color3(0.7, 0.7, 0.75),
};

const MOOD_COLORS: [Color3, Color3, Color3] = [
  new Color3(0.9, 0.2, 0.15),
  new Color3(0.95, 0.85, 0.2),
  new Color3(0.2, 0.85, 0.3),
];
const MOOD_SPHERE_Y = 3.2;
const MOOD_SPHERE_RADIUS = 0.22;

function satisfactionTier(satisfaction: number): number {
  if (satisfaction > 70) return 2;
  if (satisfaction >= 40) return 1;
  return 0;
}

const BASE_WALK_SPEED = 3.5;
const BETWEEN_HOLES_SPEED_MULT = 1.8;
const NEAR_GREEN_SLOW_MULT = 0.4;
const CLUBHOUSE_MILL_RADIUS = 2.5;

interface GolferMeshGroup extends EntityVisualState {
  markerMesh: Mesh;
  markerMaterial: StandardMaterial;
  moodMesh: Mesh;
  moodMaterial: StandardMaterial;
  lastSatisfactionTier: number;
  currentWorldX: number;
  currentWorldZ: number;
  targetWorldX: number;
  targetWorldZ: number;
  lastStatus: GolferStatus;
  randomOffsetX: number;
  randomOffsetZ: number;
  walkSpeedMult: number;
  groupId: number;
  millPhase: number;
}

interface HoleWaypoint {
  teeX: number;
  teeZ: number;
  greenX: number;
  greenZ: number;
}

interface CoursePath {
  clubhouseX: number;
  clubhouseZ: number;
  holes: HoleWaypoint[];
  segmentLengths: number[];
  totalLength: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function segDist(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

function computeSegments(
  clubX: number,
  clubZ: number,
  holes: HoleWaypoint[]
): { segmentLengths: number[]; totalLength: number } {
  const segments: number[] = [];
  let totalLength = 0;

  segments.push(segDist(clubX, clubZ, holes[0].teeX, holes[0].teeZ));
  totalLength += segments[segments.length - 1];

  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    segments.push(segDist(h.teeX, h.teeZ, h.greenX, h.greenZ));
    totalLength += segments[segments.length - 1];

    if (i < holes.length - 1) {
      const next = holes[i + 1];
      segments.push(segDist(h.greenX, h.greenZ, next.teeX, next.teeZ));
      totalLength += segments[segments.length - 1];
    }
  }

  const last = holes[holes.length - 1];
  segments.push(segDist(last.greenX, last.greenZ, clubX, clubZ));
  totalLength += segments[segments.length - 1];

  return { segmentLengths: segments, totalLength };
}

function buildCoursePathFromData(course: CourseData): CoursePath | null {
  const holes: HoleWaypoint[] = [];

  if (course.holes && course.holes.length > 0) {
    for (const hole of course.holes) {
      if (!hole.playable) continue;
      const tee = hole.teeBoxes[0];
      const pin = hole.pinPositions.find(p => p.isPrimary) ?? hole.pinPositions[0];
      if (!tee || !pin) continue;
      holes.push({ teeX: tee.x, teeZ: tee.z, greenX: pin.x, greenZ: pin.z });
    }
  }

  if (holes.length === 0 && course.layout) {
    const teesByHole = new Map<number, { x: number; z: number }>();
    const greensByHole = new Map<number, { x: number; z: number }>();

    for (const feature of course.layout.features) {
      if (feature.terrainCode === 5) {
        teesByHole.set(feature.holeNumber, feature.center);
      } else if (feature.terrainCode === 2) {
        greensByHole.set(feature.holeNumber, feature.center);
      }
    }

    const holeNumbers = Array.from(
      new Set([...teesByHole.keys(), ...greensByHole.keys()])
    ).sort((a, b) => a - b);

    for (const num of holeNumbers) {
      const tee = teesByHole.get(num);
      const green = greensByHole.get(num);
      if (tee && green) {
        holes.push({ teeX: tee.x, teeZ: tee.z, greenX: green.x, greenZ: green.z });
      }
    }
  }

  if (holes.length === 0) return null;

  const maxZ = Math.max(
    ...holes.map(h => Math.max(h.teeZ, h.greenZ))
  );
  const clubhouseX = (holes[0].teeX + holes[holes.length - 1].greenX) / 2;
  const clubhouseZ = Math.min(maxZ + 8, course.height - 2);

  const { segmentLengths, totalLength } = computeSegments(clubhouseX, clubhouseZ, holes);

  return { clubhouseX, clubhouseZ, holes, segmentLengths, totalLength };
}

function buildFallbackPath(courseWidth: number, courseHeight: number): CoursePath {
  const clubhouseX = courseWidth * 0.5;
  const clubhouseZ = courseHeight * 0.85;

  const holes: HoleWaypoint[] = [];
  const cx = courseWidth * 0.5;
  const cy = courseHeight * 0.45;
  const rx = courseWidth * 0.3;
  const ry = courseHeight * 0.3;

  for (let i = 0; i < 9; i++) {
    const teeAngle = (i / 9) * Math.PI * 2 - Math.PI / 2;
    const greenAngle = ((i + 0.5) / 9) * Math.PI * 2 - Math.PI / 2;
    holes.push({
      teeX: cx + Math.cos(teeAngle) * rx * 0.85,
      teeZ: cy + Math.sin(teeAngle) * ry * 0.85,
      greenX: cx + Math.cos(greenAngle) * rx,
      greenZ: cy + Math.sin(greenAngle) * ry,
    });
  }

  const { segmentLengths, totalLength } = computeSegments(clubhouseX, clubhouseZ, holes);

  return { clubhouseX, clubhouseZ, holes, segmentLengths, totalLength };
}

function getPositionAlongPath(
  path: CoursePath,
  progress: number
): { x: number; z: number; isOnGreen: boolean; isBetweenHoles: boolean } {
  const t = Math.max(0, Math.min(1, progress));
  const targetDist = t * path.totalLength;

  const waypoints: Array<{ x: number; z: number }> = [];
  waypoints.push({ x: path.clubhouseX, z: path.clubhouseZ });
  for (const h of path.holes) {
    waypoints.push({ x: h.teeX, z: h.teeZ });
    waypoints.push({ x: h.greenX, z: h.greenZ });
  }
  waypoints.push({ x: path.clubhouseX, z: path.clubhouseZ });

  let accumulated = 0;
  for (let segIdx = 0; segIdx < path.segmentLengths.length; segIdx++) {
    const segLen = path.segmentLengths[segIdx];
    if (accumulated + segLen >= targetDist || segIdx === path.segmentLengths.length - 1) {
      const segProgress = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const a = waypoints[segIdx];
      const b = waypoints[segIdx + 1] ?? a;

      const isPlaySegment = segIdx >= 1 && segIdx < path.segmentLengths.length - 1;
      const isOnGreen = isPlaySegment && segIdx % 2 === 1 && segProgress > 0.8;
      const isBetweenHoles = isPlaySegment && segIdx % 2 === 0 && segIdx > 0;

      return {
        x: a.x + (b.x - a.x) * segProgress,
        z: a.z + (b.z - a.z) * segProgress,
        isOnGreen,
        isBetweenHoles,
      };
    }
    accumulated += segLen;
  }

  return { x: path.clubhouseX, z: path.clubhouseZ, isOnGreen: false, isBetweenHoles: false };
}

function holesPlayedToPathProgress(
  holesPlayed: number,
  totalHoles: number,
  pathHoleCount: number
): number {
  const effectiveTotal = Math.max(1, totalHoles);
  const fraction = holesPlayed / effectiveTotal;

  const totalSegments = 1 + pathHoleCount * 2 + 1;
  const startOffset = 1 / totalSegments;
  const endOffset = 1 - 1 / totalSegments;

  return startOffset + fraction * (endOffset - startOffset);
}

function getGolferTarget(
  golfer: Golfer,
  path: CoursePath,
  offsetX: number,
  offsetZ: number,
  millPhase: number,
  timeSeconds: number
): { x: number; z: number; speedMult: number } {
  switch (golfer.status) {
    case "arriving":
    case "checking_in": {
      const angle = millPhase + timeSeconds * 0.3;
      return {
        x: path.clubhouseX + Math.cos(angle) * CLUBHOUSE_MILL_RADIUS * 0.6 + offsetX * 1.5,
        z: path.clubhouseZ + Math.sin(angle) * CLUBHOUSE_MILL_RADIUS * 0.4 + offsetZ * 1.5,
        speedMult: 0.5,
      };
    }

    case "finishing": {
      const progress = holesPlayedToPathProgress(
        golfer.holesPlayed,
        golfer.totalHoles,
        path.holes.length
      );
      const pos = getPositionAlongPath(path, Math.min(progress + 0.02, 1));
      return {
        x: pos.x + offsetX,
        z: pos.z + offsetZ,
        speedMult: 1.0,
      };
    }

    case "leaving":
      return {
        x: path.clubhouseX + offsetX * 1.2,
        z: path.clubhouseZ + 3 + offsetZ,
        speedMult: 1.2,
      };

    case "playing": {
      const progress = holesPlayedToPathProgress(
        golfer.holesPlayed,
        golfer.totalHoles,
        path.holes.length
      );
      const pos = getPositionAlongPath(path, progress);

      let speedMult = 1.0;
      if (pos.isOnGreen) speedMult = NEAR_GREEN_SLOW_MULT;
      else if (pos.isBetweenHoles) speedMult = BETWEEN_HOLES_SPEED_MULT;

      return {
        x: pos.x + offsetX,
        z: pos.z + offsetZ,
        speedMult,
      };
    }
  }
}

export class GolferVisualSystem {
  private scene: Scene;
  private elevationProvider: ElevationProvider;
  private golferMeshes: Map<string, GolferMeshGroup> = new Map();
  private path: CoursePath;
  private golferIndex: number = 0;
  private elapsedSeconds: number = 0;

  constructor(
    scene: Scene,
    elevationProvider: ElevationProvider,
    courseWidth: number,
    courseHeight: number,
    course?: CourseData
  ) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;

    const coursePath = course ? buildCoursePathFromData(course) : null;
    this.path = coursePath ?? buildFallbackPath(courseWidth, courseHeight);
  }

  public update(golferPool: GolferPoolState, deltaMs: number): void {
    const currentIds = new Set(golferPool.golfers.map((g) => g.id));

    for (const [id, group] of this.golferMeshes) {
      if (!currentIds.has(id)) {
        this.disposeGolferMesh(group);
        this.golferMeshes.delete(id);
      }
    }

    const deltaSec = deltaMs / 1000;
    this.elapsedSeconds += deltaSec;

    for (const golfer of golferPool.golfers) {
      let group = this.golferMeshes.get(golfer.id);

      if (!group) {
        group = this.createGolferMesh(golfer);
        this.golferMeshes.set(golfer.id, group);
      }

      const target = getGolferTarget(
        golfer,
        this.path,
        group.randomOffsetX,
        group.randomOffsetZ,
        group.millPhase,
        this.elapsedSeconds
      );
      group.targetWorldX = target.x;
      group.targetWorldZ = target.z;

      const dx = group.targetWorldX - group.currentWorldX;
      const dz = group.targetWorldZ - group.currentWorldZ;
      const d = Math.sqrt(dx * dx + dz * dz);

      const speed = BASE_WALK_SPEED * group.walkSpeedMult * target.speedMult;

      if (d > 0.05) {
        const step = Math.min(1, speed * deltaSec / d);
        group.currentWorldX += dx * step;
        group.currentWorldZ += dz * step;

        if (group.rotatesWithMovement && group.meshInstance) {
          group.facingAngle = Math.atan2(dz, dx) + Math.PI / 2;
          group.meshInstance.root.rotation.y = group.facingAngle;
        }
      } else {
        group.currentWorldX = group.targetWorldX;
        group.currentWorldZ = group.targetWorldZ;
      }

      const elevation = this.elevationProvider.getElevationAt(
        group.currentWorldX,
        group.currentWorldZ,
        0
      );
      const worldPos = gridTo3D(group.currentWorldX, group.currentWorldZ, elevation);
      group.container.position.copyFrom(worldPos);

      if (group.lastStatus !== golfer.status) {
        group.lastStatus = golfer.status;
        const color = STATUS_MARKER_COLORS[golfer.status];
        group.markerMaterial.diffuseColor = color;
        group.markerMaterial.emissiveColor = color.scale(0.45);
      }

      const tier = satisfactionTier(golfer.satisfaction);
      if (tier !== group.lastSatisfactionTier) {
        group.lastSatisfactionTier = tier;
        const moodColor = MOOD_COLORS[tier];
        group.moodMaterial.diffuseColor = moodColor;
        group.moodMaterial.emissiveColor = moodColor;
      }
    }
  }

  private createGolferMesh(golfer: Golfer): GolferMeshGroup {
    this.golferIndex++;
    const isMale = this.golferIndex % 2 === 0;
    const appearance = isMale ? GOLFER_MALE_APPEARANCE : GOLFER_FEMALE_APPEARANCE;

    const seed = this.golferIndex;
    const randomOffsetX = (seededRandom(seed) - 0.5) * 1.2;
    const randomOffsetZ = (seededRandom(seed + 100) - 0.5) * 1.2;
    const walkSpeedMult = 0.85 + seededRandom(seed + 200) * 0.3;
    const groupId = Math.floor(this.golferIndex / 3);
    const millPhase = seededRandom(seed + 300) * Math.PI * 2;

    const target = getGolferTarget(
      golfer,
      this.path,
      randomOffsetX,
      randomOffsetZ,
      millPhase,
      this.elapsedSeconds
    );

    const baseState = createEntityMesh(
      this.scene,
      `golfer_${golfer.id}`,
      appearance,
      Math.floor(target.x),
      Math.floor(target.z),
      this.elevationProvider
    );

    const markerMaterial = new StandardMaterial(`golferMarkerMat_${golfer.id}`, this.scene);
    const color = STATUS_MARKER_COLORS[golfer.status];
    markerMaterial.diffuseColor = color;
    markerMaterial.emissiveColor = color.scale(0.45);
    markerMaterial.specularColor = new Color3(0, 0, 0);
    markerMaterial.alpha = 0.85;
    markerMaterial.disableLighting = true;

    const markerMesh = MeshBuilder.CreateDisc(`golferMarker_${golfer.id}`, {
      radius: 0.38,
      tessellation: 20,
    }, this.scene);
    markerMesh.rotation.x = Math.PI / 2;
    markerMesh.position.y = 0.05;
    markerMesh.parent = baseState.container;
    markerMesh.material = markerMaterial;
    markerMesh.isPickable = false;

    const initialTier = satisfactionTier(golfer.satisfaction);
    const moodColor = MOOD_COLORS[initialTier];

    const moodMaterial = new StandardMaterial(`golferMoodMat_${golfer.id}`, this.scene);
    moodMaterial.diffuseColor = moodColor;
    moodMaterial.emissiveColor = moodColor;
    moodMaterial.specularColor = new Color3(0, 0, 0);
    moodMaterial.disableLighting = true;

    const moodMesh = MeshBuilder.CreateSphere(`golferMood_${golfer.id}`, {
      diameter: MOOD_SPHERE_RADIUS * 2,
      segments: 8,
    }, this.scene);
    moodMesh.position.y = MOOD_SPHERE_Y;
    moodMesh.parent = baseState.container;
    moodMesh.material = moodMaterial;
    moodMesh.isPickable = false;
    moodMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    return {
      ...baseState,
      markerMesh,
      markerMaterial,
      moodMesh,
      moodMaterial,
      lastSatisfactionTier: initialTier,
      currentWorldX: target.x,
      currentWorldZ: target.z,
      targetWorldX: target.x,
      targetWorldZ: target.z,
      lastStatus: golfer.status,
      randomOffsetX,
      randomOffsetZ,
      walkSpeedMult,
      groupId,
      millPhase,
    };
  }

  private disposeGolferMesh(group: GolferMeshGroup): void {
    group.moodMaterial.dispose();
    group.moodMesh.dispose();
    group.markerMaterial.dispose();
    group.markerMesh.dispose();
    disposeEntityMesh(group);
  }

  public getGolferCount(): number {
    return this.golferMeshes.size;
  }

  public getGolferPositions(): { golferId: string; worldX: number; worldZ: number }[] {
    const positions: { golferId: string; worldX: number; worldZ: number }[] = [];
    for (const [id, group] of this.golferMeshes) {
      positions.push({ golferId: id, worldX: group.currentWorldX, worldZ: group.currentWorldZ });
    }
    return positions;
  }

  public setVisible(visible: boolean): void {
    for (const group of this.golferMeshes.values()) {
      group.container.setEnabled(visible);
      group.markerMesh.isVisible = visible;
      group.moodMesh.isVisible = visible;
    }
  }

  public dispose(): void {
    for (const group of this.golferMeshes.values()) {
      this.disposeGolferMesh(group);
    }
    this.golferMeshes.clear();
  }
}
