import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Camera } from '@babylonjs/core/Cameras/camera';

import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from '../../core/terrain';

export class BabylonEngine {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;

  constructor(canvasId: string, _mapWidth: number = 50, _mapHeight: number = 38) {

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id '${canvasId}' not found`);
    }
    this.canvas = canvas;

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = this.createScene();
    this.camera = this.setupCamera();
    this.setupLighting();

    this.setupResizeHandler();
  }

  private createScene(): Scene {
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    scene.skipFrustumClipping = true;
    return scene;
  }

  private setupCamera(): FreeCamera {
    const centerX = 100;
    const centerY = -700;
    const camera = new FreeCamera('camera', new Vector3(centerX, centerY, -500), this.scene);
    camera.setTarget(new Vector3(centerX, centerY, 50));

    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

    const aspectRatio = this.canvas.width / this.canvas.height;
    const orthoSize = 800;

    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * aspectRatio;
    camera.orthoRight = orthoSize * aspectRatio;

    camera.minZ = 0.1;
    camera.maxZ = 1000;

    return camera;
  }

  private setupLighting(): void {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.7;
    ambient.diffuse = new Color3(1, 1, 0.95);
    ambient.groundColor = new Color3(0.4, 0.4, 0.35);

    const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), this.scene);
    sun.intensity = 0.8;
    sun.diffuse = new Color3(1, 0.98, 0.9);
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      this.engine.resize();
      this.updateCameraAspect();
    });
  }

  private updateCameraAspect(): void {
    const aspectRatio = this.canvas.width / this.canvas.height;
    const orthoSize = Math.abs(this.camera.orthoTop || 400);

    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
  }

  public gridTo3D(gridX: number, gridY: number, elevation: number): Vector3 {
    const worldX = (gridX - gridY) * (TILE_WIDTH / 2);
    const worldZ = (gridX + gridY) * (TILE_HEIGHT / 2);
    const worldY = elevation * ELEVATION_HEIGHT;
    return new Vector3(worldX, worldY, worldZ);
  }

  public start(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  public stop(): void {
    this.engine.stopRenderLoop();
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getCamera(): FreeCamera {
    return this.camera;
  }

  public getEngine(): Engine {
    return this.engine;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setZoom(zoomLevel: number): void {
    const orthoSize = 400 / zoomLevel;
    const aspectRatio = this.canvas.width / this.canvas.height;

    this.camera.orthoTop = orthoSize;
    this.camera.orthoBottom = -orthoSize;
    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
  }

  public panTo(gridX: number, gridY: number, elevation: number = 0): void {
    const targetPos = this.gridTo3D(gridX, gridY, elevation);

    const currentDir = this.camera.getTarget().subtract(this.camera.position);
    this.camera.position = targetPos.subtract(currentDir);
    this.camera.setTarget(targetPos);
  }

  public dispose(): void {
    this.engine.dispose();
  }
}
