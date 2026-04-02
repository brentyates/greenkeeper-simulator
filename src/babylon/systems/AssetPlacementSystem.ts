import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import { loadAsset, createInstance, disposeInstance, AssetInstance } from '../assets/AssetLoader';
import { AssetId, getAssetSpec } from '../assets/AssetManifest';
import { PlacedAsset } from '../../data/customCourseData';
import {
  createHoleFeatureAssignment,
  getMaxAssignedHoleNumber,
  getMinAssignedHoleNumber,
  type HoleFeatureAssignment,
} from '../../core/hole-construction';

interface PlacedAssetEntry {
  data: PlacedAsset;
  instance: AssetInstance;
}

export interface AssetPlacementCallbacks {
  onSelect?: (asset: PlacedAsset | null) => void;
  onPlace?: (asset: PlacedAsset, details?: { replacedCount: number }) => void;
  onHoleNumberChange?: (holeNumber: number) => void;
  getTerrainElevation?: (worldX: number, worldZ: number) => number;
}

export class AssetPlacementSystem {
  private scene: Scene;
  private callbacks: AssetPlacementCallbacks;
  private placed: PlacedAssetEntry[] = [];
  private selectedIndex: number = -1;
  private placeMode: boolean = false;
  private placeAssetId: string = '';
  private ghostMesh: Mesh | null = null;
  private ghostMaterial: StandardMaterial | null = null;
  private nextId = 0;
  private activeHoleNumber = 1;

