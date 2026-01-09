import { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

import {
  EquipmentType,
  EquipmentState,
  createEquipmentState,
  consumeResource,
  canActivate,
  getResourcePercent,
  refillEquipment,
  calculateRefillCost,
} from '../../core/equipment-logic';

import {
  EquipmentSelectionState,
  createInitialSelectionState,
  handleEquipmentButton,
  slotToEquipmentType,
  isEquipmentActive,
  isMowerActive,
} from '../../core/equipment-selection';

export class EquipmentManager {
  private scene: Scene;
  private equipment: Map<EquipmentType, EquipmentState> = new Map();
  private selection: EquipmentSelectionState;
  private particleSystem: ParticleSystem | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.selection = createInitialSelectionState();
    this.initializeEquipment();
  }

  private initializeEquipment(): void {
    this.equipment.set('mower', createEquipmentState('mower'));
    this.equipment.set('sprinkler', createEquipmentState('sprinkler'));
    this.equipment.set('spreader', createEquipmentState('spreader'));
  }

  public handleButton(type: EquipmentType): void {
    const wasSelected = this.selection.selected;
    this.selection = handleEquipmentButton(this.selection, type);
    const nowSelected = this.selection.selected;

    if (wasSelected !== nowSelected) {
      if (wasSelected !== null) {
        this.stopParticles();
      }
      if (nowSelected !== null) {
        const state = this.equipment.get(nowSelected);
        if (state && canActivate(state)) {
          this.startParticles(nowSelected);
        } else {
          this.selection = { selected: null };
        }
      }
    }
  }

  public handleSlot(slot: 1 | 2 | 3): void {
    this.handleButton(slotToEquipmentType(slot));
  }

  public deselect(): void {
    if (this.selection.selected !== null) {
      this.stopParticles();
      this.selection = { selected: null };
    }
  }

  public refill(): number {
    let totalCost = 0;
    for (const [type, state] of this.equipment) {
      totalCost += calculateRefillCost(state);
      this.equipment.set(type, refillEquipment(state));
    }
    return Math.round(totalCost * 100) / 100;
  }

  public update(deltaMs: number, playerPosition: Vector3): boolean {
    const selected = this.selection.selected;
    if (selected === null) return false;

    const state = this.equipment.get(selected);
    if (!state) return false;

    const newState = consumeResource(state, deltaMs);
    this.equipment.set(selected, newState);

    if (newState.resourceCurrent <= 0) {
      this.deselect();
      return true;
    }

    if (this.particleSystem && this.particleSystem.emitter instanceof Vector3) {
      (this.particleSystem.emitter as Vector3).set(
        playerPosition.x,
        playerPosition.y - 10,
        playerPosition.z - 0.5
      );
    }

    return false;
  }

  private startParticles(type: EquipmentType): void {
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

    switch (type) {
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

  public getSelected(): EquipmentType | null {
    return this.selection.selected;
  }

  public isActive(): boolean {
    return isEquipmentActive(this.selection);
  }

  public isMowerActive(): boolean {
    return isMowerActive(this.selection);
  }

  public getCurrentState(): EquipmentState | undefined {
    const selected = this.selection.selected;
    return selected ? this.equipment.get(selected) : undefined;
  }

  public getResourcePercent(): number {
    const state = this.getCurrentState();
    return state ? getResourcePercent(state) : 0;
  }

  public getState(type: EquipmentType): EquipmentState | undefined {
    return this.equipment.get(type);
  }

  public setResource(type: EquipmentType, amount: number): void {
    const state = this.equipment.get(type);
    if (state) {
      this.equipment.set(type, {
        ...state,
        resourceCurrent: Math.max(0, Math.min(amount, state.resourceMax)),
      });
    }
  }

  public hasParticles(): boolean {
    return this.particleSystem !== null;
  }

  public dispose(): void {
    this.stopParticles();
  }
}
