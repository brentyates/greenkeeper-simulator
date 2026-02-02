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
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import {
  VectorShape,
  ControlPoint,
  TerrainShapeType,
  sampleSpline,
  pointInPolygon,
  createCircleShape,
  createEllipseShape,
  createFairwayShape,
  gridToVectorShapes,
} from "../../core/vector-shapes";

import {
  SDFTextureSet,
  generateSDFTextures,
  updateSDFTextures,
  SDFGeneratorOptions,
} from "./SDFGenerator";

import {
  terrainVertexShader,
  terrainFragmentShader,
  getDefaultUniforms,
} from "../shaders/terrainShader";

import { HEIGHT_UNIT } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import { CellState, TerrainType, getTerrainType, getInitialValues, calculateHealth, TERRAIN_CODES } from "../../core/terrain";

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

  // Rendering
  private terrainMesh: Mesh | null = null;
  private shaderMaterial: ShaderMaterial | null = null;
  private sdfTextures: SDFTextureSet | null = null;

  // Grid layer for simulation (synced from vectors)
  private cells: CellState[][] = [];

  // Animation
  private time: number = 0;

  // Dirty tracking
  private shapesDirty: boolean = false;

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

    // Initialize cells for simulation
    this.initCells(courseData);

    // Convert legacy grid layout to vector shapes
    this.shapes = gridToVectorShapes(courseData.layout, 1);

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
   * Generate SDF textures from current shapes
   */
  private generateSDFTextures(): void {
    const sdfOptions: Partial<SDFGeneratorOptions> = {
      resolution: this.options.sdfResolution,
      maxDistance: 5,
      splineSamples: 20,
    };

    this.sdfTextures = generateSDFTextures(
      this.scene,
      this.shapes,
      this.worldWidth,
      this.worldHeight,
      sdfOptions
    );
  }

  /**
   * Create the terrain shader material
   */
  private createShaderMaterial(): void {
    if (!this.sdfTextures) return;

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
        samplers: ["sdfCombined", "sdfTee"],
      }
    );

    // Set textures
    this.shaderMaterial.setTexture("sdfCombined", this.sdfTextures.combined);
    this.shaderMaterial.setTexture("sdfTee", this.sdfTextures.tee);

    // Set uniforms
    const uniforms = getDefaultUniforms(this.worldWidth, this.worldHeight);
    this.shaderMaterial.setVector2("worldSize", new Vector2(this.worldWidth, this.worldHeight));
    this.shaderMaterial.setFloat("time", 0);
    this.shaderMaterial.setFloat("edgeBlend", this.options.edgeBlend);
    this.shaderMaterial.setFloat("maxSdfDistance", uniforms.maxSdfDistance);

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
   * Apply the shader material to the terrain mesh
   */
  private applyMaterial(): void {
    if (this.terrainMesh && this.shaderMaterial) {
      this.terrainMesh.material = this.shaderMaterial;
    }
  }

  /**
   * Update animation and dirty shapes
   */
  public update(deltaMs: number): void {
    this.time += deltaMs / 1000;

    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("time", this.time);
    }

    if (this.shapesDirty) {
      this.rebuildSDFTextures();
      this.syncGridFromShapes();
      this.shapesDirty = false;
    }
  }

  /**
   * Rebuild SDF textures (called when shapes change)
   */
  private rebuildSDFTextures(): void {
    if (!this.sdfTextures) return;

    updateSDFTextures(
      this.sdfTextures,
      this.shapes,
      this.worldWidth,
      this.worldHeight,
      { resolution: this.options.sdfResolution }
    );
  }

  /**
   * Sync grid cells from vector shapes (for simulation)
   */
  private syncGridFromShapes(): void {
    // Sort shapes by z-index
    const sortedShapes = [...this.shapes].sort((a, b) => a.zIndex - b.zIndex);

    // Reset all cells to rough
    for (let y = 0; y < this.cells.length; y++) {
      for (let x = 0; x < this.cells[y].length; x++) {
        if (this.cells[y][x].type !== 'water' && this.cells[y][x].type !== 'bunker') {
          // Only reset grass types, preserve special handling
          this.cells[y][x].type = 'rough';
        }
      }
    }

    // Apply shapes in order
    for (const shape of sortedShapes) {
      const polygon = sampleSpline(shape.points, shape.closed, 16);

      for (let y = 0; y < this.cells.length; y++) {
        for (let x = 0; x < this.cells[y].length; x++) {
          const cellCenterX = x + 0.5;
          const cellCenterY = y + 0.5;

          if (pointInPolygon(cellCenterX, cellCenterY, polygon)) {
            this.cells[y][x].type = shape.type as TerrainType;
          }
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

  public getElevationAt(x: number, y: number): number {
    return this.elevation[y]?.[x] ?? 0;
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
  }
}
