/**
 * VectorTerrainSystem - Direct vertex mesh terrain with SDF-based terrain type rendering
 *
 * Arnold Palmer Course Designer style - direct control over every terrain vertex in full 3D.
 * Users can select vertices and move them in X, Y, and Z directions. Terrain types
 * (fairway, green, etc.) are painted onto the surface as a separate layer using SDFs.
 *
 * Architecture:
 * - Vertex Position Layer: Full 3D positions at mesh resolution (vertexPositions[][])
 * - Terrain Type Layer: Per-cell terrain type at cell resolution (cells[][].type)
 * - SDF textures generated from grid layout for smooth terrain boundaries
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Ray } from "@babylonjs/core/Culling/ray";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

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

import { HEIGHT_UNIT } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CellState, TerrainType, getTerrainType, getTerrainCode, getInitialValues, calculateHealth, TERRAIN_CODES, OverlayMode } from "../../core/terrain";
import { TopologyMode, getFacesInBrush, getEdgesInBrush } from "../../core/terrain-editor-logic";
import { simulateGrowth, applyMowing, applyWatering, applyFertilizing, getAverageStats, WeatherEffect } from "../../core/grass-simulation";
import {
  TerrainMeshTopology,
  TerrainTriangle,
  gridToTopology,
  buildMeshArrays,
  findNearestEdge,
  subdivideEdge,
  deleteVertex,
  canDeleteVertex,
  isBoundaryVertex,
  findNearestTopologyVertex,
  captureTopologyState,
  restoreTopologyState,
  collapseEdge,
  flipEdge,
  TopologyModification,
  sanitizeTopology,
} from "../../core/mesh-topology";

export interface VectorTerrainOptions {
  sdfResolution: number;
  edgeBlend: number;
  enableStripes: boolean;
  enableNoise: boolean;
  enableWaterAnim: boolean;
  meshResolution: number;
  enableGridLines: boolean;
}

const DEFAULT_OPTIONS: VectorTerrainOptions = {
  sdfResolution: 8,
  edgeBlend: 0.5,
  enableStripes: true,
  enableNoise: true,
  enableWaterAnim: true,
  meshResolution: 2,
  enableGridLines: false,
};

export class VectorTerrainSystem {
  private scene: Scene;
  private options: VectorTerrainOptions;

  private worldWidth: number;
  private worldHeight: number;

  private vertexPositions: Vec3[][] = [];
  private vertexWidth: number = 0;
  private vertexHeight: number = 0;

  private terrainMesh: Mesh | null = null;
  private shaderMaterial: ShaderMaterial | null = null;
  private sdfTextures: SDFTextureSet | null = null;
  private healthTexture: RawTexture | null = null;
  private overlayTexture: RawTexture | null = null;
  private defaultOverlayTexture: RawTexture | null = null;
  private cliffMeshes: Mesh[] = [];
  private gridLinesMesh: Mesh | null = null;

  private cells: CellState[][] = [];

  private time: number = 0;
  private gameTime: number = 0;

  private shapesDirty: boolean = false;
  private meshDirty: boolean = false;
  private cliffMaterial: StandardMaterial | null = null;
  private faceHighlightMaterial: StandardMaterial | null = null;

  private overlayMode: OverlayMode = "normal";

  private healthTextureUpdateCounter: number = 0;
  private static readonly HEALTH_TEXTURE_UPDATE_INTERVAL: number = 10;

  private topology: TerrainMeshTopology | null = null;
  private gridToVertexId: Map<string, number> = new Map();
  private vertexIdToGrid: Map<number, { vx: number; vy: number }> = new Map();
  private nextSyntheticVx: number = 100000;
  private hoveredEdgeId: number | null = null;
  private hoveredTopologyVertexId: number | null = null;
  private selectedEdgeId: number | null = null;
  private selectedEdgeIds: Set<number> = new Set();
  private brushHoveredEdgeIds: Set<number> = new Set();
  private edgeHighlightMesh: Mesh | null = null;
  private selectedEdgeHighlightMesh: Mesh | null = null;
  private allEdgesMesh: Mesh | null = null;
  private activeTopologyMode: TopologyMode = 'vertex';
  private selectedTopologyVertices: Set<number> = new Set();
  private hoveredFaceId: number | null = null;
  private selectedFaceIds: Set<number> = new Set();
  private brushHoveredFaceIds: Set<number> = new Set();
  private faceHighlightMesh: Mesh | null = null;
  private faceSpatialIndex: Array<Set<number>> = [];

  constructor(
    scene: Scene,
    courseData: CourseData,
    options: Partial<VectorTerrainOptions> = {}
  ) {
    this.scene = scene;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.worldWidth = courseData.width;
    this.worldHeight = courseData.height;

    this.vertexWidth = Math.ceil(this.worldWidth * this.options.meshResolution) + 1;
    this.vertexHeight = Math.ceil(this.worldHeight * this.options.meshResolution) + 1;

    this.initVertexPositions(courseData);
    this.initCells(courseData);
    this.registerShader();
  }

  private initVertexPositions(courseData: CourseData): void {
    const meshRes = this.options.meshResolution;

    if (courseData.vertexPositions) {
      this.vertexPositions = courseData.vertexPositions.map(row =>
        row.map(pos => ({ ...pos }))
      );
    } else if (courseData.vertexElevations) {
      this.vertexPositions = [];
      for (let vy = 0; vy < this.vertexHeight; vy++) {
        this.vertexPositions[vy] = [];
        for (let vx = 0; vx < this.vertexWidth; vx++) {
          const z = courseData.vertexElevations[vy]?.[vx] ?? 0;
          this.vertexPositions[vy][vx] = {
            x: vx / meshRes,
            y: z,
            z: vy / meshRes,
          };
        }
      }
    } else if (courseData.elevation) {
      this.vertexPositions = [];
      for (let vy = 0; vy < this.vertexHeight; vy++) {
        this.vertexPositions[vy] = [];
        for (let vx = 0; vx < this.vertexWidth; vx++) {
          const worldX = vx / meshRes;
          const worldZ = vy / meshRes;
          const y = this.interpolateFromCellElevation(
            courseData.elevation,
            worldX,
            worldZ
          );
          this.vertexPositions[vy][vx] = { x: worldX, y, z: worldZ };
        }
      }
    } else {
      this.vertexPositions = [];
      for (let vy = 0; vy < this.vertexHeight; vy++) {
        this.vertexPositions[vy] = [];
        for (let vx = 0; vx < this.vertexWidth; vx++) {
          this.vertexPositions[vy][vx] = {
            x: vx / meshRes,
            y: 0,
            z: vy / meshRes,
          };
        }
      }
    }
  }

  private interpolateFromCellElevation(
    elevation: number[][],
    worldX: number,
    worldZ: number
  ): number {
    if (!elevation || elevation.length === 0) return 0;

    const height = elevation.length;
    const width = elevation[0]?.length || 0;

    const fx = Math.max(0, Math.min(width - 1.001, worldX));
    const fz = Math.max(0, Math.min(height - 1.001, worldZ));

    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, width - 1);
    const z1 = Math.min(z0 + 1, height - 1);

    const tx = fx - x0;
    const tz = fz - z0;

    const e00 = elevation[z0]?.[x0] ?? 0;
    const e10 = elevation[z0]?.[x1] ?? 0;
    const e01 = elevation[z1]?.[x0] ?? 0;
    const e11 = elevation[z1]?.[x1] ?? 0;

    const e0 = e00 * (1 - tx) + e10 * tx;
    const e1 = e01 * (1 - tx) + e11 * tx;

    return e0 * (1 - tz) + e1 * tz;
  }


  private initCells(courseData: CourseData): void {
    const { width, height, layout } = courseData;

    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const terrainType = getTerrainType(terrainCode);
        const elev = this.getCellElevation(x, y);
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

  private getCellElevation(worldX: number, worldY: number): number {
    const { vx, vy } = this.worldToVertex(worldX + 0.5, worldY + 0.5);
    return this.vertexPositions[vy]?.[vx]?.y ?? 0;
  }

  private registerShader(): void {
    Effect.ShadersStore["terrainVertexShader"] = terrainVertexShader;
    Effect.ShadersStore["terrainFragmentShader"] = terrainFragmentShader;
  }

  public build(courseData: CourseData): void {
    this.initTopology(courseData);
    this.rebuildMesh();
    this.generateSDFTextures();
    this.createShaderMaterial();
    this.applyMaterial();
  }

  private initTopology(courseData: CourseData): void {
    this.topology = gridToTopology(
      this.vertexPositions,
      this.worldWidth,
      this.worldHeight,
      this.options.meshResolution
    );

    this.gridToVertexId.clear();
    this.vertexIdToGrid.clear();
    this.nextSyntheticVx = 100000;
    const meshRes = this.options.meshResolution;
    for (const [id, vertex] of this.topology.vertices) {
      const vx = Math.round(vertex.gridUV.u * this.worldWidth * meshRes);
      const vy = Math.round(vertex.gridUV.v * this.worldHeight * meshRes);
      this.gridToVertexId.set(`${vx},${vy}`, id);
      this.vertexIdToGrid.set(id, { vx, vy });
    }

    this.initializeTriangleTerrainsFromGrid(courseData);
    this.rebuildFaceSpatialIndex();
  }

  private rebuildFaceSpatialIndex(): void {
    if (!this.topology) return;
    
    const gridWidth = Math.ceil(this.worldWidth);
    const gridHeight = Math.ceil(this.worldHeight);
    this.faceSpatialIndex = new Array(gridWidth * gridHeight);
    for (let i = 0; i < this.faceSpatialIndex.length; i++) {
      this.faceSpatialIndex[i] = new Set();
    }

    for (const [id, tri] of this.topology.triangles) {
      this.addTriangleToSpatialIndex(id, tri);
    }
  }

  private addTriangleToSpatialIndex(triId: number, tri: TerrainTriangle): void {
    if (!this.topology) return;
    const v0 = this.topology.vertices.get(tri.vertices[0]);
    const v1 = this.topology.vertices.get(tri.vertices[1]);
    const v2 = this.topology.vertices.get(tri.vertices[2]);
    if (!v0 || !v1 || !v2) return;

    const minX = Math.floor(Math.min(v0.position.x, v1.position.x, v2.position.x));
    const maxX = Math.floor(Math.max(v0.position.x, v1.position.x, v2.position.x));
    const minZ = Math.floor(Math.min(v0.position.z, v1.position.z, v2.position.z));
    const maxZ = Math.floor(Math.max(v0.position.z, v1.position.z, v2.position.z));

    const gridWidth = Math.ceil(this.worldWidth);
    const gridHeight = Math.ceil(this.worldHeight);

    for (let gz = Math.max(0, minZ); gz <= Math.min(gridHeight - 1, maxZ); gz++) {
      for (let gx = Math.max(0, minX); gx <= Math.min(gridWidth - 1, maxX); gx++) {
        this.faceSpatialIndex[gz * gridWidth + gx].add(triId);
      }
    }
  }

  private initializeTriangleTerrainsFromGrid(courseData: CourseData): void {
    if (!this.topology) return;

    const layout = courseData.layout;
    
    for (const [, tri] of this.topology.triangles) {
       let cx = 0, cz = 0;
       for(const vid of tri.vertices) {
           const v = this.topology.vertices.get(vid);
           if(v) {
               cx += v.position.x;
               cz += v.position.z;
           }
       }
       cx /= 3;
       cz /= 3;

       const lx = Math.floor(cx);
       const ly = Math.floor(cz);
       
       const row = layout[ly];
       if (row) {
           tri.terrainCode = row[lx] ?? TERRAIN_CODES.ROUGH;
       } else {
           tri.terrainCode = TERRAIN_CODES.ROUGH;
       }
    }
  }

  private registerNewTopologyVertex(vertexId: number): void {
    if (this.vertexIdToGrid.has(vertexId)) return;

    const syntheticVx = this.nextSyntheticVx++;
    const syntheticVy = 0;
    this.gridToVertexId.set(`${syntheticVx},${syntheticVy}`, vertexId);
    this.vertexIdToGrid.set(vertexId, { vx: syntheticVx, vy: syntheticVy });
  }

  // ============================================
  // Vertex Position API (Full 3D)
  // ============================================

  private getTopologyVertexIdForGrid(vx: number, vy: number): number | null {
    return this.gridToVertexId.get(`${vx},${vy}`) ?? null;
  }

  public getVertexPosition(vx: number, vy: number): Vec3 {
    const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
    if (vertexId === null || !this.topology) {
      return { x: 0, y: 0, z: 0 };
    }
    const vertex = this.topology.vertices.get(vertexId);
    return vertex ? { ...vertex.position } : { x: 0, y: 0, z: 0 };
  }

  public setVertexPosition(vx: number, vy: number, pos: Vec3): void {
    const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
    if (vertexId === null || !this.topology) return;

    const vertex = this.topology.vertices.get(vertexId);
    if (vertex) {
      vertex.position = { ...pos };
      this.meshDirty = true;
    }
  }

  public setVertexPositions(changes: Array<{ vx: number; vy: number; pos: Vec3 }>): void {
    if (!this.topology) return;

    for (const change of changes) {
      const vertexId = this.getTopologyVertexIdForGrid(change.vx, change.vy);
      if (vertexId === null) continue;

      const vertex = this.topology.vertices.get(vertexId);
      if (vertex) {
        vertex.position = { ...change.pos };
      }
    }
    this.meshDirty = true;
  }

  public moveVertices(
    vertices: Array<{ vx: number; vy: number }>,
    delta: Vec3
  ): void {
    if (!this.topology) return;

    for (const v of vertices) {
      const vertexId = this.getTopologyVertexIdForGrid(v.vx, v.vy);
      if (vertexId === null) continue;

      const vertex = this.topology.vertices.get(vertexId);
      if (vertex) {
        vertex.position.x += delta.x;
        vertex.position.y += delta.y;
        vertex.position.z += delta.z;
      }
    }
    this.meshDirty = true;
  }

  public getVertexElevation(vx: number, vy: number): number {
    const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
    if (vertexId === null || !this.topology) return 0;

    const vertex = this.topology.vertices.get(vertexId);
    return vertex?.position.y ?? 0;
  }

  public setVertexElevation(vx: number, vy: number, z: number): void {
    const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
    if (vertexId === null || !this.topology) return;

    const vertex = this.topology.vertices.get(vertexId);
    if (vertex) {
      vertex.position.y = z;
      this.meshDirty = true;
    }
  }

  public setVertexElevations(changes: Array<{ vx: number; vy: number; z: number }>): void {
    if (!this.topology) return;

    let foundCount = 0;
    let failCount = 0;
    
    // Diagnostic log for large modifications
    if (changes.length > 5) {
      console.log(`[VectorTerrainSystem] setVertexElevations: changes=${changes.length}, gridToVertexId size=${this.gridToVertexId.size}`);
    }

    for (const change of changes) {
      // Robust rounding to avoid precision issues in string key
      const vx = Math.round(change.vx);
      const vy = Math.round(change.vy);
      const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
      
      if (vertexId === null) {
        if (failCount < 5) {
          console.log(`[VectorTerrainSystem] lookup failed for vx=${vx} (${change.vx}), vy=${vy} (${change.vy})`);
        }
        failCount++;
        continue;
      }

      const vertex = this.topology.vertices.get(vertexId);
      if (vertex) {
        vertex.position.y = change.z;
        foundCount++;
      } else {
        failCount++;
      }
    }
    
    if (changes.length > 1) {
      console.log(`[VectorTerrainSystem] setVertexElevations: total_changes=${changes.length}, found=${foundCount}, failed=${failCount}`);
    }
    this.meshDirty = true;
  }

  public worldToVertex(worldX: number, worldZ: number): { vx: number; vy: number } {
    const meshRes = this.options.meshResolution;
    return {
      vx: Math.round(worldX * meshRes),
      vy: Math.round(worldZ * meshRes),
    };
  }

  public findNearestVertex(worldX: number, worldZ: number): { vx: number; vy: number; dist: number } {
    if (!this.topology) {
      return { vx: 0, vy: 0, dist: Infinity };
    }

    let nearestVx = 0;
    let nearestVy = 0;
    let minDistSq = Infinity;

    for (const [vertexId, vertex] of this.topology.vertices) {
      const dx = vertex.position.x - worldX;
      const dz = vertex.position.z - worldZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        const gridCoords = this.vertexIdToGrid.get(vertexId);
        if (gridCoords) {
          nearestVx = gridCoords.vx;
          nearestVy = gridCoords.vy;
        }
      }
    }

    return { vx: nearestVx, vy: nearestVy, dist: Math.sqrt(minDistSq) };
  }

  public vertexToWorld(vx: number, vy: number): { x: number; z: number } {
    const vertexId = this.gridToVertexId.get(`${vx},${vy}`);
    if (vertexId !== undefined && this.topology) {
      const vertex = this.topology.vertices.get(vertexId);
      if (vertex) {
        return { x: vertex.position.x, z: vertex.position.z };
      }
    }
    return { x: 0, z: 0 };
  }

  public getVertexDimensions(): { width: number; height: number } {
    return { width: this.vertexWidth, height: this.vertexHeight };
  }

  public getWorldDimensions(): { width: number; height: number } {
    return { width: this.worldWidth, height: this.worldHeight };
  }

  public getMeshResolution(): number {
    return this.options.meshResolution;
  }

  public getVertexPositionsGrid(): Vec3[][] {
    if (!this.topology) return this.vertexPositions;

    const result: Vec3[][] = [];
    for (let vy = 0; vy < this.vertexHeight; vy++) {
      result[vy] = [];
      for (let vx = 0; vx < this.vertexWidth; vx++) {
        const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
        if (vertexId !== null) {
          const vertex = this.topology.vertices.get(vertexId);
          result[vy][vx] = vertex ? { ...vertex.position } : { x: 0, y: 0, z: 0 };
        } else {
          result[vy][vx] = { x: 0, y: 0, z: 0 };
        }
      }
    }
    return result;
  }

  public getFacesInBrush(worldX: number, worldZ: number, radius: number): number[] {
    if (!this.topology) return [];
    return getFacesInBrush(worldX, worldZ, radius, this.topology);
  }

  public getEdgesInBrush(worldX: number, worldZ: number, radius: number): number[] {
    if (!this.topology) return [];
    return getEdgesInBrush(worldX, worldZ, radius, this.topology);
  }

  public pick(ray: Ray): { gridX: number; gridY: number; worldPos: { x: number; z: number }; faceId: number | null } | null {
    if (!this.terrainMesh) return null;
    const pickResult = ray.intersectsMesh(this.terrainMesh);
    if (!pickResult || !pickResult.hit || !pickResult.pickedPoint) return null;

    const worldPos = { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z };
    const res = this.options.meshResolution;

    return {
      gridX: Math.floor(worldPos.x * res),
      gridY: Math.floor(worldPos.z * res),
      worldPos,
      faceId: pickResult.faceId
    };
  }

  public getVertexElevationsGrid(): number[][] {
    if (!this.topology) {
      return this.vertexPositions.map(row => row.map(pos => pos.y));
    }

    const result: number[][] = [];
    for (let vy = 0; vy < this.vertexHeight; vy++) {
      result[vy] = [];
      for (let vx = 0; vx < this.vertexWidth; vx++) {
        const vertexId = this.getTopologyVertexIdForGrid(vx, vy);
        if (vertexId !== null) {
          const vertex = this.topology.vertices.get(vertexId);
          result[vy][vx] = vertex?.position.y ?? 0;
        } else {
          result[vy][vx] = 0;
        }
      }
    }
    return result;
  }

  // ============================================
  // Topology Mode (Always On - Arnold Palmer Style)
  // ============================================

  public isTopologyMode(): boolean {
    return true;
  }

  public enableTopologyMode(): void {
    // Topology is always enabled - this is a no-op for backwards compatibility
  }

  public disableTopologyMode(): void {
    // Topology cannot be disabled - this is a no-op for backwards compatibility
  }

  public toggleTopologyMode(): boolean {
    return true;
  }

  public getTopology(): TerrainMeshTopology | null {
    return this.topology;
  }

  public findNearestEdgeAt(worldX: number, worldZ: number, maxDist: number = 0.5): {
    edgeId: number;
    t: number;
    dist: number;
  } | null {
    if (!this.topology) return null;
    return findNearestEdge(this.topology, worldX, worldZ, maxDist);
  }

  public setHoveredEdge(edgeId: number | null): void {
    if (this.hoveredEdgeId === edgeId) return;
    this.hoveredEdgeId = edgeId;
    this.updateEdgeHighlight();
  }

  public getHoveredEdge(): number | null {
    return this.hoveredEdgeId;
  }

  public setBrushHoveredEdges(edgeIds: number[]): void {
    this.brushHoveredEdgeIds = new Set(edgeIds);
    this.updateEdgeHighlight();
  }

  public selectEdge(edgeId: number | null, additive: boolean = false): void {
    if (!additive) {
      this.selectedEdgeIds.clear();
    }
    if (edgeId !== null) {
      this.selectedEdgeIds.add(edgeId);
      this.selectedEdgeId = edgeId;
    } else {
      this.selectedEdgeId = null;
    }
    this.updateSelectedEdgeHighlight();
  }

  public getSelectedEdge(): number | null {
    return this.selectedEdgeId;
  }

  public deselectEdge(edgeId: number): void {
    this.selectedEdgeIds.delete(edgeId);
    if (this.selectedEdgeId === edgeId) {
      this.selectedEdgeId = null;
    }
    this.updateSelectedEdgeHighlight();
  }

  public toggleEdgeSelection(edgeId: number): void {
    if (this.selectedEdgeIds.has(edgeId)) {
      this.selectedEdgeIds.delete(edgeId);
    } else {
      this.selectedEdgeIds.add(edgeId);
      this.selectedEdgeId = edgeId;
    }
    this.updateSelectedEdgeHighlight();
  }

  public selectAllEdges(): void {
    if (!this.topology) return;
    this.selectedEdgeIds.clear();
    for (const [edgeId] of this.topology.edges) {
      this.selectedEdgeIds.add(edgeId);
    }
    if (this.selectedEdgeIds.size > 0) {
      this.selectedEdgeId = Array.from(this.selectedEdgeIds)[0];
    }
    this.updateSelectedEdgeHighlight();
  }

  public deselectAllEdges(): void {
    this.selectedEdgeIds.clear();
    this.selectedEdgeId = null;
    this.updateSelectedEdgeHighlight();
  }

  public getSelectedEdgeIds(): Set<number> {
    return new Set(this.selectedEdgeIds);
  }

  public subdivideSelectedEdge(): { newVertexId: number; beforeState: TopologyModification['beforeState'] } | null {
    if (this.selectedEdgeId === null || !this.topology) return null;

    const beforeState = captureTopologyState(this.topology);
    const result = subdivideEdge(this.topology, this.selectedEdgeId, 0.5);
    if (!result) return null;

    this.registerNewTopologyVertex(result.newVertexId);

    this.deselectAllEdges();
    this.rebuildMesh();

    return { newVertexId: result.newVertexId, beforeState };
  }

  public flipSelectedEdge(): { beforeState: TopologyModification['beforeState'] } | null {
    if (this.selectedEdgeId === null || !this.topology) return null;

    const beforeState = captureTopologyState(this.topology);
    const result = flipEdge(this.topology, this.selectedEdgeId);
    if (!result) return null;

    this.rebuildMesh();

    return { beforeState };
  }

  private updateSelectedEdgeHighlight(): void {
    this.rebuildAllEdgesMeshWithHighlights();
  }

  private clearSelectedEdgeHighlight(): void {
    this.rebuildAllEdgesMeshWithHighlights();
  }



  private createAllEdgesMesh(): void {
    this.rebuildAllEdgesMeshWithHighlights();
  }

  private rebuildAllEdgesMeshWithHighlights(): void {
    this.clearAllEdgesMesh();
    this.clearEdgeHighlight();

    if (!this.topology || this.activeTopologyMode !== 'edge') return;

    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const lineOffset = 0.02;

    const normalColor = new Color4(0.5, 0.75, 0.5, 0.8);
    const hoveredColor = new Color4(0, 1, 1, 1);
    const brushHoveredColor = new Color4(0.4, 0.9, 0.9, 0.9);
    const selectedColor = new Color4(1, 0.5, 0, 1);

    for (const [edgeId, edge] of this.topology.edges) {
      const v1 = this.topology.vertices.get(edge.v1);
      const v2 = this.topology.vertices.get(edge.v2);
      if (!v1 || !v2) continue;

      lines.push([
        new Vector3(v1.position.x, v1.position.y * HEIGHT_UNIT + lineOffset, v1.position.z),
        new Vector3(v2.position.x, v2.position.y * HEIGHT_UNIT + lineOffset, v2.position.z),
      ]);

      let color = normalColor;
      if (this.selectedEdgeIds.has(edgeId)) {
        color = selectedColor;
      } else if (edgeId === this.hoveredEdgeId) {
        color = hoveredColor;
      } else if (this.brushHoveredEdgeIds.has(edgeId)) {
        color = brushHoveredColor;
      }

      colors.push([color, color]);
    }

    if (lines.length > 0) {
      this.allEdgesMesh = MeshBuilder.CreateLineSystem(
        "allEdges",
        { lines, colors, updatable: false },
        this.scene
      );
      this.allEdgesMesh.renderingGroupId = 1;
    }
  }


  private clearAllEdgesMesh(): void {
    if (this.allEdgesMesh) {
      this.allEdgesMesh.dispose();
      this.allEdgesMesh = null;
    }
  }

  public subdivideEdgeAt(edgeId: number, t: number = 0.5): {
    newVertexId: number;
    beforeState: TopologyModification['beforeState'];
  } | null {
    if (!this.topology) return null;

    const beforeState = captureTopologyState(this.topology);

    const result = subdivideEdge(this.topology, edgeId, t);
    if (!result) return null;

    this.registerNewTopologyVertex(result.newVertexId);
    this.rebuildMesh();

    return {
      newVertexId: result.newVertexId,
      beforeState,
    };
  }

  public canDeleteTopologyVertex(vertexId: number): boolean {
    if (!this.topology) return false;
    return canDeleteVertex(this.topology, vertexId);
  }

  public isTopologyBoundaryVertex(vertexId: number): boolean {
    if (!this.topology) return true;
    return isBoundaryVertex(this.topology, vertexId);
  }

  public deleteTopologyVertex(vertexId: number): {
    beforeState: TopologyModification['beforeState'];
  } | null {
    if (!this.topology) return null;
    if (!canDeleteVertex(this.topology, vertexId)) return null;

    const beforeState = captureTopologyState(this.topology);

    const result = deleteVertex(this.topology, vertexId);
    if (!result) return null;

    this.rebuildMesh();

    return { beforeState };
  }

  public findNearestTopologyVertexAt(worldX: number, worldZ: number): {
    vertexId: number;
    dist: number;
  } | null {
    if (!this.topology) return null;
    return findNearestTopologyVertex(this.topology, worldX, worldZ);
  }

  public getTopologyVertexPosition(vertexId: number): Vec3 | null {
    if (!this.topology) return null;
    const vertex = this.topology.vertices.get(vertexId);
    return vertex ? { ...vertex.position } : null;
  }

  public setTopologyVertexPosition(vertexId: number, pos: Vec3): void {
    if (!this.topology) return;
    const vertex = this.topology.vertices.get(vertexId);
    if (vertex) {
      vertex.position = { ...pos };
      this.meshDirty = true;
    }
  }

  public restoreTopologyFromState(state: TopologyModification['beforeState']): void {
    if (!this.topology) return;
    restoreTopologyState(this.topology, state);
    this.rebuildMesh();
  }

  public setHoveredTopologyVertex(vertexId: number | null): void {
    if (this.hoveredTopologyVertexId === vertexId) return;
    this.hoveredTopologyVertexId = vertexId;
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public getHoveredTopologyVertex(): number | null {
    return this.hoveredTopologyVertexId;
  }

  public collapseEdge(edgeId: number): { beforeState: TopologyModification['beforeState'] } | null {
    if (!this.topology) return null;

    const beforeState = captureTopologyState(this.topology);
    const result = collapseEdge(this.topology, edgeId);
    if (!result) return null;

    this.deselectAllEdges();
    this.rebuildMesh();

    return { beforeState };
  }

  public selectTopologyVertexById(vertexId: number, additive: boolean = false): void {
    if (!additive) {
      this.selectedTopologyVertices.clear();
    }
    this.selectedTopologyVertices.add(vertexId);
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public deselectTopologyVertexById(vertexId: number): void {
    this.selectedTopologyVertices.delete(vertexId);
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public toggleTopologyVertexSelectionById(vertexId: number): void {
    if (this.selectedTopologyVertices.has(vertexId)) {
      this.selectedTopologyVertices.delete(vertexId);
    } else {
      this.selectedTopologyVertices.add(vertexId);
    }
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public clearSelectedTopologyVertices(): void {
    this.selectedTopologyVertices.clear();
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public getSelectedTopologyVertexIds(): Set<number> {
    return new Set(this.selectedTopologyVertices);
  }

  // ============================================
  // Face Mode (Triangle Selection)
  // ============================================

  public setTopologyMode(mode: TopologyMode): void {
    if (this.activeTopologyMode === mode) return;
    this.activeTopologyMode = mode;

    // Handle Edge Mode Logic
    if (mode === 'edge') {
      this.createAllEdgesMesh();
    } else {
      this.brushHoveredEdgeIds.clear();
      this.deselectAllEdges();
      this.clearAllEdgesMesh();
    }

    // Handle Face Mode Logic
    if (mode !== 'face') {
        this.brushHoveredFaceIds.clear();
        this.clearFaceHighlight();
    }

    // Handle Wireframe
    if (this.wireframeMesh) {
       // Only show wireframe in vertex mode if enabled
       this.wireframeMesh.setEnabled(mode === 'vertex' && this.wireframeEnabled);
    }
  }

  public isFaceModeActive(): boolean {
    return this.activeTopologyMode === 'face';
  }

  public setHoveredFace(faceId: number | null): void {
    if (this.hoveredFaceId === faceId) return;
    this.hoveredFaceId = faceId;
    this.rebuildFaceHighlightMesh();
  }

  public getHoveredFace(): number | null {
    return this.hoveredFaceId;
  }

  public setBrushHoveredFaces(faceIds: number[]): void {
    this.brushHoveredFaceIds = new Set(faceIds);
    this.rebuildFaceHighlightMesh();
  }

  public selectFace(faceId: number, additive: boolean = false): void {
    if (!additive) {
      this.selectedFaceIds.clear();
    }
    this.selectedFaceIds.add(faceId);
    this.rebuildFaceHighlightMesh();
  }

  public deselectFace(faceId: number): void {
    this.selectedFaceIds.delete(faceId);
    this.rebuildFaceHighlightMesh();
  }

  public toggleFaceSelection(faceId: number): void {
    if (this.selectedFaceIds.has(faceId)) {
      this.selectedFaceIds.delete(faceId);
    } else {
      this.selectedFaceIds.add(faceId);
    }
    this.rebuildFaceHighlightMesh();
  }

  public getTopologyMode(): TopologyMode {
    return this.activeTopologyMode;
  }

  public clearFaceSelection(): void {
    this.selectedFaceIds.clear();
    this.rebuildFaceHighlightMesh();
  }

  public getSelectedFaceIds(): Set<number> {
    return new Set(this.selectedFaceIds);
  }

  public findFaceAtPosition(worldX: number, worldZ: number): number | null {
    if (!this.topology || !this.faceSpatialIndex || this.faceSpatialIndex.length === 0) return null;

    const gx = Math.floor(worldX);
    const gz = Math.floor(worldZ);
    const gridWidth = Math.ceil(this.worldWidth);
    const gridHeight = Math.ceil(this.worldHeight);

    if (gx < 0 || gx >= gridWidth || gz < 0 || gz >= gridHeight) return null;

    const cellTriangles = this.faceSpatialIndex[gz * gridWidth + gx];
    if (!cellTriangles) return null;

    for (const triId of cellTriangles) {
      const tri = this.topology.triangles.get(triId);
      if (!tri) continue;
      
      const v0 = this.topology.vertices.get(tri.vertices[0]);
      const v1 = this.topology.vertices.get(tri.vertices[1]);
      const v2 = this.topology.vertices.get(tri.vertices[2]);

      if (!v0 || !v1 || !v2) continue;

      if (this.pointInTriangle2D(
        worldX, worldZ,
        v0.position.x, v0.position.z,
        v1.position.x, v1.position.z,
        v2.position.x, v2.position.z
      )) {
        return triId;
      }
    }
    return null;
  }

  private pointInTriangle2D(
    px: number, pz: number,
    ax: number, az: number,
    bx: number, bz: number,
    cx: number, cz: number
  ): boolean {
    const v0x = cx - ax;
    const v0z = cz - az;
    const v1x = bx - ax;
    const v1z = bz - az;
    const v2x = px - ax;
    const v2z = pz - az;

    const dot00 = v0x * v0x + v0z * v0z;
    const dot01 = v0x * v1x + v0z * v1z;
    const dot02 = v0x * v2x + v0z * v2z;
    const dot11 = v1x * v1x + v1z * v1z;
    const dot12 = v1x * v2x + v1z * v2z;

    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 0.0001) return false;

    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v <= 1);
  }

  public moveSelectedFaces(dx: number, dy: number, dz: number): void {
    if (!this.topology || this.selectedFaceIds.size === 0) return;

    const uniqueVertexIds = new Set<number>();
    for (const faceId of this.selectedFaceIds) {
      const tri = this.topology.triangles.get(faceId);
      if (!tri) continue;
      for (const vid of tri.vertices) {
        uniqueVertexIds.add(vid);
      }
    }

    for (const vid of uniqueVertexIds) {
      const vertex = this.topology.vertices.get(vid);
      if (vertex) {
        vertex.position.x += dx;
        vertex.position.y += dy;
        vertex.position.z += dz;
      }
    }

    this.meshDirty = true;
  }

  public getSelectedFaceVertexIds(): Set<number> {
    if (!this.topology) return new Set();

    const uniqueVertexIds = new Set<number>();
    for (const faceId of this.selectedFaceIds) {
      const tri = this.topology.triangles.get(faceId);
      if (!tri) continue;
      for (const vid of tri.vertices) {
        uniqueVertexIds.add(vid);
      }
    }
    return uniqueVertexIds;
  }

  public getSelectedEdgeVertexIds(): Set<number> {
    if (!this.topology) return new Set();

    const uniqueVertexIds = new Set<number>();
    for (const edgeId of this.selectedEdgeIds) {
      const edge = this.topology.edges.get(edgeId);
      if (edge) {
        uniqueVertexIds.add(edge.v1);
        uniqueVertexIds.add(edge.v2);
      }
    }
    return uniqueVertexIds;
  }

  public getSelectedVerticesFromSelection(): Array<{ vx: number; vy: number }> {
    if (!this.topology) return [];

    const vertexIds = new Set<number>();

    if (this.activeTopologyMode === 'face') {
      for (const faceId of this.selectedFaceIds) {
        const tri = this.topology.triangles.get(faceId);
        if (tri) {
          tri.vertices.forEach(vid => vertexIds.add(vid));
        }
      }
    } else if (this.activeTopologyMode === 'edge') {
      for (const edgeId of this.selectedEdgeIds) {
        const edge = this.topology.edges.get(edgeId);
        if (edge) {
          vertexIds.add(edge.v1);
          vertexIds.add(edge.v2);
        }
      }
    } else {
      for (const vid of this.selectedTopologyVertices) {
        vertexIds.add(vid);
      }
    }

    const result: Array<{ vx: number; vy: number }> = [];
    for (const vid of vertexIds) {
      const grid = this.vertexIdToGrid.get(vid);
      if (grid) {
        result.push({ vx: grid.vx, vy: grid.vy });
      }
    }
    return result;
  }

  private rebuildFaceHighlightMesh(): void {
    this.clearFaceHighlight();

    if (!this.topology || this.activeTopologyMode !== 'face') return;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const lineOffset = 0.03;

    const hoveredColor = new Color4(1, 1, 0, 0.4);
    const brushHoveredColor = new Color4(0.8, 0.9, 0.3, 0.3);
    const selectedColor = new Color4(0, 1, 1, 0.5);

    const facesToRender = new Set<number>(this.selectedFaceIds);
    if (this.hoveredFaceId !== null && !this.selectedFaceIds.has(this.hoveredFaceId)) {
      facesToRender.add(this.hoveredFaceId);
    }
    for (const faceId of this.brushHoveredFaceIds) {
      facesToRender.add(faceId);
    }

    let vertexIndex = 0;
    for (const faceId of facesToRender) {
      const tri = this.topology.triangles.get(faceId);
      if (!tri) continue;

      const v0 = this.topology.vertices.get(tri.vertices[0]);
      const v1 = this.topology.vertices.get(tri.vertices[1]);
      const v2 = this.topology.vertices.get(tri.vertices[2]);

      if (!v0 || !v1 || !v2) continue;

      let color = brushHoveredColor;
      if (this.selectedFaceIds.has(faceId)) {
        color = selectedColor;
      } else if (faceId === this.hoveredFaceId) {
        color = hoveredColor;
      }

      positions.push(v0.position.x, v0.position.y * HEIGHT_UNIT + lineOffset, v0.position.z);
      positions.push(v1.position.x, v1.position.y * HEIGHT_UNIT + lineOffset, v1.position.z);
      positions.push(v2.position.x, v2.position.y * HEIGHT_UNIT + lineOffset, v2.position.z);

      colors.push(color.r, color.g, color.b, color.a);
      colors.push(color.r, color.g, color.b, color.a);
      colors.push(color.r, color.g, color.b, color.a);

      indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      vertexIndex += 3;
    }

    if (positions.length === 0) return;

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.dispose();
    }

    this.faceHighlightMesh = new Mesh("faceHighlight", this.scene);
    vertexData.applyToMesh(this.faceHighlightMesh);

    if (!this.faceHighlightMaterial) {
      this.faceHighlightMaterial = new StandardMaterial("faceHighlightMat", this.scene);
      this.faceHighlightMaterial.diffuseColor = new Color3(1, 1, 1);
      this.faceHighlightMaterial.emissiveColor = new Color3(0.3, 0.3, 0.3);
      this.faceHighlightMaterial.alpha = 0.5;
      this.faceHighlightMaterial.backFaceCulling = false;
    }

    this.faceHighlightMesh.material = this.faceHighlightMaterial;
    this.faceHighlightMesh.useVertexColors = true;
    this.faceHighlightMesh.renderingGroupId = 1;
  }

  private clearFaceHighlight(): void {
    if (this.faceHighlightMesh) {
      this.faceHighlightMesh.dispose();
      this.faceHighlightMesh = null;
    }
  }

  private createTerrainMeshFromTopology(): void {
    if (!this.topology) return;

    const { positions, indices, uvs, normals, terrainTypes } = buildMeshArrays(
      this.topology,
      HEIGHT_UNIT
    );

    VertexData.ComputeNormals(positions, indices, normals);

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
    
    // Pass custom attributes
    this.terrainMesh.setVerticesData("terrainType", terrainTypes, false, 1);

    this.terrainMesh.isPickable = true;
    this.terrainMesh.freezeWorldMatrix();
    this.applyMaterial();
  }

  public setFaceTerrain(faceId: number, type: TerrainType): { beforeState: TopologyModification['beforeState'] } | null {
      if (!this.topology) return null;
      const tri = this.topology.triangles.get(faceId);
      if (!tri) return null;

      const code = getTerrainCode(type);
      if (tri.terrainCode === code) return null;

      const beforeState = captureTopologyState(this.topology);
      
      tri.terrainCode = code;
      
      this.meshDirty = true;
      
      return { beforeState };
  }

  private updateEdgeHighlight(): void {
    this.rebuildAllEdgesMeshWithHighlights();
  }

  private clearEdgeHighlight(): void {
    if (this.edgeHighlightMesh) {
      this.edgeHighlightMesh.dispose();
      this.edgeHighlightMesh = null;
    }
    if (this.selectedEdgeHighlightMesh) {
      this.selectedEdgeHighlightMesh.dispose();
      this.selectedEdgeHighlightMesh = null;
    }
  }

  public rebuildMesh(): void {
    if (this.topology) {
      sanitizeTopology(this.topology);
      this.rebuildFaceSpatialIndex();
      this.createTerrainMeshFromTopology();
    } else {
      this.createTerrainMesh();
    }
    this.createCliffFaces();
    if (this.options.enableGridLines) {
      this.createGridLines();
    }
    if (this.wireframeEnabled) {
      this.createWireframeMesh();
    }
    if (this.activeTopologyMode === 'edge') {
      this.createAllEdgesMesh();
    }
    if (this.activeTopologyMode === 'face') {
      this.rebuildFaceHighlightMesh();
    }
    this.meshDirty = false;
  }

  // ============================================
  // Mesh Creation
  // ============================================

  private createTerrainMesh(): void {
    const { worldWidth, worldHeight } = this;

    const gridW = this.vertexWidth - 1;
    const gridH = this.vertexHeight - 1;

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const meshRes = this.options.meshResolution;
    for (let vy = 0; vy < this.vertexHeight; vy++) {
      for (let vx = 0; vx < this.vertexWidth; vx++) {
        const pos = this.vertexPositions[vy][vx];
        const worldY = pos.y * HEIGHT_UNIT;

        positions.push(pos.x, worldY, pos.z);

        // Use original grid position for UVs so terrain types "stick" to the mesh
        // rather than sliding when vertices are moved
        const originalX = vx / meshRes;
        const originalZ = vy / meshRes;
        uvs.push(originalX / worldWidth, originalZ / worldHeight);
      }
    }

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const topLeft = gy * this.vertexWidth + gx;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + this.vertexWidth;
        const bottomRight = bottomLeft + 1;

        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    VertexData.ComputeNormals(positions, indices, normals);

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
    
    // Fallback terrainTypes (all 0/Fairway)
    const terrainTypes = new Float32Array(positions.length / 3).fill(0);
    this.terrainMesh.setVerticesData("terrainType", terrainTypes, false, 1);

    this.terrainMesh.isPickable = true;
    this.terrainMesh.freezeWorldMatrix();
    this.applyMaterial();
  }

  private createCliffFaces(): void {
    for (const mesh of this.cliffMeshes) {
      mesh.dispose();
    }
    this.cliffMeshes = [];

    const cliffDepth = 1.5;

    if (!this.cliffMaterial) {
      this.cliffMaterial = new StandardMaterial("cliffMaterial", this.scene);
      this.cliffMaterial.diffuseColor = new Color3(0.6, 0.5, 0.35);
      this.cliffMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
      this.cliffMaterial.backFaceCulling = false;
    }

    const rightCliff = this.createEdgeCliff("right", cliffDepth);
    rightCliff.material = this.cliffMaterial;
    this.cliffMeshes.push(rightCliff);

    const bottomCliff = this.createEdgeCliff("bottom", cliffDepth);
    bottomCliff.material = this.cliffMaterial;
    this.cliffMeshes.push(bottomCliff);

    const internalCliff = this.createInternalCliffs(1.5);
    if (internalCliff) {
      internalCliff.material = this.cliffMaterial;
      this.cliffMeshes.push(internalCliff);
    }
  }

  private createInternalCliffs(threshold: number): Mesh | null {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const topColor = new Color4(0.65, 0.53, 0.38, 1);
    const bottomColor = new Color4(0.48, 0.40, 0.30, 1);

    const meshRes = this.options.meshResolution;

    for (let vy = 0; vy < this.vertexHeight; vy++) {
      for (let vx = 0; vx < this.vertexWidth - 1; vx++) {
        const elev1 = this.vertexPositions[vy]?.[vx]?.y ?? 0;
        const elev2 = this.vertexPositions[vy]?.[vx + 1]?.y ?? 0;
        const diff = elev2 - elev1;

        if (Math.abs(diff) >= threshold) {
          const cliffX = (vx + 1) / meshRes;
          const highElev = Math.max(elev1, elev2) * HEIGHT_UNIT;
          const lowElev = Math.min(elev1, elev2) * HEIGHT_UNIT;

          const baseIdx = positions.length / 3;
          const z1 = vy / meshRes;
          const z2 = Math.min((vy + 1) / meshRes, this.worldHeight);

          if (diff > 0) {
            positions.push(cliffX, highElev, z1);
            positions.push(cliffX, highElev, z2);
            positions.push(cliffX, lowElev, z2);
            positions.push(cliffX, lowElev, z1);
          } else {
            positions.push(cliffX, highElev, z2);
            positions.push(cliffX, highElev, z1);
            positions.push(cliffX, lowElev, z1);
            positions.push(cliffX, lowElev, z2);
          }

          colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
          colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

          indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
          indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
        }
      }
    }

    for (let vy = 0; vy < this.vertexHeight - 1; vy++) {
      for (let vx = 0; vx < this.vertexWidth; vx++) {
        const elev1 = this.vertexPositions[vy]?.[vx]?.y ?? 0;
        const elev2 = this.vertexPositions[vy + 1]?.[vx]?.y ?? 0;
        const diff = elev2 - elev1;

        if (Math.abs(diff) >= threshold) {
          const cliffZ = (vy + 1) / meshRes;
          const highElev = Math.max(elev1, elev2) * HEIGHT_UNIT;
          const lowElev = Math.min(elev1, elev2) * HEIGHT_UNIT;

          const baseIdx = positions.length / 3;
          const x1 = vx / meshRes;
          const x2 = Math.min((vx + 1) / meshRes, this.worldWidth);

          if (diff > 0) {
            positions.push(x1, highElev, cliffZ);
            positions.push(x2, highElev, cliffZ);
            positions.push(x2, lowElev, cliffZ);
            positions.push(x1, lowElev, cliffZ);
          } else {
            positions.push(x2, highElev, cliffZ);
            positions.push(x1, highElev, cliffZ);
            positions.push(x1, lowElev, cliffZ);
            positions.push(x2, lowElev, cliffZ);
          }

          colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
          colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

          indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
          indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
        }
      }
    }

    if (positions.length === 0) return null;

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh("internalCliffs", this.scene);
    vertexData.applyToMesh(mesh);
    mesh.useVertexColors = true;

    return mesh;
  }

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

    const segments = 20;

    if (side === "right") {
      const x = this.worldWidth;
      for (let i = 0; i < segments; i++) {
        const y1 = (i / segments) * this.worldHeight;
        const y2 = ((i + 1) / segments) * this.worldHeight;

        const elev1 = this.getInterpolatedElevation(x - 0.01, y1) * HEIGHT_UNIT;
        const elev2 = this.getInterpolatedElevation(x - 0.01, y2) * HEIGHT_UNIT;

        const baseIdx = positions.length / 3;

        positions.push(x, elev1, y1);
        positions.push(x, elev2, y2);
        positions.push(x, elev2 - cliffDepth, y2);
        positions.push(x, elev1 - cliffDepth, y1);

        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    } else {
      const y = this.worldHeight;
      for (let i = 0; i < segments; i++) {
        const x1 = (i / segments) * this.worldWidth;
        const x2 = ((i + 1) / segments) * this.worldWidth;

        const elev1 = this.getInterpolatedElevation(x1, y - 0.01) * HEIGHT_UNIT;
        const elev2 = this.getInterpolatedElevation(x2, y - 0.01) * HEIGHT_UNIT;

        const baseIdx = positions.length / 3;

        positions.push(x1, elev1, y);
        positions.push(x2, elev2, y);
        positions.push(x2, elev2 - cliffDepth, y);
        positions.push(x1, elev1 - cliffDepth, y);

        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(topColor.r, topColor.g, topColor.b, topColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomColor.a);

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

  private createGridLines(): void {
    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
      this.gridLinesMesh = null;
    }

    if (!this.options.enableGridLines) return;

    const lines: Vector3[][] = [];
    const lineOffset = 0.05;

    const res = this.options.meshResolution;
    const step = 1 / res;

    for (let y = 0; y <= this.worldHeight; y += step) {
      const line: Vector3[] = [];
      for (let x = 0; x <= this.worldWidth; x += step) {
        const elev = this.getInterpolatedElevation(x, y);
        line.push(new Vector3(x, elev * HEIGHT_UNIT + lineOffset, y));
      }
      lines.push(line);
    }

    for (let x = 0; x <= this.worldWidth; x += step) {
      const line: Vector3[] = [];
      for (let y = 0; y <= this.worldHeight; y += step) {
        const elev = this.getInterpolatedElevation(x, y);
        line.push(new Vector3(x, elev * HEIGHT_UNIT + lineOffset, y));
      }
      lines.push(line);
    }

    const colors: Color4[][] = lines.map(line =>
      line.map(() => new Color4(0.3, 0.3, 0.3, 0.5))
    );

    this.gridLinesMesh = MeshBuilder.CreateLineSystem(
      "gridLines",
      { lines, colors, updatable: false },
      this.scene
    );
  }

  public setGridLinesEnabled(enabled: boolean): void {
    this.options.enableGridLines = enabled;

    if (enabled && !this.gridLinesMesh) {
      this.createGridLines();
    } else if (!enabled && this.gridLinesMesh) {
      this.gridLinesMesh.setEnabled(false);
    } else if (enabled && this.gridLinesMesh) {
      this.gridLinesMesh.setEnabled(true);
    }
  }

  public getResolution(): number {
    return this.options.meshResolution;
  }

  public gridToWorld(gridX: number, gridY: number): Vector3 {
    const res = this.options.meshResolution;
    return new Vector3(gridX / res, 0, gridY / res);
  }

  private getInterpolatedElevation(worldX: number, worldZ: number): number {
    const meshRes = this.options.meshResolution;

    const fvx = worldX * meshRes;
    const fvy = worldZ * meshRes;

    const vx0 = Math.floor(fvx);
    const vy0 = Math.floor(fvy);
    const vx1 = Math.min(vx0 + 1, this.vertexWidth - 1);
    const vy1 = Math.min(vy0 + 1, this.vertexHeight - 1);

    const tx = fvx - vx0;
    const ty = fvy - vy0;

    const e00 = this.vertexPositions[vy0]?.[vx0]?.y ?? 0;
    const e10 = this.vertexPositions[vy0]?.[vx1]?.y ?? 0;
    const e01 = this.vertexPositions[vy1]?.[vx0]?.y ?? 0;
    const e11 = this.vertexPositions[vy1]?.[vx1]?.y ?? 0;

    const e0 = e00 * (1 - tx) + e10 * tx;
    const e1 = e01 * (1 - tx) + e11 * tx;

    return e0 * (1 - ty) + e1 * ty;
  }

  // ============================================
  // SDF Textures (Grid-based only)
  // ============================================

  private generateSDFTextures(): void {
    const sdfOptions: Partial<SDFGeneratorOptions> = {
      resolution: this.options.sdfResolution,
      maxDistance: 5,
    };

    this.sdfTextures = generateSDFFromGrid(
      this.scene,
      this.getLayoutGrid(),
      this.worldWidth,
      this.worldHeight,
      sdfOptions
    );

    this.createHealthTexture();
  }

  private createHealthTexture(): void {
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

    if (this.healthTexture) {
      this.healthTexture.update(data);
    } else {
      this.healthTexture = RawTexture.CreateRGBATexture(
        data,
        texWidth,
        texHeight,
        this.scene,
        false,
        false,
        Engine.TEXTURE_NEAREST_SAMPLINGMODE
      );
      this.healthTexture.name = "healthData";
      this.healthTexture.wrapU = RawTexture.CLAMP_ADDRESSMODE;
      this.healthTexture.wrapV = RawTexture.CLAMP_ADDRESSMODE;
    }
  }

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
        attributes: ["position", "normal", "uv", "terrainType"],
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
          "overlayOpacity",
          "overlayOffsetX",
          "overlayOffsetZ",
          "overlayScaleX",
          "overlayScaleZ",
          "overlayFlipX",
          "overlayFlipY",
          "overlayRotation",
        ],
        samplers: ["sdfCombined", "sdfTee", "healthData", "overlayImage"],
      }
    );

    this.shaderMaterial.setTexture("sdfCombined", this.sdfTextures.combined);
    this.shaderMaterial.setTexture("sdfTee", this.sdfTextures.tee);
    this.shaderMaterial.setTexture("healthData", this.healthTexture);

    const uniforms = getDefaultUniforms(this.worldWidth, this.worldHeight);
    this.shaderMaterial.setVector2("worldSize", new Vector2(this.worldWidth, this.worldHeight));
    this.shaderMaterial.setFloat("time", 0);
    this.shaderMaterial.setFloat("edgeBlend", this.options.edgeBlend);
    this.shaderMaterial.setFloat("maxSdfDistance", uniforms.maxSdfDistance);
    this.shaderMaterial.setFloat("overlayMode", this.getOverlayModeValue());

    this.shaderMaterial.setColor3("roughColor", new Color3(...uniforms.roughColor));
    this.shaderMaterial.setColor3("fairwayColor", new Color3(...uniforms.fairwayColor));
    this.shaderMaterial.setColor3("greenColor", new Color3(...uniforms.greenColor));
    this.shaderMaterial.setColor3("bunkerColor", new Color3(...uniforms.bunkerColor));
    this.shaderMaterial.setColor3("waterColor", new Color3(...uniforms.waterColor));
    this.shaderMaterial.setColor3("waterDeepColor", new Color3(...uniforms.waterDeepColor));
    this.shaderMaterial.setColor3("teeColor", new Color3(...uniforms.teeColor));

    this.shaderMaterial.setFloat("enableStripes", this.options.enableStripes ? 1 : 0);
    this.shaderMaterial.setFloat("enableNoise", this.options.enableNoise ? 1 : 0);
    this.shaderMaterial.setFloat("enableWaterAnim", this.options.enableWaterAnim ? 1 : 0);

    this.defaultOverlayTexture = RawTexture.CreateRGBATexture(
      new Uint8Array([0, 0, 0, 0]),
      1, 1, this.scene, false, false
    );
    this.shaderMaterial.setTexture("overlayImage", this.defaultOverlayTexture);
    this.shaderMaterial.setFloat("overlayOpacity", 0);
    this.shaderMaterial.setFloat("overlayOffsetX", 0);
    this.shaderMaterial.setFloat("overlayOffsetZ", 0);
    this.shaderMaterial.setFloat("overlayScaleX", 1);
    this.shaderMaterial.setFloat("overlayScaleZ", 1);
    this.shaderMaterial.setFloat("overlayFlipX", 0);
    this.shaderMaterial.setFloat("overlayFlipY", 0);
    this.shaderMaterial.setFloat("overlayRotation", 0);

    this.shaderMaterial.backFaceCulling = false;
  }

  private getOverlayModeValue(): number {
    switch (this.overlayMode) {
      case "normal": return 0;
      case "moisture": return 1;
      case "nutrients": return 2;
      case "height": return 3;
      case "irrigation": return 4;
      default: return 0;
    }
  }

  private applyMaterial(): void {
    if (this.terrainMesh && this.shaderMaterial) {
      this.terrainMesh.material = this.shaderMaterial;
    }
  }

  public update(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void {
    this.gameTime = gameTimeMinutes;
    this.time += deltaMs / 1000;

    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("time", this.time);
    }

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

    if (this.overlayMode !== "normal") {
      this.healthTextureUpdateCounter++;
      if (this.healthTextureUpdateCounter >= VectorTerrainSystem.HEALTH_TEXTURE_UPDATE_INTERVAL) {
        this.updateHealthTexture();
        this.healthTextureUpdateCounter = 0;
      }
    }

    if (this.shapesDirty) {
      this.rebuildSDFTextures();
      this.shapesDirty = false;
    }

    if (this.meshDirty) {
      this.rebuildMesh();
    }
  }

  private rebuildSDFTextures(): void {
    if (!this.sdfTextures) return;

    updateSDFFromGrid(
      this.sdfTextures,
      this.getLayoutGrid(),
      this.worldWidth,
      this.worldHeight,
      { resolution: this.options.sdfResolution }
    );
  }


  // ============================================
  // Visual settings
  // ============================================

  public setEdgeBlend(width: number): void {
    this.options.edgeBlend = width;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("edgeBlend", width);
    }
  }

  public setStripesEnabled(enabled: boolean): void {
    this.options.enableStripes = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableStripes", enabled ? 1 : 0);
    }
  }

  public setNoiseEnabled(enabled: boolean): void {
    this.options.enableNoise = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableNoise", enabled ? 1 : 0);
    }
  }

  public setWaterAnimEnabled(enabled: boolean): void {
    this.options.enableWaterAnim = enabled;
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("enableWaterAnim", enabled ? 1 : 0);
    }
  }

  public setTerrainColor(type: 'green' | 'fairway' | 'bunker' | 'water' | 'tee' | 'rough' | 'waterDeep', color: Color3): void {
    if (!this.shaderMaterial) return;

    const uniformName = `${type}Color`;
    this.shaderMaterial.setColor3(uniformName, color);
  }

  // ============================================
  // Grid access (for simulation compatibility)
  // ============================================

  public getCell(worldX: number, worldY: number): CellState | null {
    return this.cells[Math.floor(worldY)]?.[Math.floor(worldX)] ?? null;
  }

  public getMeshCell(meshX: number, meshY: number): CellState | null {
    const res = this.getResolution();
    return this.getCell(meshX / res, meshY / res);
  }

  public getAllCells(): CellState[][] {
    return this.cells;
  }


  public getElevationAt(worldX: number, worldY: number, defaultForOutOfBounds?: number): number {
    if (worldX < 0 || worldX >= this.worldWidth || worldY < 0 || worldY >= this.worldHeight) {
      return defaultForOutOfBounds ?? 0;
    }
    return this.getInterpolatedElevation(worldX, worldY);
  }

  public getMeshElevationAt(meshX: number, meshY: number, defaultForOutOfBounds?: number): number {
    const res = this.getResolution();
    return this.getElevationAt(meshX / res, meshY / res, defaultForOutOfBounds);
  }

  public getCornerHeightsPublic(gridX: number, gridY: number): { nw: number; ne: number; se: number; sw: number } {
    const res = this.options.meshResolution;
    const wx = gridX / res;
    const wy = gridY / res;
    const step = 1 / res;
    return {
      nw: this.getInterpolatedElevation(wx, wy),
      ne: this.getInterpolatedElevation(wx + step, wy),
      se: this.getInterpolatedElevation(wx + step, wy + step),
      sw: this.getInterpolatedElevation(wx, wy + step),
    };
  }

  public setElevationAt(meshX: number, meshY: number, elev: number): void {
    const res = this.options.meshResolution;
    const worldX = meshX / res;
    const worldY = meshY / res;

    if (worldX < 0 || worldX >= this.worldWidth || worldY < 0 || worldY >= this.worldHeight) return;

    const vxStart = Math.floor(worldX * res);
    const vyStart = Math.floor(worldY * res);
    const vxEnd = Math.min(Math.ceil((worldX + 1) * res), this.vertexWidth - 1);
    const vyEnd = Math.min(Math.ceil((worldY + 1) * res), this.vertexHeight - 1);

    for (let vy = vyStart; vy <= vyEnd; vy++) {
      for (let vx = vxStart; vx <= vxEnd; vx++) {
        if (this.vertexPositions[vy]?.[vx]) {
          this.vertexPositions[vy][vx].y = elev;
        }
      }
    }

    const cell = this.cells[Math.floor(worldY)]?.[Math.floor(worldX)];
    if (cell) cell.elevation = elev;
    this.meshDirty = true;
  }

  public setTerrainTypeAt(gx: number, gy: number, type: TerrainType): void {
    const res = this.getResolution();
    const worldX = gx / res;
    const worldY = gy / res;
    
    // Update topology
    const faceId = this.findFaceAtPosition(worldX, worldY);
    if (faceId !== null && this.topology) {
      const tri = this.topology.triangles.get(faceId);
      if (tri) {
        tri.terrainCode = getTerrainCode(type);
      }
    }
    
    // Update low-res cell for simulation
    const cx = Math.floor(worldX);
    const cy = Math.floor(worldY);
    const cell = this.cells[cy]?.[cx];
    if (cell) {
      const initialValues = getInitialValues(type);
      cell.type = type;
      cell.height = initialValues.height;
      cell.moisture = initialValues.moisture;
      cell.nutrients = initialValues.nutrients;
      cell.health = calculateHealth(cell);
    }
    
    this.shapesDirty = true;
  }

  public getTerrainTypeAt(gx: number, gy: number): TerrainType {
    const res = this.getResolution();
    const worldX = gx / res;
    const worldY = gy / res;
    
    const faceId = this.findFaceAtPosition(worldX, worldY);
    if (faceId !== null && this.topology) {
      const tri = this.topology.triangles.get(faceId);
      if (tri) return getTerrainType(tri.terrainCode);
    }
    
    return getTerrainType(TERRAIN_CODES.ROUGH);
  }

  public getLayoutGrid(): number[][] {
    const res = this.getResolution();
    const gridWidth = Math.ceil(this.worldWidth * res);
    const gridHeight = Math.ceil(this.worldHeight * res);

    const layoutGrid: number[][] = [];
    for (let y = 0; y < gridHeight; y++) {
      layoutGrid[y] = new Array(gridWidth).fill(TERRAIN_CODES.ROUGH);
    }

    if (!this.topology) return layoutGrid;

    // Faster way: iterate triangles and "splat" them onto the grid?
    // Or just iterate grid and sample. Sampling is simpler and reliable.
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const worldX = (gx + 0.5) / res;
        const worldY = (gy + 0.5) / res;
        const faceId = this.findFaceAtPosition(worldX, worldY);
        if (faceId !== null) {
          const tri = this.topology.triangles.get(faceId);
          if (tri) {
            layoutGrid[gy][gx] = tri.terrainCode;
          }
        }
      }
    }

    return layoutGrid;
  }

  public paintTerrainType(cells: Array<{ x: number; y: number }>, type: TerrainType): void {
    const res = this.getResolution();
    const terrainCode = getTerrainCode(type);
    
    for (const pos of cells) {
      const worldX = pos.x / res;
      const worldY = pos.y / res;
      
      // Update topology
      const faceId = this.findFaceAtPosition(worldX, worldY);
      if (faceId !== null && this.topology) {
        const tri = this.topology.triangles.get(faceId);
        if (tri) {
          tri.terrainCode = terrainCode;
        }
      }
      
      const cx = Math.floor(worldX);
      const cy = Math.floor(worldY);
      const cell = this.cells[cy]?.[cx];
      if (cell) {
        const initialValues = getInitialValues(type);
        cell.type = type;
        cell.height = initialValues.height;
        cell.moisture = initialValues.moisture;
        cell.nutrients = initialValues.nutrients;
        cell.health = calculateHealth(cell);
      }
    }
    this.shapesDirty = true;
    this.meshDirty = true;
  }

  public rebuildTileAndNeighbors(_x: number, _y: number): void {
    this.meshDirty = true;
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


  // ============================================
  // Maintenance actions
  // ============================================

  public mowAt(worldX: number, worldY: number): boolean {
    const res = this.getResolution();
    const gx = Math.floor(worldX * res);
    const gy = Math.floor(worldY * res);
    const cell = this.getCell(gx, gy);
    if (!cell) return false;
    const result = applyMowing(cell);
    if (!result) return false;
    this.cells[gy][gx] = result;
    result.lastMowed = this.gameTime;
    this.shapesDirty = true;
    return true;
  }

  public rakeAt(worldX: number, worldY: number): boolean {
    const res = this.getResolution();
    const gx = Math.floor(worldX * res);
    const gy = Math.floor(worldY * res);
    const cell = this.getCell(gx, gy);
    if (!cell) return false;
    cell.height = Math.max(0.2, cell.height - 0.1);
    this.shapesDirty = true;
    return true;
  }

  public waterArea(centerX: number, centerY: number, radius: number, amount: number): number {
    let affectedCount = 0;
    const radiusSq = radius * radius;
    const res = this.getResolution();

    const startY = Math.max(0, Math.floor((centerY - radius) * res));
    const endY = Math.min(this.cells.length - 1, Math.ceil((centerY + radius) * res));
    const startX = Math.max(0, Math.floor((centerX - radius) * res));
    const endX = Math.min(this.cells[0]?.length - 1, Math.ceil((centerX + radius) * res));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const worldX = x / res;
        const worldY = y / res;
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        if (dx * dx + dy * dy <= radiusSq) {
          const cell = this.getMeshCell(x, y);
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
    const res = this.getResolution();

    const startY = Math.max(0, Math.floor((centerY - radius) * res));
    const endY = Math.min(this.cells.length - 1, Math.ceil((centerY + radius) * res));
    const startX = Math.max(0, Math.floor((centerX - radius) * res));
    const endX = Math.min(this.cells[0]?.length - 1, Math.ceil((centerX + radius) * res));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const worldX = x / res;
        const worldY = y / res;
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        if (dx * dx + dy * dy <= radiusSq) {
          const cell = this.getMeshCell(x, y);
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
    if (this.shaderMaterial) {
      this.shaderMaterial.setFloat("overlayMode", this.getOverlayModeValue());
    }
    if (mode !== "normal") {
      this.updateHealthTexture();
    }
  }

  public getUpdateCount(): number {
    return 0;
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
  // Image Overlay
  // ============================================

  public setImageOverlayTexture(texture: RawTexture): void {
    this.overlayTexture = texture;
    this.shaderMaterial?.setTexture("overlayImage", texture);
  }

  public setImageOverlayOpacity(opacity: number): void {
    this.shaderMaterial?.setFloat("overlayOpacity", opacity);
  }

  public setImageOverlayTransform(offsetX: number, offsetZ: number, scaleX: number, scaleZ: number): void {
    this.shaderMaterial?.setFloat("overlayOffsetX", offsetX);
    this.shaderMaterial?.setFloat("overlayOffsetZ", offsetZ);
    this.shaderMaterial?.setFloat("overlayScaleX", scaleX);
    this.shaderMaterial?.setFloat("overlayScaleZ", scaleZ);
  }

  public setImageOverlayFlip(flipX: boolean, flipY: boolean): void {
    this.shaderMaterial?.setFloat("overlayFlipX", flipX ? 1 : 0);
    this.shaderMaterial?.setFloat("overlayFlipY", flipY ? 1 : 0);
  }

  public setImageOverlayRotation(steps: number): void {
    this.shaderMaterial?.setFloat("overlayRotation", steps % 4);
  }

  public clearImageOverlay(): void {
    if (this.overlayTexture) {
      this.overlayTexture.dispose();
      this.overlayTexture = null;
    }
    if (this.defaultOverlayTexture) {
      this.shaderMaterial?.setTexture("overlayImage", this.defaultOverlayTexture);
    }
    this.shaderMaterial?.setFloat("overlayOpacity", 0);
  }

  public getWorldWidth(): number {
    return this.worldWidth;
  }

  public getWorldHeight(): number {
    return this.worldHeight;
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

    if (this.overlayTexture) {
      this.overlayTexture.dispose();
      this.overlayTexture = null;
    }
    if (this.defaultOverlayTexture) {
      this.defaultOverlayTexture.dispose();
      this.defaultOverlayTexture = null;
    }

    for (const mesh of this.cliffMeshes) {
      mesh.dispose();
    }
    this.cliffMeshes = [];

    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
      this.gridLinesMesh = null;
    }

    if (this.wireframeMesh) {
      this.wireframeMesh.dispose();
      this.wireframeMesh = null;
    }

    if (this.axisIndicatorMesh) {
      this.axisIndicatorMesh.dispose();
      this.axisIndicatorMesh = null;
    }

    this.clearEdgeHighlight();
    this.clearSelectedEdgeHighlight();
    this.clearAllEdgesMesh();
    this.clearFaceHighlight();
    this.topology = null;
  }

  private wireframeMesh: Mesh | null = null;
  private wireframeEnabled: boolean = false;
  private axisIndicatorMesh: Mesh | null = null;

  public setWireframeEnabled(enabled: boolean): void {
    this.wireframeEnabled = enabled;
    if (enabled && !this.wireframeMesh) {
      this.createWireframeMesh();
    } else if (!enabled && this.wireframeMesh) {
      this.wireframeMesh.dispose();
      this.wireframeMesh = null;
    }
  }

  public setAxisIndicatorEnabled(enabled: boolean): void {
    if (enabled && !this.axisIndicatorMesh) {
      this.createAxisIndicator();
    } else if (!enabled && this.axisIndicatorMesh) {
      this.axisIndicatorMesh.dispose();
      this.axisIndicatorMesh = null;
    }
  }

  private createAxisIndicator(): void {
    if (this.axisIndicatorMesh) {
      this.axisIndicatorMesh.dispose();
    }

    const origin = new Vector3(1, 0.5, 1);
    const arrowLength = 2;

    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];

    // East/West axis (Red) - +X direction
    lines.push([origin, new Vector3(origin.x + arrowLength, origin.y, origin.z)]);
    colors.push([new Color4(1, 0.2, 0.2, 1), new Color4(1, 0.2, 0.2, 1)]);
    // Arrow head
    lines.push([
      new Vector3(origin.x + arrowLength, origin.y, origin.z),
      new Vector3(origin.x + arrowLength - 0.3, origin.y + 0.15, origin.z),
    ]);
    colors.push([new Color4(1, 0.2, 0.2, 1), new Color4(1, 0.2, 0.2, 1)]);
    lines.push([
      new Vector3(origin.x + arrowLength, origin.y, origin.z),
      new Vector3(origin.x + arrowLength - 0.3, origin.y - 0.15, origin.z),
    ]);
    colors.push([new Color4(1, 0.2, 0.2, 1), new Color4(1, 0.2, 0.2, 1)]);

    // Elevation axis (Green) - +Y direction
    lines.push([origin, new Vector3(origin.x, origin.y + arrowLength * 0.5, origin.z)]);
    colors.push([new Color4(0.2, 1, 0.2, 1), new Color4(0.2, 1, 0.2, 1)]);
    // Arrow head
    lines.push([
      new Vector3(origin.x, origin.y + arrowLength * 0.5, origin.z),
      new Vector3(origin.x + 0.15, origin.y + arrowLength * 0.5 - 0.3, origin.z),
    ]);
    colors.push([new Color4(0.2, 1, 0.2, 1), new Color4(0.2, 1, 0.2, 1)]);
    lines.push([
      new Vector3(origin.x, origin.y + arrowLength * 0.5, origin.z),
      new Vector3(origin.x - 0.15, origin.y + arrowLength * 0.5 - 0.3, origin.z),
    ]);
    colors.push([new Color4(0.2, 1, 0.2, 1), new Color4(0.2, 1, 0.2, 1)]);

    // North/South axis (Blue) - -Z is North, so arrow points -Z
    lines.push([origin, new Vector3(origin.x, origin.y, origin.z - arrowLength)]);
    colors.push([new Color4(0.2, 0.4, 1, 1), new Color4(0.2, 0.4, 1, 1)]);
    // Arrow head (pointing North/-Z)
    lines.push([
      new Vector3(origin.x, origin.y, origin.z - arrowLength),
      new Vector3(origin.x, origin.y + 0.15, origin.z - arrowLength + 0.3),
    ]);
    colors.push([new Color4(0.2, 0.4, 1, 1), new Color4(0.2, 0.4, 1, 1)]);
    lines.push([
      new Vector3(origin.x, origin.y, origin.z - arrowLength),
      new Vector3(origin.x, origin.y - 0.15, origin.z - arrowLength + 0.3),
    ]);
    colors.push([new Color4(0.2, 0.4, 1, 1), new Color4(0.2, 0.4, 1, 1)]);

    this.axisIndicatorMesh = MeshBuilder.CreateLineSystem(
      "axisIndicator",
      { lines, colors, updatable: false },
      this.scene
    );
  }

  private createWireframeMesh(): void {
    if (this.wireframeMesh) {
      this.wireframeMesh.dispose();
      this.wireframeMesh = null;
    }

    if (!this.topology) return;

    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    const lineOffset = 0.02;

    for (const [, edge] of this.topology.edges) {
      const v1 = this.topology.vertices.get(edge.v1);
      const v2 = this.topology.vertices.get(edge.v2);
      if (!v1 || !v2) continue;

      lines.push([
        new Vector3(v1.position.x, v1.position.y * HEIGHT_UNIT + lineOffset, v1.position.z),
        new Vector3(v2.position.x, v2.position.y * HEIGHT_UNIT + lineOffset, v2.position.z),
      ]);

      colors.push([
        new Color4(0.8, 0.8, 0.2, 0.7),
        new Color4(0.8, 0.8, 0.2, 0.7),
      ]);
    }

    if (lines.length > 0) {
      this.wireframeMesh = MeshBuilder.CreateLineSystem(
        "terrainWireframe",
        { lines, colors, updatable: false },
        this.scene
      );
    }
  }

}
