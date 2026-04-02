import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  loadAsset,
  createInstance,
  disposeInstance,
  AssetInstance,
  AssetId,
} from "../assets/AssetLoader";
import { HEIGHT_UNIT } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import { TerrainMeshSystem } from "./TerrainMeshSystem";
import { TERRAIN_CODES } from "../../core/terrain";

interface SceneryPlacement {
  assetId: AssetId;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface SceneryInspectable {
  assetId: AssetId;
  x: number;
  y: number;
  z: number;
  rotation: 0 | 90 | 180 | 270;
  scale: number;
}

export interface ClubhouseAreaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const TREE_ASSETS: AssetId[] = [
  "tree.pine.small",
  "tree.pine.medium",
  "tree.pine.large",
  "tree.oak.small",
  "tree.oak.medium",
  "tree.maple.small",
  "tree.maple.medium",
  "tree.birch",
  "tree.cypress",
];

const FURNITURE_ASSETS: AssetId[] = [
  "amenity.bench",
  "amenity.trash.bin",
  "amenity.ball.washer",
  "amenity.drinking.fountain",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function isValidPlacement(
  x: number,
  z: number,
  existing: Array<{ x: number; z: number }>,
  minDist: number
): boolean {
  for (const p of existing) {
    const dx = p.x - x;
    const dz = p.z - z;
    if (dx * dx + dz * dz < minDist * minDist) return false;
  }
  return true;
}

const CLUBHOUSE_AMENITY_ASSETS: AssetId[] = [
  "amenity.bench",
  "amenity.bench",
  "amenity.trash.bin",
  "amenity.drinking.fountain",
  "flower.planter",
  "flower.planter",
];

export class CourseScenerySystem {
  private scene: Scene;
  private instances: AssetInstance[] = [];
  private placements: SceneryInspectable[] = [];
  private clubhousePos: { x: number; z: number } | null = null;
  private clubhouseAreaBounds: ClubhouseAreaBounds | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getClubhousePosition(): { x: number; z: number } | null {
    return this.clubhousePos;
  }

  public getClubhouseAreaBounds(): ClubhouseAreaBounds | null {
    return this.clubhouseAreaBounds;
  }

  public getInspectablePlacements(): readonly SceneryInspectable[] {
    return this.placements;
  }

  public async populate(
    courseData: CourseData,
    terrainSystem: TerrainMeshSystem
  ): Promise<void> {
    this.dispose();

    const placements = this.generatePlacements(courseData, terrainSystem);
    this.placements = placements.map((placement) => ({
      assetId: placement.assetId,
      x: placement.x,
      y: terrainSystem.getElevationAt(placement.x, placement.z, 0) * HEIGHT_UNIT,
      z: placement.z,
      rotation: normalizeRotationDegrees((placement.rotationY * 180) / Math.PI),
      scale: placement.scale,
    }));
    await this.instantiatePlacements(placements, terrainSystem);
  }

  private generatePlacements(
    courseData: CourseData,
    terrainSystem: TerrainMeshSystem
  ): SceneryPlacement[] {
    const placements: SceneryPlacement[] = [];
    const rng = seededRandom(courseData.width * 1000 + courseData.height);
    const occupied: Array<{ x: number; z: number }> = [];

    this.generateTreePlacements(courseData, terrainSystem, rng, placements, occupied);
    this.generateBuildingPlacements(courseData, terrainSystem, rng, placements, occupied);
    this.generateFurniturePlacements(courseData, terrainSystem, rng, placements, occupied);
    this.generateFlagPlacements(courseData, terrainSystem, placements, occupied);

    return placements;
  }

  private generateTreePlacements(
    courseData: CourseData,
    terrainSystem: TerrainMeshSystem,
    rng: () => number,
    placements: SceneryPlacement[],
    occupied: Array<{ x: number; z: number }>
  ): void {
    const { width, height } = courseData;
    const area = width * height;
    const targetCount = Math.min(60, Math.max(30, Math.floor(area / 20)));
    const margin = 1.5;

    let attempts = 0;
    const maxAttempts = targetCount * 10;

    while (placements.filter(p => TREE_ASSETS.includes(p.assetId)).length < targetCount && attempts < maxAttempts) {
      attempts++;

      const x = margin + rng() * (width - margin * 2);
      const z = margin + rng() * (height - margin * 2);

      const terrainType = terrainSystem.getTerrainTypeAt(x, z);
      if (terrainType !== "rough") continue;

      const nearFairway = this.isNearTerrainType(
        terrainSystem, x, z, [TERRAIN_CODES.FAIRWAY, TERRAIN_CODES.TEE], 4
      );
      if (!nearFairway) {
        if (rng() > 0.3) continue;
      }

      if (!isValidPlacement(x, z, occupied, 2.0)) continue;

      const assetId = TREE_ASSETS[Math.floor(rng() * TREE_ASSETS.length)];
      const scale = 0.8 + rng() * 0.4;
      const rotationY = rng() * Math.PI * 2;

      placements.push({ assetId, x, z, scale, rotationY });
      occupied.push({ x, z });

      if (rng() < 0.4 && placements.filter(p => TREE_ASSETS.includes(p.assetId)).length < targetCount) {
        const clusterCount = 1 + Math.floor(rng() * 3);
        for (let c = 0; c < clusterCount; c++) {
          const cx = x + (rng() - 0.5) * 4;
          const cz = z + (rng() - 0.5) * 4;

          if (cx < margin || cx > width - margin || cz < margin || cz > height - margin) continue;
          if (terrainSystem.getTerrainTypeAt(cx, cz) !== "rough") continue;
          if (!isValidPlacement(cx, cz, occupied, 1.5)) continue;

          const cAssetId = TREE_ASSETS[Math.floor(rng() * TREE_ASSETS.length)];
          placements.push({
            assetId: cAssetId,
            x: cx,
            z: cz,
            scale: 0.8 + rng() * 0.4,
            rotationY: rng() * Math.PI * 2,
          });
          occupied.push({ x: cx, z: cz });
        }
      }
    }
  }

  private findClubhousePosition(courseData: CourseData): { x: number; z: number; facingAngle: number } {
    const { width, height } = courseData;

    if (courseData.layout?.features) {
      const teeFeatures = courseData.layout.features
        .filter(f => f.terrainCode === TERRAIN_CODES.TEE && f.holeNumber === 1);
      if (teeFeatures.length > 0) {
        const tee = teeFeatures[0];
        const edgeZ = height;
        const clubX = Math.max(12, Math.min(width - 12, tee.center.x));
        const clubZ = Math.max(height * 0.8, Math.min(height - 6, (tee.center.z + edgeZ) / 2));
        const facingAngle = Math.atan2(tee.center.z - clubZ, tee.center.x - clubX);
        return { x: clubX, z: clubZ, facingAngle };
      }
    }

    return {
      x: Math.max(12, Math.min(width - 12, width * 0.25)),
      z: Math.max(6, Math.min(height - 6, height * 0.88)),
      facingAngle: -Math.PI / 2,
    };
  }

  private generateBuildingPlacements(
    courseData: CourseData,
    _terrainSystem: TerrainMeshSystem,
    rng: () => number,
    placements: SceneryPlacement[],
    occupied: Array<{ x: number; z: number }>
  ): void {
    const { width, height } = courseData;

    const clubhouse = this.findClubhousePosition(courseData);
    const clubScale = 0.5;

    this.clubhousePos = { x: clubhouse.x, z: clubhouse.z };
    const areaRadius = 8;
    this.clubhouseAreaBounds = {
      minX: clubhouse.x - areaRadius,
      maxX: clubhouse.x + areaRadius,
      minZ: clubhouse.z - areaRadius,
      maxZ: clubhouse.z + areaRadius,
    };

    placements.push({
      assetId: "building.clubhouse.medium",
      x: clubhouse.x,
      z: clubhouse.z,
      scale: clubScale,
      rotationY: clubhouse.facingAngle + Math.PI / 2,
    });
    occupied.push({ x: clubhouse.x, z: clubhouse.z });

    for (let i = 0; i < CLUBHOUSE_AMENITY_ASSETS.length; i++) {
      const angle = (i / CLUBHOUSE_AMENITY_ASSETS.length) * Math.PI * 2 + rng() * 0.4;
      const dist = 5 + rng() * 3;
      const ax = clubhouse.x + Math.cos(angle) * dist;
      const az = clubhouse.z + Math.sin(angle) * dist;
      if (ax < 2 || ax > width - 2 || az < 2 || az > height - 2) continue;
      if (!isValidPlacement(ax, az, occupied, 1.5)) continue;

      placements.push({
        assetId: CLUBHOUSE_AMENITY_ASSETS[i],
        x: ax,
        z: az,
        scale: 1.0,
        rotationY: angle + Math.PI,
      });
      occupied.push({ x: ax, z: az });
    }

    const cartPositions = [
      { angle: clubhouse.facingAngle + 0.8, dist: 6 },
      { angle: clubhouse.facingAngle + 1.2, dist: 7 },
      { angle: clubhouse.facingAngle - 0.8, dist: 6.5 },
    ];
    for (const cp of cartPositions) {
      const cx = clubhouse.x + Math.cos(cp.angle) * cp.dist;
      const cz = clubhouse.z + Math.sin(cp.angle) * cp.dist;
      if (cx < 2 || cx > width - 2 || cz < 2 || cz > height - 2) continue;
      if (!isValidPlacement(cx, cz, occupied, 2.0)) continue;

      placements.push({
        assetId: "vehicle.cart.golf",
        x: cx,
        z: cz,
        scale: 1.0,
        rotationY: cp.angle + Math.PI + (rng() - 0.5) * 0.3,
      });
      occupied.push({ x: cx, z: cz });
    }

  }

  private generateFurniturePlacements(
    courseData: CourseData,
    terrainSystem: TerrainMeshSystem,
    rng: () => number,
    placements: SceneryPlacement[],
    occupied: Array<{ x: number; z: number }>
  ): void {
    const { width, height } = courseData;
    const targetCount = Math.min(15, Math.max(5, Math.floor(width * height / 80)));
    let placed = 0;
    let attempts = 0;
    const maxAttempts = targetCount * 15;

    while (placed < targetCount && attempts < maxAttempts) {
      attempts++;

      const x = 2 + rng() * (width - 4);
      const z = 2 + rng() * (height - 4);

      const terrainType = terrainSystem.getTerrainTypeAt(x, z);
      if (terrainType !== "rough" && terrainType !== "fairway") continue;

      const nearFairway = this.isNearTerrainType(
        terrainSystem, x, z, [TERRAIN_CODES.FAIRWAY], 3
      );
      const nearRough = this.isNearTerrainType(
        terrainSystem, x, z, [TERRAIN_CODES.ROUGH], 3
      );
      if (!nearFairway || !nearRough) continue;

      if (!isValidPlacement(x, z, occupied, 3.0)) continue;

      const assetId = FURNITURE_ASSETS[Math.floor(rng() * FURNITURE_ASSETS.length)];
      placements.push({
        assetId,
        x,
        z,
        scale: 1.0,
        rotationY: rng() * Math.PI * 2,
      });
      occupied.push({ x, z });
      placed++;
    }
  }

  private generateFlagPlacements(
    courseData: CourseData,
    _terrainSystem: TerrainMeshSystem,
    placements: SceneryPlacement[],
    occupied: Array<{ x: number; z: number }>
  ): void {
    if (!courseData.layout) return;

    for (const feature of courseData.layout.features) {
      if (feature.terrainCode !== TERRAIN_CODES.GREEN) continue;

      const cx = feature.center.x;
      const cz = feature.center.z;

      if (isValidPlacement(cx, cz, occupied, 0.5)) {
        placements.push({
          assetId: "course.flag",
          x: cx,
          z: cz,
          scale: 1.0,
          rotationY: 0,
        });
        occupied.push({ x: cx, z: cz });
      }
    }
  }

  private isNearTerrainType(
    terrainSystem: TerrainMeshSystem,
    x: number,
    z: number,
    terrainCodes: number[],
    radius: number
  ): boolean {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const sx = x + Math.cos(angle) * radius;
      const sz = z + Math.sin(angle) * radius;
      const type = terrainSystem.getTerrainTypeAt(sx, sz);
      const code = TERRAIN_CODES[type.toUpperCase() as keyof typeof TERRAIN_CODES];
      if (code !== undefined && terrainCodes.includes(code)) return true;
    }
    return false;
  }

  private async instantiatePlacements(
    placements: SceneryPlacement[],
    terrainSystem: TerrainMeshSystem
  ): Promise<void> {
    const assetIds = [...new Set(placements.map(p => p.assetId))];

    const loadedAssets = new Map<AssetId, Awaited<ReturnType<typeof loadAsset>>>();
    await Promise.all(
      assetIds.map(async (id) => {
        const asset = await loadAsset(this.scene, id);
        loadedAssets.set(id, asset);
      })
    );

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const loaded = loadedAssets.get(p.assetId);
      if (!loaded) continue;

      const instance = createInstance(this.scene, loaded, `scenery_${i}`);
      const elevation = terrainSystem.getElevationAt(p.x, p.z, 0);
      instance.root.position = new Vector3(p.x, elevation * HEIGHT_UNIT, p.z);
      instance.root.scaling = new Vector3(p.scale, p.scale, p.scale);
      instance.root.rotation.y = p.rotationY;
      this.instances.push(instance);
    }
  }

  public getObjectCount(): number {
    return this.instances.length;
  }

  public snapToTerrain(terrainSystem: TerrainMeshSystem): void {
    for (const instance of this.instances) {
      const x = instance.root.position.x;
      const z = instance.root.position.z;
      const elevation = terrainSystem.getElevationAt(x, z, 0);
      instance.root.position.y = elevation * HEIGHT_UNIT;
    }
  }

  public dispose(): void {
    for (const instance of this.instances) {
      disposeInstance(instance);
    }
    this.instances = [];
    this.placements = [];
    this.clubhousePos = null;
    this.clubhouseAreaBounds = null;
  }
}

function normalizeRotationDegrees(value: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}
