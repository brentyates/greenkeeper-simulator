import { Scene } from '@babylonjs/core/scene';
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
  private particleSystem: ParticleSystem | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeEquipment();
  }

  private initializeEquipment(): void {
    this.equipment.set('mower', createEquipmentState('mower'));
    this.equipment.set('sprinkler', createEquipmentState('sprinkler'));
    this.equipment.set('spreader', createEquipmentState('spreader'));
  }

  public selectEquipment(type: EquipmentType): void {
    if (type === this.currentEquipment) return;

    const currentState = this.getCurrentState();
    if (currentState?.isActive) {
      this.deactivate();
    }

    this.currentEquipment = type;
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

    this.startParticles();
  }

  public deactivate(): void {
    const state = this.getCurrentState();
    if (!state) return;

    const newState = deactivateEquipment(state);
    this.equipment.set(this.currentEquipment, newState);

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

    if (this.particleSystem && this.particleSystem.emitter instanceof Vector3) {
      (this.particleSystem.emitter as Vector3).set(
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
  }
}