  constructor(scene: Scene, callbacks: AssetPlacementCallbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  public setPlaceMode(assetId: string): void {
    this.clearSelection();
    this.placeAssetId = assetId;
    this.placeMode = true;
    this.createGhostMesh(assetId);
  }

  public exitPlaceMode(): void {
    this.placeMode = false;
    this.placeAssetId = '';
    this.disposeGhost();
  }

  public isInPlaceMode(): boolean {
    return this.placeMode;
  }

  public getPlaceModeAssetId(): string {
    return this.placeAssetId;
  }

  public getActiveHoleNumber(): number {
    return this.activeHoleNumber;
  }

  public setActiveHoleNumber(holeNumber: number): void {
    const normalized = Math.max(1, Math.floor(holeNumber));
    if (normalized === this.activeHoleNumber) return;
    this.activeHoleNumber = normalized;
    this.callbacks.onHoleNumberChange?.(this.activeHoleNumber);
  }

  public async handleClick(worldX: number, worldZ: number): Promise<void> {
    if (this.placeMode && this.placeAssetId) {
      await this.placeAsset(worldX, worldZ);
      return;
    }
    this.selectAt(worldX, worldZ);
  }

  public handleMouseMove(worldX: number, worldZ: number): void {
    if (!this.placeMode || !this.ghostMesh) return;
    const y = this.getPlacementY(worldX, worldZ, 0);
    this.ghostMesh.position.set(worldX, y, worldZ);
  }

  public async placeAsset(worldX: number, worldZ: number): Promise<void> {
    const y = this.getPlacementY(worldX, worldZ, 0);
    const holeFeature = createHoleFeatureAssignment(
      this.placeAssetId,
      this.activeHoleNumber
    );
    const asset: PlacedAsset = {
      assetId: this.placeAssetId,
      x: worldX,
      y,
      z: worldZ,
      rotation: 0,
      gameplay: holeFeature ? { holeFeature } : undefined,
    };

    const replacedCount = holeFeature
      ? this.removeConflictingHoleFeatures(holeFeature)
      : 0;
    const instance = await this.loadAndPlace(asset);
    if (instance) {
      this.placed.push({ data: asset, instance });
      this.setSelected(this.placed.length - 1);
      this.callbacks.onPlace?.(asset, { replacedCount });
    }
  }

  public selectAt(worldX: number, worldZ: number): void {
    const pickRadius = 1.5;
    let bestDist = pickRadius;
    let bestIdx = -1;

    for (let i = 0; i < this.placed.length; i++) {
      const entry = this.placed[i];
      const dx = entry.data.x - worldX;
      const dz = entry.data.z - worldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    this.setSelected(bestIdx);
  }

  public moveSelected(worldX: number, worldZ: number): void {
    if (this.selectedIndex < 0) return;
    const entry = this.placed[this.selectedIndex];
    const y = this.getPlacementY(worldX, worldZ, entry.data.y);
    entry.data.x = worldX;
    entry.data.y = y;
    entry.data.z = worldZ;
    entry.instance.root.position.set(worldX, y, worldZ);
  }

  public rotateSelected(): void {
    if (this.selectedIndex < 0) return;
    const entry = this.placed[this.selectedIndex];
    const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
    const idx = rotations.indexOf(entry.data.rotation);
    entry.data.rotation = rotations[(idx + 1) % 4];
    entry.instance.root.rotation.y = (entry.data.rotation * Math.PI) / 180;
  }

  public deleteSelected(): void {
    if (this.selectedIndex < 0) return;
    const entry = this.placed[this.selectedIndex];
    disposeInstance(entry.instance);
    this.placed.splice(this.selectedIndex, 1);
    this.selectedIndex = -1;
    this.callbacks.onSelect?.(null);
  }

  public getSelectedAsset(): PlacedAsset | null {
    if (this.selectedIndex < 0) return null;
    return this.placed[this.selectedIndex].data;
  }

  public clearSelection(): void {
    this.setSelected(-1);
  }

  public getPlacedAssets(): PlacedAsset[] {
    return this.placed.map((e) => this.cloneAsset(e.data));
  }

  public getAssignedHoleNumbers(): number[] {
    const numbers = new Set<number>();
    for (const entry of this.placed) {
      const holeNumber = entry.data.gameplay?.holeFeature?.holeNumber;
      if (typeof holeNumber === 'number' && Number.isFinite(holeNumber) && holeNumber >= 1) {
        numbers.add(Math.floor(holeNumber));
      }
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }

  public getMaxAssignedHoleNumber(): number {
    return getMaxAssignedHoleNumber(this.placed.map((entry) => entry.data));
  }

  public async loadPlacedAssets(assets: PlacedAsset[]): Promise<void> {
    for (const entry of this.placed) {
      disposeInstance(entry.instance);
    }
    this.placed = [];
    this.selectedIndex = -1;

    for (const asset of assets) {
      const normalizedAsset = {
        ...this.cloneAsset(asset),
        y: this.getPlacementY(asset.x, asset.z, asset.y),
      };
      const instance = await this.loadAndPlace(normalizedAsset);
      if (instance) {
        this.placed.push({ data: normalizedAsset, instance });
      }
    }

    const firstAssignedHole = getMinAssignedHoleNumber(
      this.placed.map((entry) => entry.data)
    );
    this.setActiveHoleNumber(firstAssignedHole);
  }

  public dispose(): void {
    this.disposeGhost();
    for (const entry of this.placed) {
      disposeInstance(entry.instance);
    }
    this.placed = [];
    this.ghostMaterial?.dispose();
  }

  private setSelected(index: number): void {
    this.selectedIndex = index;
    const asset = index >= 0 ? this.placed[index].data : null;
    this.callbacks.onSelect?.(asset ? this.cloneAsset(asset) : null);
  }

  private async loadAndPlace(asset: PlacedAsset): Promise<AssetInstance | null> {
    try {
      const loaded = await loadAsset(this.scene, asset.assetId as AssetId);
      const instance = createInstance(this.scene, loaded, `placed_${this.nextId++}`);
      instance.root.position.set(asset.x, asset.y, asset.z);
      instance.root.rotation.y = (asset.rotation * Math.PI) / 180;
      return instance;
    } catch {
      return null;
    }
  }

  private async createGhostMesh(assetId: string): Promise<void> {
    this.disposeGhost();

    if (!this.ghostMaterial) {
      this.ghostMaterial = new StandardMaterial('ghostMat', this.scene);
      this.ghostMaterial.diffuseColor = new Color3(0.5, 1, 0.5);
      this.ghostMaterial.alpha = 0.5;
      this.ghostMaterial.wireframe = true;
    }

    try {
      const loaded = await loadAsset(this.scene, assetId as AssetId);
      const instance = createInstance(this.scene, loaded, 'ghost_preview');
      for (const mesh of instance.meshes) {
        if (mesh instanceof Mesh) {
          mesh.material = this.ghostMaterial;
        }
      }
      this.ghostMesh = instance.root as Mesh;
    } catch {
      // Use a simple box fallback
      const spec = getAssetSpec(assetId as AssetId);
      const avgHeight = (spec.heightRange[0] + spec.heightRange[1]) / 2;
      this.ghostMesh = Mesh.CreateBox('ghost_box', 1, this.scene);
      this.ghostMesh.scaling.set(spec.footprint[0], avgHeight, spec.footprint[1]);
      this.ghostMesh.material = this.ghostMaterial;
    }
  }

  private disposeGhost(): void {
    if (this.ghostMesh) {
      this.ghostMesh.dispose();
      this.ghostMesh = null;
    }
  }

  private getElevation(worldX: number, worldZ: number): number {
    if (this.callbacks.getTerrainElevation) {
      return this.callbacks.getTerrainElevation(worldX, worldZ);
    }
    return 0;
  }

  private getPlacementY(worldX: number, worldZ: number, fallbackY: number): number {
    if (this.callbacks.getTerrainElevation) {
      return this.getElevation(worldX, worldZ);
    }
    return fallbackY;
  }

  private cloneAsset(asset: PlacedAsset): PlacedAsset {
    return {
      ...asset,
      gameplay: asset.gameplay ? {
        ...asset.gameplay,
        holeFeature: asset.gameplay.holeFeature
          ? { ...asset.gameplay.holeFeature }
          : undefined,
      } : undefined,
    };
  }

  private removeConflictingHoleFeatures(feature: HoleFeatureAssignment): number {
    let removedCount = 0;

    for (let i = this.placed.length - 1; i >= 0; i--) {
      const existingFeature = this.placed[i].data.gameplay?.holeFeature;
      if (!existingFeature) continue;
      if (!this.holeFeaturesConflict(existingFeature, feature)) continue;
      this.removePlacedAtIndex(i);
      removedCount += 1;
    }

    return removedCount;
  }

  private holeFeaturesConflict(
    existing: HoleFeatureAssignment,
    incoming: HoleFeatureAssignment
  ): boolean {
    if (existing.holeNumber !== incoming.holeNumber) return false;
    if (existing.kind !== incoming.kind) return false;

    if (incoming.kind === 'pin_position') {
      return true;
    }

    return (existing.teeSet ?? 'custom') === (incoming.teeSet ?? 'custom');
  }

  private removePlacedAtIndex(index: number): void {
    const entry = this.placed[index];
    disposeInstance(entry.instance);
    this.placed.splice(index, 1);

    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.callbacks.onSelect?.(null);
      return;
    }

    if (this.selectedIndex > index) {
      this.selectedIndex -= 1;
    }
  }
}
