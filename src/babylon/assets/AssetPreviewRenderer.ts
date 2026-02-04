import { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4, Color3 } from '@babylonjs/core/Maths/math.color';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Tools } from '@babylonjs/core/Misc/tools';
import '@babylonjs/core/Misc/screenshotTools';
import '@babylonjs/loaders/glTF';

import { AssetId, getAssetSpec, getAssetPath } from './AssetManifest';
import { createPlaceholderAsset, assetFileExists } from './PlaceholderMeshes';

const PREVIEW_WIDTH = 128;
const PREVIEW_HEIGHT = 96;

export class AssetPreviewRenderer {
  private engine: AbstractEngine;
  private scene: Scene;
  private camera: FreeCamera;
  private cache: Map<string, string> = new Map();
  private queue: Promise<void> = Promise.resolve();

  constructor(engine: AbstractEngine) {
    this.engine = engine;

    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.08, 0.15, 0.1, 1);
    this.scene.autoClear = true;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.detachControl();

    this.camera = new FreeCamera('previewCam', new Vector3(0, 0, 0), this.scene);
    this.camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.01;
    this.camera.maxZ = 100;

    const light = new HemisphericLight('previewLight', new Vector3(0.3, 1, -0.5), this.scene);
    light.intensity = 1.2;
    light.groundColor = new Color3(0.3, 0.3, 0.3);
  }

  renderPreview(assetId: AssetId): Promise<string> {
    const cached = this.cache.get(assetId);
    if (cached) return Promise.resolve(cached);

    const promise = this.queue.then(() => this.renderSingle(assetId));
    this.queue = promise.then(() => {}, () => {});
    return promise;
  }

  private async renderSingle(assetId: AssetId): Promise<string> {
    const cached = this.cache.get(assetId);
    if (cached) return cached;

    const spec = getAssetSpec(assetId);
    const height = (spec.heightRange[0] + spec.heightRange[1]) / 2;
    const [footW, footD] = spec.footprint;

    const meshes = await this.loadIntoPreviewScene(assetId);

    const maxDim = Math.max(footW, footD, height) * 1.2;
    const aspect = PREVIEW_WIDTH / PREVIEW_HEIGHT;
    const orthoH = maxDim / 2;
    const orthoW = orthoH * aspect;

    this.camera.orthoLeft = -orthoW;
    this.camera.orthoRight = orthoW;
    this.camera.orthoTop = orthoH;
    this.camera.orthoBottom = -orthoH;

    const centerY = height / 2;
    const dist = maxDim * 2;
    const angle = Math.PI / 6;
    this.camera.position = new Vector3(
      dist * Math.sin(Math.PI / 4) * Math.cos(angle),
      centerY + dist * Math.sin(angle),
      -dist * Math.cos(Math.PI / 4) * Math.cos(angle)
    );
    this.camera.setTarget(new Vector3(0, centerY, 0));

    this.scene.render();

    const dataUrl = await Tools.CreateScreenshotUsingRenderTargetAsync(
      this.engine,
      this.camera,
      { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
    );

    for (const mesh of meshes) {
      mesh.dispose();
    }

    this.cache.set(assetId, dataUrl);
    return dataUrl;
  }

  private async loadIntoPreviewScene(assetId: AssetId): Promise<import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh[]> {
    const path = getAssetPath(assetId);
    const exists = await assetFileExists(path);

    if (!exists) {
      const placeholder = createPlaceholderAsset(this.scene, assetId);
      placeholder.rootMesh.setEnabled(true);
      return placeholder.meshes;
    }

    const directory = path.substring(0, path.lastIndexOf('/') + 1);
    const filename = path.substring(path.lastIndexOf('/') + 1);

    try {
      const result = await SceneLoader.ImportMeshAsync('', directory, filename, this.scene);

      for (const mesh of result.meshes) {
        if (mesh.material instanceof PBRMaterial) {
          const pbr = mesh.material;
          const std = new StandardMaterial(`${mesh.material.name}_prev`, this.scene);
          std.diffuseColor = pbr.albedoColor || std.diffuseColor;
          std.emissiveColor = (pbr.emissiveColor || std.diffuseColor).scale(0.3);
          std.specularColor = std.diffuseColor.scale(0.1);
          mesh.material = std;
        }
      }

      for (const group of result.animationGroups) {
        group.dispose();
      }

      return result.meshes;
    } catch {
      const placeholder = createPlaceholderAsset(this.scene, assetId);
      placeholder.rootMesh.setEnabled(true);
      return placeholder.meshes;
    }
  }

  dispose(): void {
    this.cache.clear();
    this.scene.dispose();
  }
}
