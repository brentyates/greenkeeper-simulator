/**
 * IrrigationRenderSystem - Renders pipes and sprinkler heads
 *
 * Handles visualization of the irrigation infrastructure:
 * - Pipe network rendering (underground, visible in irrigation overlay)
 * - Sprinkler head sprites and animations
 * - Coverage overlay visualization
 * - Leak visual effects
 * - Pressure color coding
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import {
  IrrigationSystem,
  PipeTile,
  SprinklerHead,
  WaterSource,
  SPRINKLER_CONFIGS,
} from "../../core/irrigation";
import { gridTo3D } from "../engine/BabylonEngine";
import { ElevationProvider } from "./EntityVisualSystem";

export class IrrigationRenderSystem {
  private scene: Scene;
  private elevationProvider: ElevationProvider;
  private pipeMeshes: Map<string, Mesh> = new Map();
  private sprinklerMeshes: Map<string, Mesh> = new Map();
  private sprinklerEffectMeshes: Map<
    string,
    {
      spray: Mesh;
      ring: Mesh;
      sprayMaterial: StandardMaterial;
      ringMaterial: StandardMaterial;
      pressureNormalized: number;
      phase: number;
    }
  > = new Map();
  private coverageMeshes: Map<string, Mesh> = new Map();
  private leakMeshes: Map<string, Mesh> = new Map();
  private waterSourceMeshes: Map<string, Mesh> = new Map();
  private pipeMaterial: StandardMaterial | null = null;
  private sprinklerMaterial: StandardMaterial | null = null;
  private leakMaterial: StandardMaterial | null = null;
  private isVisible: boolean = false;
  private sprinklerAnimationTime: number = 0;
  private readonly animateSprinklerEffectsBeforeRender: () => void;

  constructor(scene: Scene, elevationProvider: ElevationProvider) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;
    this.animateSprinklerEffectsBeforeRender = () => this.animateSprinklerEffects();
    this.createMaterials();
    this.scene.registerBeforeRender(this.animateSprinklerEffectsBeforeRender);
  }

  /**
   * Dispose a mesh and its material (if it has a per-object material)
   */
  private disposeMeshWithMaterial(mesh: Mesh): void {
    if (mesh.material) {
      mesh.material.dispose();
    }
    mesh.dispose();
  }

  private createMaterials(): void {
    this.pipeMaterial = new StandardMaterial("pipeMat", this.scene);
    this.pipeMaterial.diffuseColor = new Color3(0.4, 0.8, 1.0);
    this.pipeMaterial.emissiveColor = new Color3(0.4, 0.8, 1.0);
    this.pipeMaterial.disableLighting = true;
    this.pipeMaterial.freeze();

    this.sprinklerMaterial = new StandardMaterial("sprinklerMat", this.scene);
    this.sprinklerMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.sprinklerMaterial.emissiveColor = new Color3(0.8, 0.8, 0.8);
    this.sprinklerMaterial.disableLighting = true;
    this.sprinklerMaterial.freeze();

    this.leakMaterial = new StandardMaterial("leakMat", this.scene);
    this.leakMaterial.diffuseColor = new Color3(1.0, 0.2, 0.2);
    this.leakMaterial.emissiveColor = new Color3(0.8, 0.1, 0.1);
    this.leakMaterial.disableLighting = true;
    this.leakMaterial.freeze();
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.updateVisibility();
  }

  private updateVisibility(): void {
    for (const mesh of this.pipeMeshes.values()) {
      mesh.isVisible = this.isVisible;
    }
    for (const [headId, mesh] of this.sprinklerMeshes.entries()) {
      // Keep head visible while pumping so active watering is readable outside overlay mode.
      mesh.isVisible = this.isVisible || this.sprinklerEffectMeshes.has(headId);
    }
    for (const effect of this.sprinklerEffectMeshes.values()) {
      // Spray remains visible as in-world feedback; ring is overlay-only.
      effect.spray.isVisible = true;
      effect.ring.isVisible = this.isVisible;
    }
    for (const mesh of this.coverageMeshes.values()) {
      mesh.isVisible = this.isVisible;
    }
    for (const mesh of this.leakMeshes.values()) {
      mesh.isVisible = this.isVisible;
    }
    for (const mesh of this.waterSourceMeshes.values()) {
      mesh.isVisible = this.isVisible;
    }
  }

  public update(system: IrrigationSystem): void {
    this.updatePipes(system);
    this.updateSprinklers(system);
    this.updateWaterSources(system);
    this.updateLeaks(system);
    this.updateVisibility();
  }

  private updatePipes(system: IrrigationSystem): void {
    const existingKeys = new Set(this.pipeMeshes.keys());
    const currentKeys = new Set<string>();

    for (const pipe of system.pipes) {
      const key = `${pipe.gridX},${pipe.gridY}`;
      currentKeys.add(key);

      if (!this.pipeMeshes.has(key)) {
        this.createPipeMesh(pipe, system);
      } else {
        this.updatePipeMesh(pipe, system);
      }
    }

    for (const key of existingKeys) {
      if (!currentKeys.has(key)) {
        const mesh = this.pipeMeshes.get(key);
        if (mesh) {
          this.disposeMeshWithMaterial(mesh);
          this.pipeMeshes.delete(key);
        }
      }
    }
  }

  private createPipeMesh(pipe: PipeTile, _system: IrrigationSystem): void {
    const key = `${pipe.gridX},${pipe.gridY}`;
    const elevation = this.elevationProvider.getElevationAt(pipe.gridX, pipe.gridY, 0);
    const pos = gridTo3D(pipe.gridX + 0.5, pipe.gridY + 0.5, elevation);
    pos.y += 0.05;

    const color = this.getPipeColor(pipe);
    const material = new StandardMaterial(`pipeMat_${key}`, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.8);
    material.disableLighting = true;
    material.freeze();

    // Create hub
    const hub = MeshBuilder.CreateBox(
      `hub_${key}`,
      {
        width: 0.25,
        height: 0.15,
        depth: 0.25,
      },
      this.scene
    );

    const parts: Mesh[] = [hub];

    // Add connection stubs
    for (const dir of pipe.connectedTo) {
      let stub: Mesh;
      if (dir === "north") {
        stub = MeshBuilder.CreateBox(
          `stub_n_${key}`,
          { width: 0.2, height: 0.15, depth: 0.5 },
          this.scene
        );
        stub.position.z = -0.25;
      } else if (dir === "south") {
        stub = MeshBuilder.CreateBox(
          `stub_s_${key}`,
          { width: 0.2, height: 0.15, depth: 0.5 },
          this.scene
        );
        stub.position.z = 0.25;
      } else if (dir === "east") {
        stub = MeshBuilder.CreateBox(
          `stub_e_${key}`,
          { width: 0.5, height: 0.15, depth: 0.2 },
          this.scene
        );
        stub.position.x = 0.25;
      } else {
        // west
        stub = MeshBuilder.CreateBox(
          `stub_w_${key}`,
          { width: 0.5, height: 0.15, depth: 0.2 },
          this.scene
        );
        stub.position.x = -0.25;
      }
      parts.push(stub);
    }

    const mesh = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (mesh) {
      mesh.name = `pipe_${key}`;
      mesh.position = pos;
      mesh.material = material;
      mesh.isVisible = this.isVisible;
      mesh.isPickable = false;
      mesh.renderingGroupId = 1;
      // Store connection state to detect changes
      mesh.metadata = { connections: [...pipe.connectedTo].sort().join(",") };
      this.pipeMeshes.set(key, mesh);
    }
  }

  private updatePipeMesh(pipe: PipeTile, system: IrrigationSystem): void {
    const key = `${pipe.gridX},${pipe.gridY}`;
    const mesh = this.pipeMeshes.get(key);
    if (!mesh) return;

    // Check if connectivity changed
    const newConnections = [...pipe.connectedTo].sort().join(",");
    if (mesh.metadata?.connections !== newConnections) {
      this.disposeMeshWithMaterial(mesh);
      this.pipeMeshes.delete(key);
      this.createPipeMesh(pipe, system);
      return;
    }

    const color = this.getPipeColor(pipe);
    if (mesh.material instanceof StandardMaterial) {
      mesh.material.diffuseColor = color;
      mesh.material.emissiveColor = color.scale(0.8);
    }
  }

  private getPipeColor(pipe: PipeTile): Color3 {
    if (pipe.isLeaking) {
      return new Color3(1.0, 0.1, 0.1); // Bright Red
    }

    if (pipe.pressureLevel === 0) {
      // Vivid Blue for disconnected/unpressurized pipes
      return new Color3(0.0, 0.5, 1.0);
    }

    if (pipe.pressureLevel >= 80) {
      // Glowing Cyan for high pressure
      return new Color3(0.0, 1.0, 1.0);
    }

    if (pipe.pressureLevel >= 40) {
      // Neon Green for medium pressure
      return new Color3(0.4, 1.0, 0.2);
    }

    // Orange for low pressure
    return new Color3(1.0, 0.6, 0.0);
  }

  private updateSprinklers(system: IrrigationSystem): void {
    const existingKeys = new Set(this.sprinklerMeshes.keys());
    const currentKeys = new Set<string>();

    for (const head of system.sprinklerHeads) {
      const key = head.id;
      currentKeys.add(key);

      if (!this.sprinklerMeshes.has(key)) {
        this.createSprinklerMesh(head, system);
      } else {
        this.updateSprinklerMesh(head, system);
      }
    }

    for (const key of existingKeys) {
      if (!currentKeys.has(key)) {
        const mesh = this.sprinklerMeshes.get(key);
        if (mesh) {
          mesh.dispose();
          this.sprinklerMeshes.delete(key);
        }
        this.removeSprinklerEffect(key);
      }
    }
  }

  private createSprinklerMesh(head: SprinklerHead, system: IrrigationSystem): void {
    const elevation = this.elevationProvider.getElevationAt(head.gridX, head.gridY, 0);
    const pos = gridTo3D(head.gridX, head.gridY, elevation);
    pos.y += 0.05;

    const mesh = MeshBuilder.CreateCylinder(
      `sprinkler_${head.id}`,
      {
        height: 0.1,
        diameter: 0.15,
      },
      this.scene
    );
    mesh.position = pos;
    mesh.material = this.sprinklerMaterial;
    mesh.isVisible = this.isVisible;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;

    this.sprinklerMeshes.set(head.id, mesh);

    const pressure = this.getSprinklerPressure(head, system);
    if (head.isActive && pressure > 0) {
      this.ensureSprinklerEffect(head, pressure / 100);
    }
  }

  private updateSprinklerMesh(head: SprinklerHead, system: IrrigationSystem): void {
    const mesh = this.sprinklerMeshes.get(head.id);
    if (!mesh) return;

    const elevation = this.elevationProvider.getElevationAt(head.gridX, head.gridY, 0);
    const pos = gridTo3D(head.gridX, head.gridY, elevation);
    pos.y += 0.05;
    mesh.position.copyFrom(pos);

    const pressure = this.getSprinklerPressure(head, system);
    if (head.isActive && pressure > 0) {
      this.ensureSprinklerEffect(head, pressure / 100);
    } else {
      this.removeSprinklerEffect(head.id);
    }
  }

  private getSprinklerPressure(head: SprinklerHead, system: IrrigationSystem): number {
    const pipe = system.pipes.find(
      (p) => p.gridX === head.gridX && p.gridY === head.gridY
    );
    return pipe?.pressureLevel ?? 0;
  }

  private ensureSprinklerEffect(
    head: SprinklerHead,
    pressureNormalized: number
  ): void {
    const existing = this.sprinklerEffectMeshes.get(head.id);
    if (existing) {
      existing.pressureNormalized = pressureNormalized;
      this.updateSprinklerEffectPosition(head, existing.spray, existing.ring);
      return;
    }

    const coverageRadius = Math.max(
      0.5,
      SPRINKLER_CONFIGS[head.sprinklerType].coverageRadius
    );
    const ringDiameter = 0.5 + coverageRadius * 0.6;
    const sprayHeight = 0.32 + coverageRadius * 0.14;
    const sprayBaseDiameter = 0.2 + coverageRadius * 0.1;

    const sprayMaterial = new StandardMaterial(`sprinklerSprayMat_${head.id}`, this.scene);
    sprayMaterial.diffuseColor = new Color3(0.4, 0.75, 1.0);
    sprayMaterial.emissiveColor = new Color3(0.2, 0.5, 0.9);
    sprayMaterial.alpha = 0.4;
    sprayMaterial.disableLighting = true;

    const spray = MeshBuilder.CreateCylinder(
      `sprinkler_spray_${head.id}`,
      {
        height: sprayHeight,
        diameterTop: 0.06,
        diameterBottom: sprayBaseDiameter,
        tessellation: 16,
      },
      this.scene
    );
    spray.material = sprayMaterial;
    spray.isVisible = this.isVisible;
    spray.isPickable = false;
    spray.renderingGroupId = 2;

    const ringMaterial = new StandardMaterial(`sprinklerRingMat_${head.id}`, this.scene);
    ringMaterial.diffuseColor = new Color3(0.35, 0.75, 1.0);
    ringMaterial.emissiveColor = new Color3(0.2, 0.6, 0.9);
    ringMaterial.alpha = 0.45;
    ringMaterial.disableLighting = true;

    const ring = MeshBuilder.CreateTorus(
      `sprinkler_ring_${head.id}`,
      {
        diameter: ringDiameter,
        thickness: 0.03,
        tessellation: 24,
      },
      this.scene
    );
    ring.material = ringMaterial;
    ring.isVisible = this.isVisible;
    ring.isPickable = false;
    ring.renderingGroupId = 2;

    this.updateSprinklerEffectPosition(head, spray, ring);

    this.sprinklerEffectMeshes.set(head.id, {
      spray,
      ring,
      sprayMaterial,
      ringMaterial,
      pressureNormalized,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private updateSprinklerEffectPosition(head: SprinklerHead, spray: Mesh, ring: Mesh): void {
    const elevation = this.elevationProvider.getElevationAt(head.gridX, head.gridY, 0);
    const basePos = gridTo3D(head.gridX, head.gridY, elevation);

    spray.position.copyFrom(basePos);
    spray.position.y += 0.28;

    ring.position.copyFrom(basePos);
    ring.position.y += 0.09;
  }

  private removeSprinklerEffect(headId: string): void {
    const effect = this.sprinklerEffectMeshes.get(headId);
    if (!effect) return;

    this.disposeMeshWithMaterial(effect.spray);
    this.disposeMeshWithMaterial(effect.ring);
    this.sprinklerEffectMeshes.delete(headId);
  }

  private animateSprinklerEffects(): void {
    if (this.sprinklerEffectMeshes.size === 0) return;

    const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    this.sprinklerAnimationTime += deltaSeconds;

    for (const effect of this.sprinklerEffectMeshes.values()) {
      const pulse = 0.5 + 0.5 * Math.sin(this.sprinklerAnimationTime * 6 + effect.phase);
      const pressureFactor = 0.4 + effect.pressureNormalized * 0.6;
      const worldAlphaFactor = this.isVisible ? 1 : 0.65;

      const sprayHeight = (0.75 + pulse * 0.45) * pressureFactor;
      effect.spray.scaling.y = sprayHeight;
      effect.sprayMaterial.alpha = (0.15 + pulse * 0.28) * pressureFactor * worldAlphaFactor;

      const ringScale = (0.7 + pulse * 0.65) * pressureFactor;
      effect.ring.scaling.x = ringScale;
      effect.ring.scaling.z = ringScale;
      effect.ring.rotation.y += deltaSeconds * 2.5;
      effect.ringMaterial.alpha = (0.14 + (1 - pulse) * 0.3) * pressureFactor;
    }
  }

  private updateWaterSources(system: IrrigationSystem): void {
    const existingKeys = new Set(this.waterSourceMeshes.keys());
    const currentKeys = new Set<string>();

    for (const source of system.waterSources) {
      const key = source.id;
      currentKeys.add(key);

      if (!this.waterSourceMeshes.has(key)) {
        this.createWaterSourceMesh(source);
      }
    }

    for (const key of existingKeys) {
      if (!currentKeys.has(key)) {
        const mesh = this.waterSourceMeshes.get(key);
        if (mesh) {
          this.disposeMeshWithMaterial(mesh);
          this.waterSourceMeshes.delete(key);
        }
      }
    }
  }

  private createWaterSourceMesh(source: WaterSource): void {
    const elevation = this.elevationProvider.getElevationAt(source.gridX, source.gridY, 0);
    const pos = gridTo3D(source.gridX, source.gridY, elevation);
    pos.y += 0.2;

    const material = new StandardMaterial(`sourceMat_${source.id}`, this.scene);
    material.diffuseColor = new Color3(0.1, 0.5, 0.9);
    material.emissiveColor = new Color3(0.05, 0.25, 0.45);
    material.disableLighting = true;
    material.freeze();

    const mesh = MeshBuilder.CreateBox(
      `source_${source.id}`,
      {
        width: 0.5,
        height: 0.4,
        depth: 0.5,
      },
      this.scene
    );
    mesh.position = pos;
    mesh.material = material;
    mesh.isVisible = this.isVisible;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;

    this.waterSourceMeshes.set(source.id, mesh);
  }

  private updateLeaks(system: IrrigationSystem): void {
    const existingKeys = new Set(this.leakMeshes.keys());
    const currentKeys = new Set<string>();

    for (const pipe of system.pipes) {
      if (pipe.isLeaking) {
        const key = `${pipe.gridX},${pipe.gridY}`;
        currentKeys.add(key);

        if (!this.leakMeshes.has(key)) {
          this.createLeakMesh(pipe);
        }
      }
    }

    for (const key of existingKeys) {
      if (!currentKeys.has(key)) {
        const mesh = this.leakMeshes.get(key);
        if (mesh) {
          mesh.dispose();
          this.leakMeshes.delete(key);
        }
      }
    }
  }

  private createLeakMesh(pipe: PipeTile): void {
    const key = `${pipe.gridX},${pipe.gridY}`;
    const elevation = this.elevationProvider.getElevationAt(pipe.gridX, pipe.gridY, 0);
    const pos = gridTo3D(pipe.gridX, pipe.gridY, elevation);
    pos.y -= 0.05;

    const mesh = MeshBuilder.CreateSphere(
      `leak_${key}`,
      {
        diameter: 0.2,
      },
      this.scene
    );
    mesh.position = pos;
    mesh.material = this.leakMaterial;
    mesh.isVisible = this.isVisible;
    mesh.isPickable = false;
    // Leaks should be very visible
    mesh.renderingGroupId = 2;

    this.leakMeshes.set(key, mesh);
  }

  public showCoverage(head: SprinklerHead): void {
    const key = head.id;
    if (this.coverageMeshes.has(key)) return;

    if (head.coverageTiles.length > 0) {
      const mesh = MeshBuilder.CreateGround(
        `coverage_${key}`,
        {
          width: 1,
          height: 1,
        },
        this.scene
      );
      const elevation = this.elevationProvider.getElevationAt(head.gridX, head.gridY, 0);
      mesh.position = gridTo3D(head.gridX, head.gridY, elevation);
      mesh.position.y += 0.01;

      const material = new StandardMaterial(`coverageMat_${key}`, this.scene);
      material.diffuseColor = new Color3(0.2, 0.4, 0.8);
      material.alpha = 0.3;
      material.disableLighting = true;
      material.freeze();
      mesh.material = material;
      mesh.isVisible = this.isVisible;
      mesh.isPickable = false;
      mesh.renderingGroupId = 1;

      this.coverageMeshes.set(key, mesh);
    }
  }

  public hideCoverage(headId: string): void {
    const mesh = this.coverageMeshes.get(headId);
    if (mesh) {
      this.disposeMeshWithMaterial(mesh);
      this.coverageMeshes.delete(headId);
    }
  }

  public dispose(): void {
    this.scene.unregisterBeforeRender(this.animateSprinklerEffectsBeforeRender);

    // Pipes have per-object materials
    for (const mesh of this.pipeMeshes.values()) {
      this.disposeMeshWithMaterial(mesh);
    }
    // Sprinklers use shared material
    for (const mesh of this.sprinklerMeshes.values()) {
      mesh.dispose();
    }
    for (const effect of this.sprinklerEffectMeshes.values()) {
      this.disposeMeshWithMaterial(effect.spray);
      this.disposeMeshWithMaterial(effect.ring);
    }
    // Coverage meshes have per-object materials
    for (const mesh of this.coverageMeshes.values()) {
      this.disposeMeshWithMaterial(mesh);
    }
    // Leaks use shared material
    for (const mesh of this.leakMeshes.values()) {
      mesh.dispose();
    }
    // Water sources have per-object materials
    for (const mesh of this.waterSourceMeshes.values()) {
      this.disposeMeshWithMaterial(mesh);
    }
    this.pipeMeshes.clear();
    this.sprinklerMeshes.clear();
    this.sprinklerEffectMeshes.clear();
    this.coverageMeshes.clear();
    this.leakMeshes.clear();
    this.waterSourceMeshes.clear();

    // Dispose shared materials
    this.pipeMaterial?.dispose();
    this.sprinklerMaterial?.dispose();
    this.leakMaterial?.dispose();
  }
}
