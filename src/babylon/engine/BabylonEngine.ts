import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Camera } from "@babylonjs/core/Cameras/camera";
import {
  SceneOptimizer,
  SceneOptimizerOptions,
} from "@babylonjs/core/Misc/sceneOptimizer";

export const TILE_SIZE = 1;
export const HEIGHT_UNIT = 0.2;

export function gridTo3D(
  gridX: number,
  gridY: number,
  elevation: number
): Vector3 {
  return new Vector3(
    gridX * TILE_SIZE,
    elevation * HEIGHT_UNIT,
    gridY * TILE_SIZE
  );
}

export class BabylonEngine {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private mapWidth: number;
  private mapHeight: number;
  private cameraDistance: number = 100;
  private cameraRotationY: number = Math.PI / 4;
  private cameraTarget: Vector3 = Vector3.Zero();
  private resizeHandler: (() => void) | null = null;

  private orthoSize: number = 8;
  private targetOrthoSize: number = 8;
  private readonly MIN_ORTHO_SIZE = 2;
  private readonly MAX_ORTHO_SIZE = 50;

  constructor(canvasId: string, mapWidth: number = 50, mapHeight: number = 38) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
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

    SceneOptimizer.OptimizeAsync(
      scene,
      SceneOptimizerOptions.ModerateDegradationAllowed()
    );

    return scene;
  }

  private setupCamera(): ArcRotateCamera {
    const centerX = (this.mapWidth * TILE_SIZE) / 2;
    const centerZ = (this.mapHeight * TILE_SIZE) / 2;
    this.cameraTarget = new Vector3(centerX, 0, centerZ);

    const rctAngle = Math.PI / 3; // 60 degrees from vertical - side-on RCT-style view

    const camera = new ArcRotateCamera(
      "camera",
      this.cameraRotationY,
      rctAngle,
      this.cameraDistance,
      this.cameraTarget,
      this.scene
    );

    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

    const aspectRatio = this.canvas.width / this.canvas.height;
    const orthoSize = 8; // Close zoom default

    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * aspectRatio;
    camera.orthoRight = orthoSize * aspectRatio;

    camera.minZ = 0.1;
    camera.maxZ = 500;

    return camera;
  }

  private setupLighting(): void {
    const ambient = new HemisphericLight(
      "ambient",
      new Vector3(0, 1, 0),
      this.scene
    );
    ambient.intensity = 0.7;
    ambient.diffuse = new Color3(1, 1, 0.95);
    ambient.groundColor = new Color3(0.4, 0.4, 0.35);

    const sun = new DirectionalLight(
      "sun",
      new Vector3(-1, -2, -1),
      this.scene
    );
    sun.intensity = 0.8;
    sun.diffuse = new Color3(1, 0.98, 0.9);
  }

  private setupResizeHandler(): void {
    this.resizeHandler = () => {
      this.engine.resize();
      this.updateCameraAspect();
    };
    window.addEventListener("resize", this.resizeHandler);
  }

  private updateCameraAspect(): void {
    const aspectRatio = this.canvas.width / this.canvas.height;
    const orthoSize = Math.abs(this.camera.orthoTop || 20);

    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
  }

  public gridTo3D(gX: number, gY: number, elev: number): Vector3 {
    return gridTo3D(gX, gY, elev);
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

  public getCamera(): ArcRotateCamera {
    return this.camera;
  }

  public getEngine(): Engine {
    return this.engine;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setZoomLevel(level: "tight" | "closer" | "close" | "far"): void {
    const sizes = { tight: 0.8, closer: 4, close: 8, far: 35 };
    this.setOrthoSize(sizes[level]);
  }

  public getOrthoSize(): number {
    return Math.abs(this.camera.orthoTop || 8);
  }

  public setOrthoSize(orthoSize: number): void {
    const aspectRatio = this.canvas.width / this.canvas.height;
    this.camera.orthoTop = orthoSize;
    this.camera.orthoBottom = -orthoSize;
    this.camera.orthoLeft = -orthoSize * aspectRatio;
    this.camera.orthoRight = orthoSize * aspectRatio;
  }

  public rotateCamera(deltaAngle: number): void {
    this.camera.alpha += deltaAngle;
    // We don't track cameraRotationY manually anymore as source of truth,
    // but if we need it for persistence:
    this.cameraRotationY = this.camera.alpha;
  }

  public setCameraTarget(target: Vector3): void {
    this.cameraTarget = target;
    this.camera.setTarget(target);
  }

  public getCameraTarget(): Vector3 {
    return this.cameraTarget.clone();
  }

  public setCameraTargetGrid(
    gridX: number,
    gridY: number,
    elevation: number = 0
  ): void {
    this.cameraTarget = this.gridTo3D(gridX + 0.5, gridY + 0.5, elevation);
    this.camera.setTarget(this.cameraTarget);
  }

  public handleZoom(delta: number): void {
    const zoomFactor = 0.001;
    const newTarget = this.targetOrthoSize * (1 + delta * zoomFactor);
    this.targetOrthoSize = Math.max(
      this.MIN_ORTHO_SIZE,
      Math.min(this.MAX_ORTHO_SIZE, newTarget)
    );
  }

  public updateSmoothZoom(deltaMs: number): void {
    const diff = this.targetOrthoSize - this.orthoSize;
    if (Math.abs(diff) < 0.001) {
      this.orthoSize = this.targetOrthoSize;
      return;
    }
    const lerpFactor = 1 - Math.exp(-deltaMs * 0.015);
    this.orthoSize += diff * lerpFactor;
    this.setOrthoSize(this.orthoSize);
  }

  public setTargetOrthoSize(size: number): void {
    this.targetOrthoSize = Math.max(this.MIN_ORTHO_SIZE, Math.min(this.MAX_ORTHO_SIZE, size));
    this.orthoSize = this.targetOrthoSize;
    this.setOrthoSize(this.orthoSize);
  }

  public updateCameraPan(deltaMs: number, directions: { up: boolean; down: boolean; left: boolean; right: boolean }): void {
    if (!directions.up && !directions.down && !directions.left && !directions.right) return;

    const speed = this.getOrthoSize() * 1.5;
    const moveDist = (speed * deltaMs) / 1000;

    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());

    forward.y = 0;
    forward.normalize();
    right.y = 0;
    right.normalize();

    const delta = Vector3.Zero();

    if (directions.up) delta.addInPlace(forward);
    if (directions.down) delta.subtractInPlace(forward);
    if (directions.right) delta.addInPlace(right);
    if (directions.left) delta.subtractInPlace(right);

    delta.scaleInPlace(moveDist);

    this.camera.target.addInPlace(delta);
    this.camera.position.addInPlace(delta);
  }

  public screenToWorldPosition(screenX: number, screenY: number): { x: number; z: number } | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    const pickResult = this.scene.pick(canvasX, canvasY, (mesh) => {
      return mesh.name.startsWith('terrain') || mesh.name.startsWith('tile_') || mesh.name === 'vectorTerrain';
    });

    if (pickResult?.hit && pickResult.pickedPoint) {
      return { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z };
    }

    const ray = this.scene.createPickingRay(canvasX, canvasY, null, this.camera);
    if (ray.direction.y === 0) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    return {
      x: ray.origin.x + ray.direction.x * t,
      z: ray.origin.z + ray.direction.z * t,
    };
  }

  public dispose(): void {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.engine.dispose();
  }
}
