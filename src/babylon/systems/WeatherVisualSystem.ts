import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { WeatherCondition } from "../../core/golfers";

const RAIN_DROP_COUNT = 80;
const RAIN_AREA = 40;
const RAIN_HEIGHT = 25;
const RAIN_FALL_SPEED = 35;

interface RainDrop {
  mesh: Mesh;
  velocity: number;
}

export class WeatherVisualSystem {
  private scene: Scene;
  private rainDrops: RainDrop[] = [];
  private rainMaterial: StandardMaterial | null = null;
  private activeWeather: WeatherCondition["type"] = "sunny";
  private ambientLight: HemisphericLight | null = null;
  private sunLight: DirectionalLight | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.findLights();
    this.createRainPool();
  }

  private findLights(): void {
    for (const light of this.scene.lights) {
      if (light.name === "ambient" && light instanceof HemisphericLight) {
        this.ambientLight = light;
      }
      if (light.name === "sun" && light instanceof DirectionalLight) {
        this.sunLight = light;
      }
    }
  }

  private createRainPool(): void {
    this.rainMaterial = new StandardMaterial("rainMat", this.scene);
    this.rainMaterial.diffuseColor = new Color3(0.5, 0.6, 0.9);
    this.rainMaterial.emissiveColor = new Color3(0.3, 0.4, 0.7);
    this.rainMaterial.alpha = 0.6;

    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      const mesh = MeshBuilder.CreateCylinder(
        `rain_${i}`,
        { height: 0.6, diameter: 0.03, tessellation: 4 },
        this.scene
      );
      mesh.material = this.rainMaterial;
      mesh.isPickable = false;
      mesh.setEnabled(false);

      const x = (Math.random() - 0.5) * RAIN_AREA;
      const z = (Math.random() - 0.5) * RAIN_AREA;
      const y = Math.random() * RAIN_HEIGHT;
      mesh.position = new Vector3(x, y, z);

      this.rainDrops.push({
        mesh,
        velocity: RAIN_FALL_SPEED + Math.random() * 10,
      });
    }
  }

  update(deltaMs: number, weather: WeatherCondition, cameraTarget: Vector3): void {
    const weatherType = weather.type;
    const dt = deltaMs / 1000;

    if (weatherType !== this.activeWeather) {
      this.transitionTo(weatherType);
    }

    if (weatherType === "rainy" || weatherType === "stormy") {
      this.updateRain(dt, cameraTarget, weatherType === "stormy");
    }
  }

  private transitionTo(type: WeatherCondition["type"]): void {
    this.activeWeather = type;

    const showRain = type === "rainy" || type === "stormy";
    for (const drop of this.rainDrops) {
      drop.mesh.setEnabled(showRain);
    }

    this.applyLighting(type);
  }

  private applyLighting(type: WeatherCondition["type"]): void {
    if (!this.ambientLight || !this.sunLight) return;

    switch (type) {
      case "sunny":
        this.ambientLight.intensity = 0.75;
        this.ambientLight.diffuse = new Color3(1.0, 0.98, 0.88);
        this.ambientLight.groundColor = new Color3(0.45, 0.42, 0.35);
        this.sunLight.intensity = 0.9;
        this.sunLight.diffuse = new Color3(1.0, 0.95, 0.82);
        break;
      case "cloudy":
        this.ambientLight.intensity = 0.55;
        this.ambientLight.diffuse = new Color3(0.8, 0.8, 0.82);
        this.ambientLight.groundColor = new Color3(0.35, 0.35, 0.38);
        this.sunLight.intensity = 0.45;
        this.sunLight.diffuse = new Color3(0.85, 0.85, 0.88);
        break;
      case "rainy":
        this.ambientLight.intensity = 0.4;
        this.ambientLight.diffuse = new Color3(0.65, 0.68, 0.75);
        this.ambientLight.groundColor = new Color3(0.28, 0.3, 0.35);
        this.sunLight.intensity = 0.3;
        this.sunLight.diffuse = new Color3(0.7, 0.72, 0.78);
        break;
      case "stormy":
        this.ambientLight.intensity = 0.3;
        this.ambientLight.diffuse = new Color3(0.5, 0.52, 0.6);
        this.ambientLight.groundColor = new Color3(0.2, 0.22, 0.28);
        this.sunLight.intensity = 0.2;
        this.sunLight.diffuse = new Color3(0.55, 0.55, 0.65);
        break;
    }
  }

  private updateRain(dt: number, cameraTarget: Vector3, isStorm: boolean): void {
    const speed = isStorm ? 1.4 : 1.0;
    const windOffset = isStorm ? 8 : 2;

    for (const drop of this.rainDrops) {
      const pos = drop.mesh.position;
      pos.y -= drop.velocity * speed * dt;
      pos.x += windOffset * dt;

      if (pos.y < 0) {
        pos.y = RAIN_HEIGHT + Math.random() * 3;
        pos.x = cameraTarget.x + (Math.random() - 0.5) * RAIN_AREA;
        pos.z = cameraTarget.z + (Math.random() - 0.5) * RAIN_AREA;
        drop.velocity = RAIN_FALL_SPEED + Math.random() * 10;
      }
    }
  }

  dispose(): void {
    for (const drop of this.rainDrops) {
      drop.mesh.dispose();
    }
    this.rainDrops = [];
    this.rainMaterial?.dispose();
    this.rainMaterial = null;
  }
}
