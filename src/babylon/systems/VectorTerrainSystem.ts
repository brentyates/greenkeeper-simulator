/**
 * VectorTerrainSystem - SDF-based vector terrain rendering
 *
 * Replaces tile-based terrain with smooth, vector-defined boundaries.
 * Uses signed distance fields for pixel-perfect edges at any zoom level.
 *
 * Architecture:
 * - Vector shapes define terrain boundaries (splines with tension control)
 * - SDF textures are generated from vector shapes
 * - Custom shader samples SDFs for smooth blending
 * - Grid layer maintained for health simulation (synced from vectors)
 */

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

import {
  VectorShape,
  ControlPoint,
  TerrainShapeType,
  createCircleShape,
  createEllipseShape,
  createFairwayShape,
} from "../../core/vector-shapes";

import {
  SDFTextureSet,
  generateSDFFromGrid,
  updateSDFFromGrid,
  SDFGeneratorOptions,
} from "./SDFGenerator";

import {
  terrainVertexShader,
  terrainFragmentShader,
  getDefaultUniforms,
} from "../shaders/terrainShader";

import { HEIGHT_UNIT, gridTo3D } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CellState, TerrainType, getTerrainType, getInitialValues, calculateHealth, TERRAIN_CODES, OverlayMode } from "../../core/terrain";
import { simulateGrowth, applyMowing, applyWatering, applyFertilizing, getAverageStats, WeatherEffect } from "../../core/grass-simulation";

export interface VectorTerrainOptions {
  /** SDF resolution multiplier */
  sdfResolution: number;
  /** Edge blend width in world units */
  edgeBlend: number;
  /** Enable mowing stripe patterns */
  enableStripes: boolean;
  /** Enable grass noise variation */
  enableNoise: boolean;
  /** Enable water animation */
  enableWaterAnim: boolean;
  /** Mesh subdivisions per world unit */
  meshResolution: number;
}

const DEFAULT_OPTIONS: VectorTerrainOptions = {
  sdfResolution: 4,
  edgeBlend: 0.3,
  enableStripes: true,
  enableNoise: true,
  enableWaterAnim: true,
  meshResolution: 1,
};

export class VectorTerrainSystem {
  private scene: Scene;
  private options: VectorTerrainOptions;

  // Vector data
  private shapes: VectorShape[] = [];
  private worldWidth: number;
  private worldHeight: number;
  private elevation: number[][];
  private layoutGrid: number[][];  // Keep original grid for SDF generation

  // Rendering
  private terrainMesh: Mesh | null = null;
  private shaderMaterial: ShaderMaterial | null = null;
  private sdfTextures: SDFTextureSet | null = null;
  private healthTexture: RawTexture | null = null;  // Health data for overlays
  private cliffMeshes: Mesh[] = [];  // Edge cliff faces

  // Grid layer for simulation (synced from vectors)
  private cells: CellState[][] = [];

  // Animation
  private time: number = 0;
  private gameTime: number = 0;

  // Dirty tracking
  private shapesDirty: boolean = false;

  // Overlay mode
  private overlayMode: OverlayMode = "normal";

  constructor(
    scene: Scene,
    courseData: CourseData,
    options: Partial<VectorTerrainOptions> = {}
  ) {
    this.scene = scene;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.worldWidth = courseData.width;
    this.worldHeight = courseData.height;
    this.elevation = courseData.elevation || [];
    this.layoutGrid = courseData.layout;  // Store for grid-based SDF

    // Initialize cells for simulation
    this.initCells(courseData);

    // Shapes array is for future vector-based editing
    // For now, SDF is generated directly from the grid (more reliable)
    this.shapes = [];

    // Register shader
    this.registerShader();
  }

