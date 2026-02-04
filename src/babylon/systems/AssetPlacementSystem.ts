import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import { loadAsset, createInstance, disposeInstance, AssetInstance } from '../assets/AssetLoader';
import { AssetId, getAssetSpec } from '../assets/AssetManifest';
import { PlacedAsset } from '../../data/customCourseData';

interface PlacedAssetEntry {
  data: PlacedAsset;
  instance: AssetInstance;
}

export interface AssetPlacementCallbacks {
  onSelect?: (asset: PlacedAsset | null) => void;
  onPlace?: (asset: PlacedAsset) => void;
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

  public async handleClick(worldX: number, worldZ: number): Promise<void> {
    if (this.placeMode && this.placeAssetId) {
      await this.placeAsset(worldX, worldZ);
      return;
    }
    this.selectAt(worldX, worldZ);
  }

  public handleMouseMove(worldX: number, worldZ: number): void {
    if (!this.placeMode || !this.ghostMesh) return;
    const y = this.getElevation(worldX, worldZ);
    this.ghostMesh.position.set(worldX, y, worldZ);
  }

  public async placeAsset(worldX: number, worldZ: number): Promise<void> {
    const y = this.getElevation(worldX, worldZ);
    const asset: PlacedAsset = {
      assetId: this.placeAssetId,
      x: worldX,
      y,
      z: worldZ,
      rotation: 0,
    };

    const instance = await this.loadAndPlace(asset);
    if (instance) {
      this.placed.push({ data: asset, instance });
      this.callbacks.onPlace?.(asset);
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
    const y = this.getElevation(worldX, worldZ);
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
    return this.placed.map(e => ({ ...e.data }));
  }

  public async loadPlacedAssets(assets: PlacedAsset[]): Promise<void> {
    for (const entry of this.placed) {
      disposeInstance(entry.instance);
    }
    this.placed = [];
    this.selectedIndex = -1;

    for (const asset of assets) {
      const instance = await this.loadAndPlace(asset);
      if (instance) {
        this.placed.push({ data: { ...asset }, instance });
      }
    }
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
    this.callbacks.onSelect?.(asset);
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
}
