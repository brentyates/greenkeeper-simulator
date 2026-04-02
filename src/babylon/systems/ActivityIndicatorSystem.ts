import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { gridTo3D } from "../engine/BabylonEngine";

export type WorkEffectType = "mow" | "water" | "fertilize" | "rake";

interface IndicatorMesh {
  mesh: Mesh;
  material: StandardMaterial;
  active: boolean;
  elapsed: number;
  duration: number;
  startPos: Vector3;
  velocity: Vector3;
  startScale: number;
  endScale: number;
}

const POOL_SIZE = 20;
const EFFECT_DURATION = 0.8;

const EFFECT_COLORS: Record<WorkEffectType, Color3> = {
  mow: new Color3(0.3, 0.7, 0.2),
  water: new Color3(0.3, 0.55, 1.0),
  fertilize: new Color3(0.7, 0.6, 0.2),
  rake: new Color3(0.85, 0.75, 0.5),
};

const PARTICLES_PER_EFFECT = 4;

export class ActivityIndicatorSystem {
  private scene: Scene;
  private pool: IndicatorMesh[] = [];
  private getElevation: (x: number, z: number) => number;

  constructor(
    scene: Scene,
    elevationProvider: { getElevationAt: (x: number, z: number, fallback: number) => number }
  ) {
    this.scene = scene;
    this.getElevation = (x, z) => elevationProvider.getElevationAt(x, z, 0);
    this.initPool();
  }

  private initPool(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new StandardMaterial(`actInd_mat_${i}`, this.scene);
      material.diffuseColor = Color3.White();
      material.emissiveColor = Color3.White();
      material.specularColor = Color3.Black();
      material.disableLighting = true;
      material.alpha = 0;

      const mesh = MeshBuilder.CreateBox(`actInd_${i}`, { size: 0.12 }, this.scene);
      mesh.material = material;
      mesh.isPickable = false;
      mesh.isVisible = false;

      this.pool.push({
        mesh,
        material,
        active: false,
        elapsed: 0,
        duration: EFFECT_DURATION,
        startPos: Vector3.Zero(),
        velocity: Vector3.Zero(),
        startScale: 1,
        endScale: 1,
      });
    }
  }

  private acquireIndicator(): IndicatorMesh | null {
    for (const ind of this.pool) {
      if (!ind.active) return ind;
    }
    let oldest: IndicatorMesh | null = null;
    let maxElapsed = 0;
    for (const ind of this.pool) {
      if (ind.elapsed > maxElapsed) {
        maxElapsed = ind.elapsed;
        oldest = ind;
      }
    }
    return oldest;
  }

  public showWorkEffect(worldX: number, worldZ: number, type: WorkEffectType): void {
    const elevation = this.getElevation(worldX, worldZ);
    const basePos = gridTo3D(worldX, worldZ, elevation);
    const color = EFFECT_COLORS[type];

    for (let i = 0; i < PARTICLES_PER_EFFECT; i++) {
      const ind = this.acquireIndicator();
      if (!ind) return;

      const angle = (Math.PI * 2 * i) / PARTICLES_PER_EFFECT + Math.random() * 0.5;
      const speed = 0.8 + Math.random() * 0.6;

      ind.active = true;
      ind.elapsed = 0;
      ind.duration = EFFECT_DURATION + Math.random() * 0.3;
      ind.startPos.copyFrom(basePos);
      ind.startPos.y += 0.15;

      if (type === "water") {
        ind.velocity.set(
          Math.cos(angle) * speed * 0.4,
          1.5 + Math.random() * 0.5,
          Math.sin(angle) * speed * 0.4
        );
        ind.startScale = 0.08;
        ind.endScale = 0.03;
      } else if (type === "fertilize") {
        ind.velocity.set(
          Math.cos(angle) * speed * 0.2,
          0.4 + Math.random() * 0.3,
          Math.sin(angle) * speed * 0.2
        );
        ind.startScale = 0.1;
        ind.endScale = 0.35;
      } else {
        ind.velocity.set(
          Math.cos(angle) * speed,
          0.6 + Math.random() * 0.4,
          Math.sin(angle) * speed
        );
        ind.startScale = 0.1;
        ind.endScale = 0.06;
      }

      ind.material.diffuseColor.copyFrom(color);
      ind.material.emissiveColor = color.scale(0.5);
      ind.material.alpha = 0.9;
      ind.mesh.position.copyFrom(ind.startPos);
      ind.mesh.scaling.setAll(ind.startScale);
      ind.mesh.isVisible = true;
    }
  }

  public update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const ind of this.pool) {
      if (!ind.active) continue;

      ind.elapsed += dt;
      const t = ind.elapsed / ind.duration;

      if (t >= 1) {
        ind.active = false;
        ind.mesh.isVisible = false;
        ind.material.alpha = 0;
        continue;
      }

      ind.mesh.position.x = ind.startPos.x + ind.velocity.x * ind.elapsed;
      ind.mesh.position.z = ind.startPos.z + ind.velocity.z * ind.elapsed;
      ind.mesh.position.y = ind.startPos.y + ind.velocity.y * ind.elapsed - 2.0 * ind.elapsed * ind.elapsed;

      const scale = ind.startScale + (ind.endScale - ind.startScale) * t;
      ind.mesh.scaling.setAll(scale);

      ind.material.alpha = t < 0.2 ? t / 0.2 : 1.0 - (t - 0.2) / 0.8;
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const ind of this.pool) {
      if (ind.active) count++;
    }
    return count;
  }

  public updateAmbientLevel(
    scene: Scene,
    courseHealth: number,
    activeGolferCount: number
  ): void {
    const healthFactor = Math.max(0, Math.min(1, courseHealth / 100));
    const golferFactor = Math.min(1, activeGolferCount / 12);
    const liveliness = healthFactor * 0.7 + golferFactor * 0.3;

    const ambientBase = 0.25;
    const ambientBoost = 0.15 * liveliness;
    const ambient = ambientBase + ambientBoost;
    scene.ambientColor = new Color3(ambient, ambient * 1.05, ambient);
  }

  public dispose(): void {
    for (const ind of this.pool) {
      ind.material.dispose();
      ind.mesh.dispose();
    }
    this.pool = [];
  }
}