  /**
   * Initialize grid cells for health simulation
   */
  private initCells(courseData: CourseData): void {
    const { width, height, layout } = courseData;

    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const terrainType = getTerrainType(terrainCode);
        const elev = this.elevation[y]?.[x] ?? 0;
        const initialValues = getInitialValues(terrainType);

        const cell: CellState = {
          x,
          y,
          type: terrainType,
          height: initialValues.height,
          moisture: initialValues.moisture,
          nutrients: initialValues.nutrients,
          health: 100,
          elevation: elev,
          obstacle: "none",
          lastMowed: 0,
          lastWatered: 0,
          lastFertilized: 0,
        };
        cell.health = calculateHealth(cell);
        this.cells[y][x] = cell;
      }
    }
  }

  /**
   * Register the terrain shader with Babylon.js
   */
  private registerShader(): void {
    Effect.ShadersStore["terrainVertexShader"] = terrainVertexShader;
    Effect.ShadersStore["terrainFragmentShader"] = terrainFragmentShader;
  }

  /**
   * Build the terrain (mesh, textures, shader)
   */
  public build(): void {
    this.createTerrainMesh();
    this.createCliffFaces();
    this.generateSDFTextures();
    this.createShaderMaterial();
    this.applyMaterial();
  }

  /**
   * Create the terrain mesh with elevation
   */
  private createTerrainMesh(): void {
    const { worldWidth, worldHeight, options } = this;
    const subdivisions = Math.ceil(options.meshResolution);

    const gridW = Math.ceil(worldWidth * subdivisions);
    const gridH = Math.ceil(worldHeight * subdivisions);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // Create vertices
    for (let gy = 0; gy <= gridH; gy++) {
      for (let gx = 0; gx <= gridW; gx++) {
        const worldX = (gx / gridW) * worldWidth;
        const worldZ = (gy / gridH) * worldHeight;

        // Sample elevation (interpolate between grid cells)
        const elevation = this.getInterpolatedElevation(worldX, worldZ);
        const worldY = elevation * HEIGHT_UNIT;

        positions.push(worldX, worldY, worldZ);
        uvs.push(gx / gridW, gy / gridH);
      }
    }

    // Create indices
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const topLeft = gy * (gridW + 1) + gx;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + (gridW + 1);
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    // Compute normals
    VertexData.ComputeNormals(positions, indices, normals);

    // Create mesh
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;

    if (this.terrainMesh) {
      this.terrainMesh.dispose();
    }

    this.terrainMesh = new Mesh("vectorTerrain", this.scene);
    vertexData.applyToMesh(this.terrainMesh, true);

    this.terrainMesh.freezeWorldMatrix();
  }

  /**
   * Create cliff faces at terrain edges to prevent floating appearance
   */
  private createCliffFaces(): void {
    // Dispose old cliff meshes
    for (const mesh of this.cliffMeshes) {
      mesh.dispose();
    }
    this.cliffMeshes = [];

    const cliffDepth = 1.5;  // How far down the cliff extends

    // Create material for cliffs
    const cliffMaterial = new StandardMaterial("cliffMaterial", this.scene);
    cliffMaterial.diffuseColor = new Color3(0.6, 0.5, 0.35);
    cliffMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    cliffMaterial.backFaceCulling = false;

    // Create right edge cliff
    const rightCliff = this.createEdgeCliff("right", cliffDepth);
    rightCliff.material = cliffMaterial;
    this.cliffMeshes.push(rightCliff);

    // Create bottom edge cliff
    const bottomCliff = this.createEdgeCliff("bottom", cliffDepth);
    bottomCliff.material = cliffMaterial;
    this.cliffMeshes.push(bottomCliff);
  }

  /**
   * Create a cliff strip along an edge
   */
  private createEdgeCliff(side: "right" | "bottom", cliffDepth: number): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const topColor = side === "right"
      ? new Color4(0.72, 0.58, 0.42, 1)
      : new Color4(0.58, 0.48, 0.35, 1);
    const bottomColor = side === "right"
      ? new Color4(0.52, 0.42, 0.3, 1)
      : new Color4(0.42, 0.35, 0.25, 1);

    const segments = 20;  // Higher resolution for smoother cliff

    if (side === "right") {
      const x = this.worldWidth;
      for (let i = 0; i < segments; i++) {
        const y1 = (i / segments) * this.worldHeight;
        const y2 = ((i + 1) / segments) * this.worldHeight;

        const elev1 = this.getInterpolatedElevation(x - 0.01, y1) * HEIGHT_UNIT;
        const elev2 = this.getInterpolatedElevation(x - 0.01, y2) * HEIGHT_UNIT;

        const baseIdx = positions.length / 3;

        // Top edge vertices (along terrain)
        positions.push(x, elev1, y1);
        positions.push(x, elev2, y2);
        // Bottom edge vertices
        positions.push(x, elev2 - cliffDepth, y2);
        positions.push(x, elev1 - cliffDepth, y1);

        // Top vertices get top color, bottom get bottom color
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

        // Two triangles for the quad
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    } else {
      // bottom edge
      const y = this.worldHeight;
      for (let i = 0; i < segments; i++) {
        const x1 = (i / segments) * this.worldWidth;
        const x2 = ((i + 1) / segments) * this.worldWidth;

        const elev1 = this.getInterpolatedElevation(x1, y - 0.01) * HEIGHT_UNIT;
        const elev2 = this.getInterpolatedElevation(x2, y - 0.01) * HEIGHT_UNIT;

        const baseIdx = positions.length / 3;

        // Top edge vertices (along terrain)
        positions.push(x1, elev1, y);
        positions.push(x2, elev2, y);
        // Bottom edge vertices
        positions.push(x2, elev2 - cliffDepth, y);
        positions.push(x1, elev1 - cliffDepth, y);

        // Top vertices get top color, bottom get bottom color
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

        // Two triangles for the quad
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`edgeCliff_${side}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.useVertexColors = true;

    return mesh;
  }

  /**
   * Get interpolated elevation at a world position
   */
  private getInterpolatedElevation(worldX: number, worldZ: number): number {
    const { elevation } = this;
    if (!elevation || elevation.length === 0) return 0;

    const height = elevation.length;
    const width = elevation[0]?.length || 0;

    // Clamp to grid bounds
    const fx = Math.max(0, Math.min(width - 1.001, worldX));
    const fz = Math.max(0, Math.min(height - 1.001, worldZ));

    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, width - 1);
    const z1 = Math.min(z0 + 1, height - 1);

    const tx = fx - x0;
    const tz = fz - z0;

    // Bilinear interpolation
    const e00 = elevation[z0]?.[x0] ?? 0;
    const e10 = elevation[z0]?.[x1] ?? 0;
    const e01 = elevation[z1]?.[x0] ?? 0;
    const e11 = elevation[z1]?.[x1] ?? 0;

    const e0 = e00 * (1 - tx) + e10 * tx;
    const e1 = e01 * (1 - tx) + e11 * tx;

    return e0 * (1 - tz) + e1 * tz;
  }

  /**
   * Generate SDF textures from grid layout
   */
  private generateSDFTextures(): void {
    const sdfOptions: Partial<SDFGeneratorOptions> = {
      resolution: this.options.sdfResolution,
      maxDistance: 5,
    };

    // Use grid-based SDF generation (more reliable than vector conversion)
    this.sdfTextures = generateSDFFromGrid(
      this.scene,
      this.layoutGrid,
      this.worldWidth,
      this.worldHeight,
      sdfOptions
    );

    // Create health texture for overlay modes
    this.createHealthTexture();
  }

  /**
   * Create or update the health data texture
   * Encodes: R=moisture, G=nutrients, B=height, A=health (all normalized 0-1)
   */
  private createHealthTexture(): void {
    const texWidth = this.worldWidth;
    const texHeight = this.worldHeight;
    const data = new Uint8Array(texWidth * texHeight * 4);

    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const cell = this.cells[y]?.[x];
        const idx = (y * texWidth + x) * 4;

        if (cell && cell.type !== 'water' && cell.type !== 'bunker') {
          // Normalize values to 0-255 range
          data[idx + 0] = Math.min(255, Math.max(0, Math.round((cell.moisture / 100) * 255)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round((cell.nutrients / 100) * 255)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round((cell.height / 5) * 255)));  // Max height ~5 inches
          data[idx + 3] = Math.min(255, Math.max(0, Math.round((cell.health / 100) * 255)));
        } else {
          // Water/bunker - neutral values
          data[idx + 0] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 128;
        }
      }
    }

    if (this.healthTexture) {
      // Update existing texture
      this.healthTexture.update(data);
    } else {
      // Create new texture
      this.healthTexture = RawTexture.CreateRGBATexture(
        data,
        texWidth,
        texHeight,
        this.scene,
        false,  // generateMipMaps
        false,  // invertY
        Engine.TEXTURE_NEAREST_SAMPLINGMODE  // Use nearest for pixel-perfect cell data
      );
      this.healthTexture.name = "healthData";
      this.healthTexture.wrapU = RawTexture.CLAMP_ADDRESSMODE;
      this.healthTexture.wrapV = RawTexture.CLAMP_ADDRESSMODE;
    }
  }

  /**
   * Update the health texture when cell data changes
   */
  private updateHealthTexture(): void {
    if (!this.healthTexture) return;

    const texWidth = this.worldWidth;
    const texHeight = this.worldHeight;
    const data = new Uint8Array(texWidth * texHeight * 4);

    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const cell = this.cells[y]?.[x];
        const idx = (y * texWidth + x) * 4;

        if (cell && cell.type !== 'water' && cell.type !== 'bunker') {
          data[idx + 0] = Math.min(255, Math.max(0, Math.round((cell.moisture / 100) * 255)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round((cell.nutrients / 100) * 255)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round((cell.height / 5) * 255)));
          data[idx + 3] = Math.min(255, Math.max(0, Math.round((cell.health / 100) * 255)));
        } else {
          data[idx + 0] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 128;
        }
      }
    }

    this.healthTexture.update(data);
  }

  /**
   * Create the terrain shader material
   */
  private createShaderMaterial(): void {
    if (!this.sdfTextures || !this.healthTexture) return;

    this.shaderMaterial = new ShaderMaterial(
      "terrainShader",
      this.scene,
      {
        vertex: "terrain",
        fragment: "terrain",
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: [
          "world",
          "worldViewProjection",
          "worldSize",
          "time",
          "edgeBlend",
          "maxSdfDistance",
          "overlayMode",
          "roughColor",
          "fairwayColor",
          "greenColor",
          "bunkerColor",
          "waterColor",
          "waterDeepColor",
          "teeColor",
          "enableStripes",
          "enableNoise",
          "enableWaterAnim",
        ],
        samplers: ["sdfCombined", "sdfTee", "healthData"],
      }
    );

    // Set textures
    this.shaderMaterial.setTexture("sdfCombined", this.sdfTextures.combined);
    this.shaderMaterial.setTexture("sdfTee", this.sdfTextures.tee);
    this.shaderMaterial.setTexture("healthData", this.healthTexture);

    // Set uniforms
    const uniforms = getDefaultUniforms(this.worldWidth, this.worldHeight);
    this.shaderMaterial.setVector2("worldSize", new Vector2(this.worldWidth, this.worldHeight));
    this.shaderMaterial.setFloat("time", 0);
    this.shaderMaterial.setFloat("edgeBlend", this.options.edgeBlend);
    this.shaderMaterial.setFloat("maxSdfDistance", uniforms.maxSdfDistance);
    this.shaderMaterial.setFloat("overlayMode", this.getOverlayModeValue());

    // Set colors
    this.shaderMaterial.setColor3("roughColor", new Color3(...uniforms.roughColor));
    this.shaderMaterial.setColor3("fairwayColor", new Color3(...uniforms.fairwayColor));
    this.shaderMaterial.setColor3("greenColor", new Color3(...uniforms.greenColor));
    this.shaderMaterial.setColor3("bunkerColor", new Color3(...uniforms.bunkerColor));
    this.shaderMaterial.setColor3("waterColor", new Color3(...uniforms.waterColor));
    this.shaderMaterial.setColor3("waterDeepColor", new Color3(...uniforms.waterDeepColor));
    this.shaderMaterial.setColor3("teeColor", new Color3(...uniforms.teeColor));

    // Set feature toggles
    this.shaderMaterial.setFloat("enableStripes", this.options.enableStripes ? 1 : 0);
    this.shaderMaterial.setFloat("enableNoise", this.options.enableNoise ? 1 : 0);
    this.shaderMaterial.setFloat("enableWaterAnim", this.options.enableWaterAnim ? 1 : 0);

    this.shaderMaterial.backFaceCulling = false;
  }

  /**
   * Convert overlay mode string to numeric value for shader
   */
  private getOverlayModeValue(): number {
    switch (this.overlayMode) {
      case "normal": return 0;
      case "moisture": return 1;
      case "nutrients": return 2;
      case "height": return 3;
      case "irrigation": return 4;  // Use health overlay for irrigation
      default: return 0;
    }
  }

  /**
   * Apply the shader material to the terrain mesh
   */
  private applyMaterial(): void {
    if (this.terrainMesh && this.shaderMaterial) {
      this.terrainMesh.material = this.shaderMaterial;
    }
  }

  /**
   * Update animation and dirty terrain
   */
  public update(deltaMs: number): void {
    this.time += deltaMs / 1000;

    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("time", this.time);
    }

    if (this.shapesDirty) {
      this.rebuildSDFTextures();
      this.shapesDirty = false;
    }
  }

  /**
   * Rebuild SDF textures (called when layout changes)
   */
  private rebuildSDFTextures(): void {
    if (!this.sdfTextures) return;

    // Sync layout grid from cells
    this.syncLayoutFromCells();

    updateSDFFromGrid(
      this.sdfTextures,
      this.layoutGrid,
      this.worldWidth,
      this.worldHeight,
      { resolution: this.options.sdfResolution }
    );
  }

  /**
   * Sync layoutGrid from cells (for when cells change via editor)
   */
  private syncLayoutFromCells(): void {
    for (let y = 0; y < this.cells.length; y++) {
      if (!this.layoutGrid[y]) this.layoutGrid[y] = [];
      for (let x = 0; x < this.cells[y].length; x++) {
        const cell = this.cells[y][x];
        switch (cell.type) {
          case 'fairway': this.layoutGrid[y][x] = 0; break;
          case 'rough': this.layoutGrid[y][x] = 1; break;
          case 'green': this.layoutGrid[y][x] = 2; break;
          case 'bunker': this.layoutGrid[y][x] = 3; break;
          case 'water': this.layoutGrid[y][x] = 4; break;
          case 'tee': this.layoutGrid[y][x] = 5; break;
          default: this.layoutGrid[y][x] = 1; break;
        }
      }
    }
  }

  // ============================================
  // Shape manipulation API
  // ============================================

  /**
   * Add a new shape
   */
  public addShape(shape: VectorShape): string {
    this.shapes.push(shape);
    this.shapesDirty = true;
    return shape.id;
  }

  /**
   * Remove a shape by ID
   */
  public removeShape(shapeId: string): boolean {
    const index = this.shapes.findIndex(s => s.id === shapeId);
    if (index >= 0) {
      this.shapes.splice(index, 1);
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Get a shape by ID
   */
  public getShape(shapeId: string): VectorShape | undefined {
    return this.shapes.find(s => s.id === shapeId);
  }

  /**
   * Get all shapes
   */
  public getShapes(): readonly VectorShape[] {
    return this.shapes;
  }

  /**
   * Update a shape's control points
   */
  public updateShapePoints(shapeId: string, points: ControlPoint[]): boolean {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (shape) {
      shape.points = points;
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Move a control point
   */
  public moveControlPoint(
    shapeId: string,
    pointIndex: number,
    x: number,
    y: number
  ): boolean {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (shape && shape.points[pointIndex]) {
      shape.points[pointIndex].x = x;
      shape.points[pointIndex].y = y;
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Set tension for a control point
   */
  public setControlPointTension(
    shapeId: string,
    pointIndex: number,
    tension: number
  ): boolean {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (shape && shape.points[pointIndex]) {
      shape.points[pointIndex].tension = Math.max(0, Math.min(1, tension));
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Add a control point to a shape
   */
  public addControlPoint(
    shapeId: string,
    afterIndex: number,
    point: ControlPoint
  ): boolean {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (shape) {
      shape.points.splice(afterIndex + 1, 0, point);
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Remove a control point from a shape
   */
  public removeControlPoint(shapeId: string, pointIndex: number): boolean {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (shape && shape.points.length > 3) {
      shape.points.splice(pointIndex, 1);
      this.shapesDirty = true;
      return true;
    }
    return false;
  }

  // ============================================
  // Convenience shape creation
  // ============================================

  /**
   * Create a circular green
   */
  public createGreen(centerX: number, centerY: number, radius: number): string {
    const shape = createCircleShape('green', centerX, centerY, radius, 12, 1.0);
    return this.addShape(shape);
  }

  /**
   * Create an elliptical bunker
   */
  public createBunker(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    rotation: number = 0
  ): string {
    const shape = createEllipseShape('bunker', centerX, centerY, radiusX, radiusY, rotation, 8, 0.8);
    return this.addShape(shape);
  }

  /**
   * Create a fairway segment
   */
  public createFairway(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number
  ): string {
    const shape = createFairwayShape(startX, startY, endX, endY, width, 0.8);
    return this.addShape(shape);
  }

  /**
   * Create a tee box
   */
  public createTeeBox(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    rotation: number = 0
  ): string {
    const shape = createEllipseShape('tee', centerX, centerY, width / 2, height / 2, rotation, 6, 0.3);
    return this.addShape(shape);
  }

  /**
   * Create a water hazard
   */
  public createWaterHazard(centerX: number, centerY: number, radius: number): string {
    const shape = createCircleShape('water', centerX, centerY, radius, 10, 0.9);
    return this.addShape(shape);
  }

  // ============================================
  // Visual settings
  // ============================================

  /**
   * Set edge blend width
   */
  public setEdgeBlend(width: number): void {
    this.options.edgeBlend = width;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("edgeBlend", width);
    }
  }

  /**
   * Toggle mowing stripes
   */
  public setStripesEnabled(enabled: boolean): void {
    this.options.enableStripes = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableStripes", enabled ? 1 : 0);
    }
  }

  /**
   * Toggle grass noise
   */
  public setNoiseEnabled(enabled: boolean): void {
    this.options.enableNoise = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableNoise", enabled ? 1 : 0);
    }
  }

  /**
   * Toggle water animation
   */
  public setWaterAnimEnabled(enabled: boolean): void {
    this.options.enableWaterAnim = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableWaterAnim", enabled ? 1 : 0);
    }
  }

  /**
   * Set a terrain color
   */
  public setTerrainColor(type: TerrainShapeType | 'rough' | 'waterDeep', color: Color3): void {
    if (!this.shaderMaterial) return;

    const uniformName = `${type}Color`;
    this.shaderMaterial.setColor3(uniformName, color);
  }

  // ============================================
  // Grid access (for simulation compatibility)
  // ============================================

  public getCell(x: number, y: number): CellState | null {
    return this.cells[y]?.[x] ?? null;
  }

  public getAllCells(): CellState[][] {
    return this.cells;
  }

  public getTerrainTypeAt(x: number, y: number): string | undefined {
    return this.cells[y]?.[x]?.type;
  }

  public getElevationAt(x: number, y: number, defaultForOutOfBounds?: number): number {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
      return defaultForOutOfBounds ?? 0;
    }
    return this.elevation[y]?.[x] ?? 0;
  }

  public getCornerHeightsPublic(gridX: number, gridY: number): { nw: number; ne: number; se: number; sw: number } {
    const baseElev = this.getElevationAt(gridX, gridY, 0);
    const nElev = this.getElevationAt(gridX, gridY - 1, baseElev);
    const sElev = this.getElevationAt(gridX, gridY + 1, baseElev);
    const wElev = this.getElevationAt(gridX - 1, gridY, baseElev);
    const eElev = this.getElevationAt(gridX + 1, gridY, baseElev);
    const nwElev = this.getElevationAt(gridX - 1, gridY - 1, baseElev);
    const neElev = this.getElevationAt(gridX + 1, gridY - 1, baseElev);
    const seElev = this.getElevationAt(gridX + 1, gridY + 1, baseElev);
    const swElev = this.getElevationAt(gridX - 1, gridY + 1, baseElev);

    const limit = 1;
    return {
      nw: Math.min(baseElev + limit, Math.max(baseElev, nElev, wElev, nwElev)),
      ne: Math.min(baseElev + limit, Math.max(baseElev, nElev, eElev, neElev)),
      se: Math.min(baseElev + limit, Math.max(baseElev, sElev, eElev, seElev)),
      sw: Math.min(baseElev + limit, Math.max(baseElev, sElev, wElev, swElev)),
    };
  }

  public setElevationAt(x: number, y: number, elev: number): void {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return;
    if (!this.elevation[y]) this.elevation[y] = [];
    this.elevation[y][x] = elev;
    this.cells[y][x].elevation = elev;
    // Rebuild mesh for elevation changes
    this.createTerrainMesh();
  }

  public setTerrainTypeAt(x: number, y: number, type: TerrainType): void {
    const cell = this.getCell(x, y);
    if (!cell) return;
    const initialValues = getInitialValues(type);
    cell.type = type;
    cell.height = initialValues.height;
    cell.moisture = initialValues.moisture;
    cell.nutrients = initialValues.nutrients;
    cell.health = calculateHealth(cell);
    // Mark dirty to rebuild SDF
    this.shapesDirty = true;
  }

  public rebuildTileAndNeighbors(_x: number, _y: number): void {
    // For vector system, rebuild the mesh when elevation changes
    this.createTerrainMesh();
  }

  public getLayoutGrid(): number[][] {
    return this.cells.map(row =>
      row.map(cell => {
        switch (cell.type) {
          case 'fairway': return 0;
          case 'rough': return 1;
          case 'green': return 2;
          case 'bunker': return 3;
          case 'water': return 4;
          case 'tee': return 5;
          default: return 1;
        }
      })
    );
  }

  public getElevationGrid(): number[][] {
    return this.cells.map(row => row.map(cell => cell.elevation));
  }

  public getCourseStats(): { health: number; moisture: number; nutrients: number; height: number } {
    return getAverageStats(this.cells);
  }

  public restoreCells(savedCells: CellState[][]): void {
    for (let y = 0; y < savedCells.length && y < this.cells.length; y++) {
      for (let x = 0; x < savedCells[y].length && x < this.cells[y].length; x++) {
        this.cells[y][x] = { ...savedCells[y][x] };
      }
    }
  }

  public gridToWorld(gridX: number, gridY: number): Vector3 {
    const cell = this.getCell(gridX, gridY);
    const avgElev = cell ? cell.elevation : 0;
    return gridTo3D(gridX + 0.5, gridY + 0.5, avgElev);
  }

  // ============================================
  // Maintenance actions
  // ============================================

  public mowAt(gridX: number, gridY: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell) return false;
    const result = applyMowing(cell);
    if (!result) return false;
    this.cells[gridY][gridX] = result;
    result.lastMowed = this.gameTime;
    return true;
  }

  public rakeAt(gridX: number, gridY: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell || cell.type !== 'bunker') return false;
    cell.lastMowed = this.gameTime;
    return true;
  }

  public waterArea(centerX: number, centerY: number, radius: number, amount: number): number {
    let affectedCount = 0;
    const radiusSq = radius * radius;

    for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(this.worldHeight - 1, Math.ceil(centerY + radius)); y++) {
      for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(this.worldWidth - 1, Math.ceil(centerX + radius)); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= radiusSq) {
          const cell = this.getCell(x, y);
          if (cell) {
            const result = applyWatering(cell, amount);
            if (result) {
              this.cells[y][x] = result;
              result.lastWatered = this.gameTime;
              affectedCount++;
            }
          }
        }
      }
    }
    return affectedCount;
  }

  public fertilizeArea(centerX: number, centerY: number, radius: number, amount: number, effectiveness: number = 1.0): number {
    let affectedCount = 0;
    const radiusSq = radius * radius;

    for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(this.worldHeight - 1, Math.ceil(centerY + radius)); y++) {
      for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(this.worldWidth - 1, Math.ceil(centerX + radius)); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= radiusSq) {
          const cell = this.getCell(x, y);
          if (cell) {
            const result = applyFertilizing(cell, amount, effectiveness);
            if (result) {
              this.cells[y][x] = result;
              result.lastFertilized = this.gameTime;
              affectedCount++;
            }
          }
        }
      }
    }
    return affectedCount;
  }

  // ============================================
  // Overlay modes
  // ============================================

  public cycleOverlayMode(): OverlayMode {
    const modes: OverlayMode[] = ["normal", "moisture", "nutrients", "height", "irrigation"];
    const currentIndex = modes.indexOf(this.overlayMode);
    const newMode = modes[(currentIndex + 1) % modes.length];
    this.setOverlayMode(newMode);
    return this.overlayMode;
  }

  public getOverlayMode(): OverlayMode {
    return this.overlayMode;
  }

  public setOverlayMode(mode: OverlayMode): void {
    this.overlayMode = mode;
    // Update shader uniform
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("overlayMode", this.getOverlayModeValue());
    }
    // Update health texture to ensure latest data
    if (mode !== "normal") {
      this.updateHealthTexture();
    }
  }

  // ============================================
  // Update with simulation
  // ============================================

  public updateFull(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void {
    this.gameTime = gameTimeMinutes;
    this.time += deltaMs / 1000;

    // Update shader time
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("time", this.time);
    }

    // Simulate grass growth
    const deltaMinutes = (deltaMs / 1000) * 2;
    for (let y = 0; y < this.cells.length; y++) {
      for (let x = 0; x < this.cells[y].length; x++) {
        const cell = this.cells[y][x];
        const result = simulateGrowth(cell, deltaMinutes, weather);
        cell.height = result.height;
        cell.moisture = result.moisture;
        cell.nutrients = result.nutrients;
        cell.health = result.health;
      }
    }

    // Rebuild SDF if terrain types changed
    if (this.shapesDirty) {
      this.rebuildSDFTextures();
      this.shapesDirty = false;
    }
  }

  public getUpdateCount(): number {
    return 0; // Not tracking updates like GrassSystem
  }

  public setCellState(x: number, y: number, state: Partial<Pick<CellState, 'height' | 'moisture' | 'nutrients' | 'health'>>): void {
    const cell = this.cells[y]?.[x];
    if (!cell) return;
    if (state.height !== undefined) cell.height = state.height;
    if (state.moisture !== undefined) cell.moisture = state.moisture;
    if (state.nutrients !== undefined) cell.nutrients = state.nutrients;
    if (state.health !== undefined) cell.health = state.health;
  }

  public setAllCellsState(state: Partial<Pick<CellState, 'height' | 'moisture' | 'nutrients' | 'health'>>): void {
    for (let y = 0; y < this.cells.length; y++) {
      for (let x = 0; x < this.cells[y].length; x++) {
        const cell = this.cells[y][x];
        if (cell.type === 'water' || cell.type === 'bunker') continue;
        if (state.height !== undefined) cell.height = state.height;
        if (state.moisture !== undefined) cell.moisture = state.moisture;
        if (state.nutrients !== undefined) cell.nutrients = state.nutrients;
        if (state.health !== undefined) cell.health = state.health;
      }
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  public dispose(): void {
    if (this.terrainMesh) {
      this.terrainMesh.dispose();
      this.terrainMesh = null;
    }

    if (this.shaderMaterial) {
      this.shaderMaterial.dispose();
      this.shaderMaterial = null;
    }

    if (this.sdfTextures) {
      this.sdfTextures.combined.dispose();
      this.sdfTextures.tee.dispose();
      this.sdfTextures = null;
    }

    if (this.healthTexture) {
      this.healthTexture.dispose();
      this.healthTexture = null;
    }

    for (const mesh of this.cliffMeshes) {
      mesh.dispose();
    }
    this.cliffMeshes = [];
  }
}
