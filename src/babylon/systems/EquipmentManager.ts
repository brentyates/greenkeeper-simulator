import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

import {
  EquipmentType,
  EquipmentState,
  createEquipmentState,
  activateEquipment,
  deactivateEquipment,
  consumeResource,
  canActivate,
  getResourcePercent,
  refillEquipment,
  calculateRefillCost,
} from '../../core/equipment-logic';

export class EquipmentManager {
  private scene: Scene;
  private equipment: Map<EquipmentType, EquipmentState> = new Map();
  private currentEquipment: EquipmentType = 'mower';
  private equipmentMesh: Mesh | null = null;
  private particleSystem: ParticleSystem | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeEquipment();
  }

  private initializeEquipment(): void {
    this.equipment.set('mower', createEquipmentState('mower'));
    this.equipment.set('sprinkler', createEquipmentState('sprinkler'));
    this.equipment.set('spreader', createEquipmentState('spreader'));
    this.createEquipmentMesh();
  }

  private createEquipmentMesh(): void {
    if (this.equipmentMesh) {
      this.equipmentMesh.dispose();
    }

    const type = this.currentEquipment;
    let mesh: Mesh;

    switch (type) {
      case 'mower':
        mesh = MeshBuilder.CreateBox('equipment', { width: 12, height: 6, depth: 0.1 }, this.scene);
        break;
      case 'sprinkler':
        mesh = MeshBuilder.CreateCylinder('equipment', { height: 8, diameter: 6 }, this.scene);
        break;
      case 'spreader':
        mesh = MeshBuilder.CreateBox('equipment', { width: 10, height: 8, depth: 0.1 }, this.scene);
        break;
    }

    const material = new StandardMaterial('equipmentMat', this.scene);
    material.diffuseColor = this.getEquipmentColor(type);
    material.emissiveColor = this.getEquipmentColor(type).scale(0.3);
    mesh.material = material;
    mesh.isVisible = false;

    this.equipmentMesh = mesh;
  }

  private getEquipmentColor(type: EquipmentType): Color3 {
    switch (type) {
      case 'mower': return new Color3(0.2, 0.6, 0.2);
      case 'sprinkler': return new Color3(0.2, 0.4, 0.8);
      case 'spreader': return new Color3(0.7, 0.5, 0.2);
    }
  }

  public selectEquipment(type: EquipmentType): void {
    if (type === this.currentEquipment) return;

    const currentState = this.getCurrentState();
    if (currentState?.isActive) {
      this.deactivate();
    }

    this.currentEquipment = type;
    this.createEquipmentMesh();
  }

  public selectBySlot(slot: 1 | 2 | 3): void {
    const types: EquipmentType[] = ['mower', 'sprinkler', 'spreader'];
    this.selectEquipment(types[slot - 1]);
  }

  public toggle(): void {
    const state = this.getCurrentState();
    if (!state) return;

    if (state.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  public activate(): void {
    const state = this.getCurrentState();
    if (!state || !canActivate(state)) return;

    const newState = activateEquipment(state);
    this.equipment.set(this.currentEquipment, newState);

    if (this.equipmentMesh) {
      this.equipmentMesh.isVisible = true;
    }
    this.startParticles();
  }

  public deactivate(): void {
    const state = this.getCurrentState();
    if (!state) return;

    const newState = deactivateEquipment(state);
    this.equipment.set(this.currentEquipment, newState);

    if (this.equipmentMesh) {
      this.equipmentMesh.isVisible = false;
    }
    this.stopParticles();
  }

  public refill(): number {
    let totalCost = 0;
    for (const [type, state] of this.equipment) {
      totalCost += calculateRefillCost(state);
      this.equipment.set(type, refillEquipment(state));
    }
    return Math.round(totalCost * 100) / 100;
  }

  public update(deltaMs: number, playerPosition: Vector3): void {
    const state = this.getCurrentState();
    if (!state) return;

    if (state.isActive) {
      const newState = consumeResource(state, deltaMs);
      this.equipment.set(this.currentEquipment, newState);

      if (newState.resourceCurrent <= 0) {
        this.deactivate();
      }
    }

    if (this.equipmentMesh && state.isActive) {
      this.equipmentMesh.position = new Vector3(
        playerPosition.x + 10,
        playerPosition.y - 5,
        playerPosition.z - 0.5
      );
    }

    if (this.particleSystem) {
      this.particleSystem.emitter = new Vector3(
        playerPosition.x,
        playerPosition.y - 10,
        playerPosition.z - 0.5
      );
    }
  }

  private startParticles(): void {
    if (this.particleSystem) {
      this.particleSystem.dispose();
    }

    const ps = new ParticleSystem('particles', 50, this.scene);
    ps.createPointEmitter(new Vector3(-5, -5, 0), new Vector3(5, 5, 0));

    ps.minSize = 2;
    ps.maxSize = 4;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.emitRate = 20;
    ps.gravity = new Vector3(0, -20, 0);

    switch (this.currentEquipment) {
      case 'mower':
        ps.color1 = new Color3(0.2, 0.5, 0.1).toColor4(1);
        ps.color2 = new Color3(0.3, 0.6, 0.2).toColor4(1);
        break;
      case 'sprinkler':
        ps.color1 = new Color3(0.3, 0.5, 0.8).toColor4(1);
        ps.color2 = new Color3(0.5, 0.7, 1.0).toColor4(1);
        ps.gravity = new Vector3(0, -30, 0);
        break;
      case 'spreader':
        ps.color1 = new Color3(0.6, 0.5, 0.3).toColor4(1);
        ps.color2 = new Color3(0.8, 0.7, 0.4).toColor4(1);
        break;
    }

    ps.start();
    this.particleSystem = ps;
  }

  private stopParticles(): void {
    if (this.particleSystem) {
      this.particleSystem.stop();
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
  }

  public getCurrentState(): EquipmentState | undefined {
    return this.equipment.get(this.currentEquipment);
  }

  public getCurrentType(): EquipmentType {
    return this.currentEquipment;
  }

  public getResourcePercent(): number {
    const state = this.getCurrentState();
    return state ? getResourcePercent(state) : 0;
  }

  public isActive(): boolean {
    return this.getCurrentState()?.isActive ?? false;
  }

  public getState(type: EquipmentType): EquipmentState | undefined {
    return this.equipment.get(type);
  }

  public dispose(): void {
    this.stopParticles();
    if (this.equipmentMesh) {
      this.equipmentMesh.dispose();
    }
  }
}
