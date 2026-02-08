import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

import {
  terrainVertexShader,
  terrainFragmentShader,
  getDefaultUniforms,
} from "../shaders/terrainShader";

import { HEIGHT_UNIT } from "../engine/BabylonEngine";
import { CourseData } from "../../data/courseData";
import { TerrainType, getTerrainType, getTerrainCode, getInitialValues, calculateHealth, TERRAIN_CODES, OverlayMode, getTerrainSpeedModifier, isFaceWalkableBySlope } from "../../core/terrain";
import { TopologyMode, getEdgesInBrush } from "../../core/terrain-editor-logic";
import { WeatherEffect } from "../../core/grass-simulation";
import {
  FaceState,
  createFaceState,
  simulateFaceGrowth,
  applyFaceMowing,
  applyFaceWatering,
  applyFaceFertilizing,
  isGrassFace,
  getAverageFaceStats,
} from "../../core/face-state";
import {
  Vec3,
  TerrainMeshTopology,
  TerrainTriangle,
  buildMeshArrays,
  findNearestEdge,
  subdivideEdge,
  deleteVertex,
  canDeleteVertex,
  findNearestTopologyVertex,
  collapseEdge,
  flipEdge,
  deserializeTopology,
  barycentricInterpolateY,
  getTriangleCentroid,
  pointInTriangle,
} from "../../core/mesh-topology";
import { rotateAroundPivot } from "../../core/transform-ops";
import { ShapeTemplate, generateStampTopology, stampIntoTopology } from "../../core/shape-templates";

export interface TerrainMeshOptions {
  enableStripes: boolean;
  enableNoise: boolean;
  enableWaterAnim: boolean;
  meshResolution: number;
  enableGridLines: boolean;
}

function findDominantTerrainCode(terrainCounts: Map<number, number>): number {
  let maxCount = 0;
  let dominant: number = TERRAIN_CODES.FAIRWAY;
  for (const [code, cnt] of terrainCounts) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominant = code;
    }
  }
  return dominant;
}

const DEFAULT_OPTIONS: TerrainMeshOptions = {
  enableStripes: true,
  enableNoise: true,
  enableWaterAnim: true,
  meshResolution: 2,
  enableGridLines: false,
};

export class TerrainMeshSystem {
  private scene: Scene;
  private options: TerrainMeshOptions;

  private worldWidth: number;
  private worldHeight: number;

  private terrainMesh: Mesh | null = null;
  private shaderMaterial: ShaderMaterial | null = null;
  private faceDataTexture: RawTexture | null = null;
  private overlayTexture: RawTexture | null = null;
  private defaultOverlayTexture: RawTexture | null = null;
  private gridLinesMesh: Mesh | null = null;

  private faceStates: Map<number, FaceState> = new Map();
  private faceIdToTexIndex: Map<number, number> = new Map();

  private time: number = 0;
  private gameTime: number = 0;

  private meshDirty: boolean = false;
  private topologyDirty: boolean = false;
  private faceHighlightMaterial: StandardMaterial | null = null;

  private overlayMode: OverlayMode = "normal";

  private faceDataUpdateCounter: number = 0;
  private faceDataDirty: boolean = false;
  private static readonly FACE_DATA_UPDATE_INTERVAL: number = 10;

  private topology: TerrainMeshTopology | null = null;
  private hoveredEdgeId: number | null = null;
  private selectedEdgeId: number | null = null;
  private selectedEdgeIds: Set<number> = new Set();
  private brushHoveredEdgeIds: Set<number> = new Set();
  private allEdgesMesh: Mesh | null = null;
  private activeTopologyMode: TopologyMode = 'vertex';
  private hoveredFaceId: number | null = null;
  private selectedFaceIds: Set<number> = new Set();
  private brushHoveredFaceIds: Set<number> = new Set();
  private faceHighlightMesh: Mesh | null = null;
  private faceSpatialIndex: Array<Set<number>> = [];
  private wireframeMesh: Mesh | null = null;
  private wireframeEnabled: boolean = false;
  private axisIndicatorMesh: Mesh | null = null;

  constructor(
    scene: Scene,
    courseData: CourseData,
    options: Partial<TerrainMeshOptions> = {}
  ) {
    this.scene = scene;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.worldWidth = courseData.width;
    this.worldHeight = courseData.height;

    this.registerShader();
  }

  private registerShader(): void {
    Effect.ShadersStore["terrainVertexShader"] = terrainVertexShader;
    Effect.ShadersStore["terrainFragmentShader"] = terrainFragmentShader;
  }

  public build(courseData: CourseData): void {
    this.initTopology(courseData);
    this.initFaceStates();
    this.rebuildMesh();
    this.createFaceDataTexture();
    this.createShaderMaterial();
    this.applyMaterial();
  }

  private initTopology(courseData: CourseData): void {
    this.topology = deserializeTopology(courseData.topology);
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

  private initFaceStates(): void {
    if (!this.topology) return;

    this.faceStates.clear();
    for (const [id, tri] of this.topology.triangles) {
      this.faceStates.set(id, createFaceState(id, tri.terrainCode));
    }
  }

  public getWorldDimensions(): { width: number; height: number } {
    return { width: this.worldWidth, height: this.worldHeight };
  }

  public getResolution(): number {
    return this.options.meshResolution;
  }

  public getFacesInBrush(worldX: number, worldZ: number, radius: number): number[] {
    if (!this.topology || !this.faceSpatialIndex || this.faceSpatialIndex.length === 0) return [];

    const radiusSq = radius * radius;
    const gridWidth = Math.ceil(this.worldWidth);
    const gridHeight = Math.ceil(this.worldHeight);

    const minGX = Math.max(0, Math.floor(worldX - radius));
    const maxGX = Math.min(gridWidth - 1, Math.ceil(worldX + radius));
    const minGZ = Math.max(0, Math.floor(worldZ - radius));
    const maxGZ = Math.min(gridHeight - 1, Math.ceil(worldZ + radius));

    const faceIds: number[] = [];
    const visited = new Set<number>();

    for (let gz = minGZ; gz <= maxGZ; gz++) {
      for (let gx = minGX; gx <= maxGX; gx++) {
        const cellSet = this.faceSpatialIndex[gz * gridWidth + gx];
        if (!cellSet) continue;

        for (const triId of cellSet) {
          if (visited.has(triId)) continue;
          visited.add(triId);

          const centroid = getTriangleCentroid(this.topology, triId);
          if (!centroid) continue;

          const dx = centroid.x - worldX;
          const dz = centroid.z - worldZ;
          if (dx * dx + dz * dz <= radiusSq) {
            faceIds.push(triId);
          }
        }
      }
    }

    return faceIds;
  }

  public getEdgesInBrush(worldX: number, worldZ: number, radius: number): number[] {
    if (!this.topology) return [];
    return getEdgesInBrush(worldX, worldZ, radius, this.topology);
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
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public setBrushHoveredEdges(edgeIds: number[]): void {
    this.brushHoveredEdgeIds = new Set(edgeIds);
    this.rebuildAllEdgesMeshWithHighlights();
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
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public toggleEdgeSelection(edgeId: number): void {
    if (this.selectedEdgeIds.has(edgeId)) {
      this.selectedEdgeIds.delete(edgeId);
    } else {
      this.selectedEdgeIds.add(edgeId);
      this.selectedEdgeId = edgeId;
    }
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public deselectAllEdges(): void {
    this.selectedEdgeIds.clear();
    this.selectedEdgeId = null;
    this.rebuildAllEdgesMeshWithHighlights();
  }

  public getSelectedEdgeIds(): Set<number> {
    return new Set(this.selectedEdgeIds);
  }

  public subdivideSelectedEdge(): void {
    if (this.selectedEdgeId === null || !this.topology) return;

    const result = subdivideEdge(this.topology, this.selectedEdgeId, 0.5);
    if (!result) return;

    this.deselectAllEdges();
    this.rebuildMesh();
  }

  public flipSelectedEdge(): void {
    if (this.selectedEdgeId === null || !this.topology) return;

    const result = flipEdge(this.topology, this.selectedEdgeId);
    if (!result) return;

    this.rebuildMesh();
  }

  private rebuildAllEdgesMeshWithHighlights(): void {
    this.clearAllEdgesMesh();

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

  public deleteTopologyVertex(vertexId: number): void {
    if (!this.topology) return;
    if (!canDeleteVertex(this.topology, vertexId)) return;

    const result = deleteVertex(this.topology, vertexId);
    if (!result) return;

    this.rebuildMesh();
  }

  public findNearestTopologyVertexAt(worldX: number, worldZ: number): {
    vertexId: number;
    dist: number;
  } | null {
    if (!this.topology) return null;
    return findNearestTopologyVertex(this.topology, worldX, worldZ);
  }

  public getVertexPositionById(vertexId: number): Vec3 | null {
    if (!this.topology) return null;
    const vertex = this.topology.vertices.get(vertexId);
    return vertex ? { ...vertex.position } : null;
  }

  public getVertexElevationById(vertexId: number): number | null {
    if (!this.topology) return null;
    const vertex = this.topology.vertices.get(vertexId);
    return vertex ? vertex.position.y : null;
  }

  public setVertexElevationsById(changes: Array<{ vertexId: number; y: number }>): void {
    if (!this.topology) return;
    for (const change of changes) {
      const vertex = this.topology.vertices.get(change.vertexId);
      if (vertex) {
        vertex.position.y = change.y;
      }
    }
    this.meshDirty = true;
  }

  public setVertexPositionsById(changes: Array<{ vertexId: number; pos: Vec3 }>): void {
    if (!this.topology) return;
    for (const change of changes) {
      const vertex = this.topology.vertices.get(change.vertexId);
      if (vertex) {
        vertex.position = { ...change.pos };
      }
    }
    this.meshDirty = true;
  }

  public moveVerticesById(vertexIds: number[], delta: Vec3): void {
    if (!this.topology) return;
    for (const vertexId of vertexIds) {
      const vertex = this.topology.vertices.get(vertexId);
      if (vertex) {
        vertex.position.x += delta.x;
        vertex.position.y += delta.y;
        vertex.position.z += delta.z;
      }
    }
    this.meshDirty = true;
  }

  public findNearestVertexId(worldX: number, worldZ: number): number | null {
    if (!this.topology) return null;
    const result = findNearestTopologyVertex(this.topology, worldX, worldZ);
    return result ? result.vertexId : null;
  }

  public getVertexIdsInWorldRadius(worldX: number, worldZ: number, radius: number): number[] {
    if (!this.topology) return [];
    const radiusSq = radius * radius;
    const result: number[] = [];
    for (const [vertexId, vertex] of this.topology.vertices) {
      const dx = vertex.position.x - worldX;
      const dz = vertex.position.z - worldZ;
      if (dx * dx + dz * dz <= radiusSq) {
        result.push(vertexId);
      }
    }
    return result;
  }

  public collapseEdge(edgeId: number): void {
    if (!this.topology) return;

    const result = collapseEdge(this.topology, edgeId);
    if (!result) return;

    this.deselectAllEdges();
    this.rebuildMesh();
  }

  // ============================================
  // Face Mode (Triangle Selection)
  // ============================================

  public setTopologyMode(mode: TopologyMode): void {
    if (this.activeTopologyMode === mode) return;
    this.activeTopologyMode = mode;

    // Handle Edge Mode Logic
    if (mode === 'edge') {
      this.rebuildAllEdgesMeshWithHighlights();
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

    if (mode === 'vertex' || mode === 'face') {
      const color = mode === 'vertex'
        ? new Color4(0.8, 0.8, 0.2, 0.7)
        : new Color4(0.4, 0.7, 0.4, 0.5);
      this.createWireframeMesh(color);
      if (this.wireframeMesh) this.wireframeMesh.setEnabled(true);
    } else if (this.wireframeMesh) {
      this.wireframeMesh.setEnabled(false);
    }
  }

  public setHoveredFace(faceId: number | null): void {
    if (this.hoveredFaceId === faceId) return;
    this.hoveredFaceId = faceId;
    this.rebuildFaceHighlightMesh();
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

  public clearSelectedFaces(): void {
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

      if (pointInTriangle(
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

  public rotateSelectedVertices(angleX: number, angleY: number, angleZ: number): void {
    if (!this.topology) return;

    const uniqueVertexIds = new Set<number>();
    for (const faceId of this.selectedFaceIds) {
      const tri = this.topology.triangles.get(faceId);
      if (!tri) continue;
      for (const vid of tri.vertices) uniqueVertexIds.add(vid);
    }
    for (const edgeId of this.selectedEdgeIds) {
      const edge = this.topology.edges.get(edgeId);
      if (edge) {
        uniqueVertexIds.add(edge.v1);
        uniqueVertexIds.add(edge.v2);
      }
    }

    if (uniqueVertexIds.size === 0) return;

    let cx = 0, cy = 0, cz = 0;
    for (const vid of uniqueVertexIds) {
      const v = this.topology.vertices.get(vid);
      if (v) { cx += v.position.x; cy += v.position.y; cz += v.position.z; }
    }
    const n = uniqueVertexIds.size;
    const pivot = { x: cx / n, y: cy / n, z: cz / n };

    for (const vid of uniqueVertexIds) {
      const vertex = this.topology.vertices.get(vid);
      if (vertex) {
        vertex.position = rotateAroundPivot(vertex.position, pivot, angleX, angleY, angleZ);
      }
    }

    this.meshDirty = true;
  }

  public stampTemplate(
    template: ShapeTemplate,
    centerX: number,
    centerZ: number,
    scale: number = 1
  ): { faceIds: number[]; vertexIds: number[] } {
    if (!this.topology) return { faceIds: [], vertexIds: [] };

    const resolveTerrainCode = (x: number, z: number): number | null => {
      const faceId = this.findFaceAtPosition(x, z);
      if (faceId === null) return null;
      const tri = this.topology!.triangles.get(faceId);
      return tri?.terrainCode ?? null;
    };

    const scaledTemplate: ShapeTemplate = {
      ...template,
      baseRadius: template.baseRadius * scale,
    };
    const getElevation = (x: number, z: number) => this.getInterpolatedElevation(x, z);
    const stamp = generateStampTopology(
      scaledTemplate,
      centerX,
      centerZ,
      getElevation
    );

    const { newFaceIds, newVertexIds } = stampIntoTopology(
      this.topology,
      stamp,
      scaledTemplate,
      centerX,
      centerZ,
      resolveTerrainCode
    );

    this.rebuildFaceSpatialIndex();
    this.updateFaceTerrainVisuals();
    this.topologyDirty = true;
    return { faceIds: newFaceIds, vertexIds: newVertexIds };
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

  private buildFaceIdMapping(): void {
    this.faceIdToTexIndex = new Map();
    if (!this.topology) return;
    let index = 0;
    for (const faceId of this.topology.triangles.keys()) {
      this.faceIdToTexIndex.set(faceId, index++);
    }
  }

  private createTerrainMeshFromTopology(): void {
    if (!this.topology) return;

    this.buildFaceIdMapping();

    const { positions, indices, normals, terrainTypes, faceIds } = buildMeshArrays(
      this.topology,
      HEIGHT_UNIT
    );

    const remappedFaceIds = new Float32Array(faceIds.length);
    for (let i = 0; i < faceIds.length; i++) {
      remappedFaceIds[i] = this.faceIdToTexIndex.get(faceIds[i]) ?? 0;
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;

    if (this.terrainMesh) {
      this.terrainMesh.dispose();
    }

    this.terrainMesh = new Mesh("terrainMesh", this.scene);
    vertexData.applyToMesh(this.terrainMesh, true);

    this.terrainMesh.setVerticesData("terrainType", terrainTypes, false, 1);
    this.terrainMesh.setVerticesData("faceId", remappedFaceIds, false, 1);

    this.terrainMesh.isPickable = true;
    this.terrainMesh.freezeWorldMatrix();
    this.applyMaterial();
  }

  private applyTerrainCodeToFace(faceId: number, terrainCode: number, type: TerrainType): void {
    if (!this.topology) return;
    const tri = this.topology.triangles.get(faceId);
    if (tri) {
      tri.terrainCode = terrainCode;
    }
    const fs = this.faceStates.get(faceId);
    if (fs) {
      const initialValues = getInitialValues(type);
      fs.terrainCode = terrainCode;
      fs.grassHeight = initialValues.height;
      fs.moisture = initialValues.moisture;
      fs.nutrients = initialValues.nutrients;
      fs.health = calculateHealth({
        type, moisture: fs.moisture, nutrients: fs.nutrients, height: fs.grassHeight,
      });
    }
  }

  public setFaceTerrain(faceId: number, type: TerrainType): void {
    this.applyTerrainCodeToFace(faceId, getTerrainCode(type), type);
  }

  public rebuildMesh(): void {
    this.rebuildFaceSpatialIndex();
    this.syncFaceStatesWithTopology();
    this.createTerrainMeshFromTopology();
    if (this.options.enableGridLines) {
      this.createGridLines();
    }
    if (this.wireframeEnabled) {
      this.createWireframeMesh();
    }
    if (this.activeTopologyMode === 'edge') {
      this.rebuildAllEdgesMeshWithHighlights();
    }
    if (this.activeTopologyMode === 'face') {
      this.rebuildFaceHighlightMesh();
    }
    if (this.faceDataTexture) {
      this.createFaceDataTexture();
      if (this.shaderMaterial) {
        this.shaderMaterial.setTexture("faceData", this.faceDataTexture);
        this.shaderMaterial.setVector2("faceDataDims", new Vector2(this.faceDataTexWidth, this.faceDataTexHeight));
      }
    }
    this.meshDirty = false;
    this.topologyDirty = false;
  }

  private updateMeshPositionsOnly(): void {
    if (!this.topology || !this.terrainMesh) return;

    const { positions, normals } = buildMeshArrays(this.topology, HEIGHT_UNIT);

    this.terrainMesh.updateVerticesData("position", positions, false);
    this.terrainMesh.updateVerticesData("normal", normals, false);

    // Keep wireframe in sync with updated vertex positions
    if (this.wireframeMesh) {
      this.createWireframeMesh();
    }
  }

  public updateFaceTerrainVisuals(): void {
    this.syncFaceStatesWithTopology();
    this.updateFaceDataTexture();
  }

  private syncFaceStatesWithTopology(): void {
    if (!this.topology) return;

    const currentFaceIds = new Set(this.topology.triangles.keys());

    for (const faceId of this.faceStates.keys()) {
      if (!currentFaceIds.has(faceId)) {
        this.faceStates.delete(faceId);
      }
    }

    for (const [id, tri] of this.topology.triangles) {
      if (!this.faceStates.has(id)) {
        let inheritedState: FaceState | undefined;
        const centroid = getTriangleCentroid(this.topology, id);
        if (centroid) {
          const nearestFaceId = this.findFaceAtPosition(centroid.x, centroid.z);
          if (nearestFaceId !== null && nearestFaceId !== id) {
            inheritedState = this.faceStates.get(nearestFaceId);
          }
        }

        if (inheritedState) {
          this.faceStates.set(id, { ...inheritedState, faceId: id, terrainCode: tri.terrainCode });
        } else {
          this.faceStates.set(id, createFaceState(id, tri.terrainCode));
        }
      }

      const state = this.faceStates.get(id);
      if (state && state.terrainCode !== tri.terrainCode) {
        state.terrainCode = tri.terrainCode;
      }
    }
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

    if (enabled) {
      if (!this.gridLinesMesh) {
        this.createGridLines();
      } else {
        this.gridLinesMesh.setEnabled(true);
      }
    } else if (this.gridLinesMesh) {
      this.gridLinesMesh.setEnabled(false);
    }
  }

  private getInterpolatedElevation(worldX: number, worldZ: number): number {
    const faceId = this.findFaceAtPosition(worldX, worldZ);
    if (faceId !== null) {
      const tri = this.topology!.triangles.get(faceId);
      if (tri) {
        const v0 = this.topology!.vertices.get(tri.vertices[0]);
        const v1 = this.topology!.vertices.get(tri.vertices[1]);
        const v2 = this.topology!.vertices.get(tri.vertices[2]);
        if (v0 && v1 && v2) {
          return barycentricInterpolateY(worldX, worldZ, v0.position, v1.position, v2.position);
        }
      }
    }
    return 0;
  }

  private static readonly FACE_DATA_TEX_WIDTH = 256;

  private faceDataTexWidth = 0;
  private faceDataTexHeight = 0;

  private buildFaceDataTextureData(): Uint8Array {
    const w = this.faceDataTexWidth;
    const h = this.faceDataTexHeight;
    const data = new Uint8Array(w * h * 4);
    const totalPixels = w * h;
    for (const [faceId, state] of this.faceStates) {
      const texIdx = this.faceIdToTexIndex.get(faceId);
      if (texIdx === undefined || texIdx >= totalPixels) continue;
      const idx = texIdx * 4;
      data[idx + 0] = Math.min(255, Math.max(0, Math.round((state.moisture / 100) * 255)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round((state.nutrients / 100) * 255)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round((state.grassHeight / 100) * 255)));
      data[idx + 3] = Math.min(255, Math.max(0, Math.round((state.health / 100) * 255)));
    }
    return data;
  }

  private createFaceDataTexture(): void {
    const totalPixels = Math.max(1, this.faceIdToTexIndex.size);
    const w = TerrainMeshSystem.FACE_DATA_TEX_WIDTH;
    const h = Math.max(1, Math.ceil(totalPixels / w));

    const sameSize = this.faceDataTexWidth === w && this.faceDataTexHeight === h;
    this.faceDataTexWidth = w;
    this.faceDataTexHeight = h;

    const data = this.buildFaceDataTextureData();

    if (this.faceDataTexture && sameSize) {
      this.faceDataTexture.update(data);
    } else {
      if (this.faceDataTexture) {
        this.faceDataTexture.dispose();
      }
      this.faceDataTexture = RawTexture.CreateRGBATexture(
        data,
        w, h,
        this.scene,
        false, false,
        Engine.TEXTURE_NEAREST_SAMPLINGMODE
      );
      this.faceDataTexture.name = "faceData";
      this.faceDataTexture.wrapU = RawTexture.CLAMP_ADDRESSMODE;
      this.faceDataTexture.wrapV = RawTexture.CLAMP_ADDRESSMODE;
    }
  }

  private updateFaceDataTexture(): void {
    if (!this.faceDataTexture) return;
    this.faceDataTexture.update(this.buildFaceDataTextureData());
  }

  private createShaderMaterial(): void {
    if (!this.faceDataTexture) return;

    this.shaderMaterial = new ShaderMaterial(
      "terrainShader",
      this.scene,
      {
        vertex: "terrain",
        fragment: "terrain",
      },
      {
        attributes: ["position", "normal", "uv", "terrainType", "faceId"],
        uniforms: [
          "world",
          "worldViewProjection",
          "worldSize",
          "time",
          "overlayMode",
          "faceDataDims",
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
        samplers: ["faceData", "overlayImage"],
      }
    );

    this.shaderMaterial.setTexture("faceData", this.faceDataTexture);

    const uniforms = getDefaultUniforms(this.worldWidth, this.worldHeight);
    this.shaderMaterial.setVector2("worldSize", new Vector2(this.worldWidth, this.worldHeight));
    this.shaderMaterial.setFloat("time", 0);
    this.shaderMaterial.setFloat("overlayMode", this.getOverlayModeValue());
    this.shaderMaterial.setVector2("faceDataDims", new Vector2(this.faceDataTexWidth, this.faceDataTexHeight));

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
    for (const [, state] of this.faceStates) {
      const result = simulateFaceGrowth(state, deltaMinutes, weather);
      state.grassHeight = result.grassHeight;
      state.moisture = result.moisture;
      state.nutrients = result.nutrients;
      state.health = result.health;
    }

    this.faceDataUpdateCounter++;
    if (this.faceDataDirty || this.faceDataUpdateCounter >= TerrainMeshSystem.FACE_DATA_UPDATE_INTERVAL) {
      this.updateFaceDataTexture();
      this.faceDataUpdateCounter = 0;
      this.faceDataDirty = false;
    }

    if (this.topologyDirty) {
      this.rebuildMesh();
    } else if (this.meshDirty) {
      this.updateMeshPositionsOnly();
      this.meshDirty = false;
    }
  }

  // ============================================
  // Visual settings
  // ============================================

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

  public setElevationAt(meshX: number, meshY: number, elev: number): void {
    if (!this.topology) return;

    const res = this.options.meshResolution;
    const worldX = meshX / res;
    const worldY = meshY / res;

    if (worldX < 0 || worldX >= this.worldWidth || worldY < 0 || worldY >= this.worldHeight) return;

    const nearest = findNearestTopologyVertex(this.topology, worldX, worldY);
    if (nearest) {
      const v = this.topology.vertices.get(nearest.vertexId);
      if (v) v.position.y = elev;
    }

    this.meshDirty = true;
  }

  public setTerrainTypeAt(worldX: number, worldZ: number, type: TerrainType): void {
    const faceId = this.findFaceAtPosition(worldX, worldZ);
    if (faceId !== null) {
      this.applyTerrainCodeToFace(faceId, getTerrainCode(type), type);
    }
  }

  public getTerrainTypeAt(worldX: number, worldZ: number): TerrainType {
    const faceId = this.findFaceAtPosition(worldX, worldZ);
    if (faceId !== null && this.topology) {
      const tri = this.topology.triangles.get(faceId);
      if (tri) return getTerrainType(tri.terrainCode);
    }

    return getTerrainType(TERRAIN_CODES.ROUGH);
  }

  public paintTerrainType(faceIds: number[], type: TerrainType): void {
    const terrainCode = getTerrainCode(type);
    for (const faceId of faceIds) {
      this.applyTerrainCodeToFace(faceId, terrainCode, type);
    }
    this.topologyDirty = true;
  }

  public getCourseStats(): { health: number; moisture: number; nutrients: number; height: number } {
    return getAverageFaceStats(this.faceStates);
  }

  public getFaceState(faceId: number): FaceState | undefined {
    return this.faceStates.get(faceId);
  }

  public getAllFaceStates(): Map<number, FaceState> {
    return this.faceStates;
  }

  public restoreFaceStates(saved: Map<number, FaceState>): void {
    for (const [id, state] of saved) {
      if (this.faceStates.has(id)) {
        this.faceStates.set(id, { ...state });
      }
    }
  }

  public setFaceState(faceId: number, state: Partial<FaceState>): void {
    const face = this.faceStates.get(faceId);
    if (!face) return;
    Object.assign(face, state);
  }

  public setAllFaceStates(state: Partial<Pick<FaceState, 'moisture' | 'nutrients' | 'grassHeight' | 'health'>>): void {
    for (const [, face] of this.faceStates) {
      if (!isGrassFace(face.terrainCode)) continue;
      if (state.moisture !== undefined) face.moisture = state.moisture;
      if (state.nutrients !== undefined) face.nutrients = state.nutrients;
      if (state.grassHeight !== undefined) face.grassHeight = state.grassHeight;
      if (state.health !== undefined) face.health = state.health;
    }
  }

  public sampleFaceStatesInRadius(
    worldX: number,
    worldZ: number,
    sampleRadius: number
  ): { avgMoisture: number; avgNutrients: number; avgGrassHeight: number; avgHealth: number; dominantTerrainCode: number; faceCount: number } {
    const faces = this.getFacesInBrush(worldX, worldZ, sampleRadius);

    if (faces.length === 0) {
      return { avgMoisture: 0, avgNutrients: 0, avgGrassHeight: 0, avgHealth: 0, dominantTerrainCode: TERRAIN_CODES.WATER, faceCount: 0 };
    }

    let totalMoisture = 0;
    let totalNutrients = 0;
    let totalGrassHeight = 0;
    let totalHealth = 0;
    const terrainCounts = new Map<number, number>();

    for (const faceId of faces) {
      const state = this.faceStates.get(faceId);
      if (!state) continue;

      totalMoisture += state.moisture;
      totalNutrients += state.nutrients;
      totalGrassHeight += state.grassHeight;
      totalHealth += state.health;

      terrainCounts.set(state.terrainCode, (terrainCounts.get(state.terrainCode) || 0) + 1);
    }

    const count = faces.length;
    const dominantTerrainCode = findDominantTerrainCode(terrainCounts);

    return {
      avgMoisture: totalMoisture / count,
      avgNutrients: totalNutrients / count,
      avgGrassHeight: totalGrassHeight / count,
      avgHealth: totalHealth / count,
      dominantTerrainCode,
      faceCount: count,
    };
  }

  public findWorkCandidates(
    centerX: number,
    centerZ: number,
    maxRadius: number,
    cellSize: number = 3
  ): { worldX: number; worldZ: number; avgMoisture: number; avgNutrients: number; avgGrassHeight: number; avgHealth: number; dominantTerrainCode: number; faceCount: number }[] {
    if (!this.topology) return [];

    const groups = new Map<string, {
      totalMoisture: number; totalNutrients: number; totalGrassHeight: number; totalHealth: number;
      terrainCounts: Map<number, number>; count: number; sumX: number; sumZ: number;
    }>();

    for (const [faceId, state] of this.faceStates) {
      const centroid = getTriangleCentroid(this.topology, faceId);
      if (!centroid) continue;

      const cx = centroid.x;
      const cz = centroid.z;

      if (Math.abs(cx - centerX) > maxRadius || Math.abs(cz - centerZ) > maxRadius) continue;

      const bucketX = Math.floor(cx / cellSize);
      const bucketZ = Math.floor(cz / cellSize);
      const cellKey = `${bucketX},${bucketZ}`;
      let group = groups.get(cellKey);
      if (!group) {
        group = { totalMoisture: 0, totalNutrients: 0, totalGrassHeight: 0, totalHealth: 0, terrainCounts: new Map(), count: 0, sumX: 0, sumZ: 0 };
        groups.set(cellKey, group);
      }

      group.totalMoisture += state.moisture;
      group.totalNutrients += state.nutrients;
      group.totalGrassHeight += state.grassHeight;
      group.totalHealth += state.health;
      group.terrainCounts.set(state.terrainCode, (group.terrainCounts.get(state.terrainCode) || 0) + 1);
      group.count++;
      group.sumX += cx;
      group.sumZ += cz;
    }

    const candidates: { worldX: number; worldZ: number; avgMoisture: number; avgNutrients: number; avgGrassHeight: number; avgHealth: number; dominantTerrainCode: number; faceCount: number }[] = [];
    for (const group of groups.values()) {
      const n = group.count;
      const dominantTerrainCode = findDominantTerrainCode(group.terrainCounts);

      candidates.push({
        worldX: group.sumX / n,
        worldZ: group.sumZ / n,
        avgMoisture: group.totalMoisture / n,
        avgNutrients: group.totalNutrients / n,
        avgGrassHeight: group.totalGrassHeight / n,
        avgHealth: group.totalHealth / n,
        dominantTerrainCode,
        faceCount: n,
      });
    }

    return candidates;
  }

  public applyWorkEffect(
    worldX: number,
    worldZ: number,
    equipmentRadius: number,
    jobType: 'mow' | 'water' | 'fertilize' | 'rake',
    efficiency: number,
    gameTime: number
  ): number[] {
    const facesInBrush = this.getFacesInBrush(worldX, worldZ, equipmentRadius);
    const modifiedFaces: number[] = [];

    for (const faceId of facesInBrush) {
      const faceState = this.faceStates.get(faceId);
      if (!faceState) continue;

      let success = false;
      switch (jobType) {
        case 'mow':
          success = applyFaceMowing(faceState);
          if (success) faceState.lastMowed = gameTime;
          break;
        case 'water': {
          const waterAmount = 20 * efficiency;
          success = applyFaceWatering(faceState, waterAmount);
          if (success) faceState.lastWatered = gameTime;
          break;
        }
        case 'fertilize': {
          const fertAmount = 15 * efficiency;
          success = applyFaceFertilizing(faceState, fertAmount, efficiency);
          if (success) faceState.lastFertilized = gameTime;
          break;
        }
        case 'rake':
          if (faceState.terrainCode === TERRAIN_CODES.BUNKER) {
            faceState.health = 100;
            faceState.lastRaked = gameTime;
            success = true;
          }
          break;
      }

      if (success) {
        modifiedFaces.push(faceId);
      }
    }

    if (modifiedFaces.length > 0) {
      this.faceDataDirty = true;
    }

    return modifiedFaces;
  }

  // ============================================
  // Maintenance actions
  // ============================================

  public mowAt(worldX: number, worldY: number): boolean {
    const faceId = this.findFaceAtPosition(worldX, worldY);
    if (faceId === null) return false;

    const face = this.faceStates.get(faceId);
    if (face && applyFaceMowing(face)) {
      face.lastMowed = this.gameTime;
      this.faceDataDirty = true;
      return true;
    }
    return false;
  }

  public rakeAt(worldX: number, worldY: number): boolean {
    const faceId = this.findFaceAtPosition(worldX, worldY);
    if (faceId === null) return false;

    const face = this.faceStates.get(faceId);
    if (face) {
      face.grassHeight = Math.max(0.2, face.grassHeight - 0.1);
      face.lastRaked = this.gameTime;
      this.faceDataDirty = true;
      return true;
    }
    return false;
  }

  public waterArea(centerX: number, centerY: number, radius: number, amount: number): number {
    return this.applyAreaEffect(centerX, centerY, radius,
      (face) => applyFaceWatering(face, amount), 'lastWatered');
  }

  public fertilizeArea(centerX: number, centerY: number, radius: number, amount: number, effectiveness: number = 1.0): number {
    return this.applyAreaEffect(centerX, centerY, radius,
      (face) => applyFaceFertilizing(face, amount, effectiveness), 'lastFertilized');
  }

  private applyAreaEffect(
    centerX: number, centerY: number, radius: number,
    applyFn: (face: FaceState) => boolean,
    timestampField: 'lastWatered' | 'lastFertilized'
  ): number {
    if (radius <= 0) {
      const faceId = this.findFaceAtPosition(centerX, centerY);
      if (faceId === null) return 0;
      const face = this.faceStates.get(faceId);
      if (face && applyFn(face)) {
        face[timestampField] = this.gameTime;
        this.faceDataDirty = true;
        return 1;
      }
      return 0;
    }

    const faceIds = this.getFacesInBrush(centerX, centerY, radius);
    let affectedCount = 0;
    for (const fid of faceIds) {
      const face = this.faceStates.get(fid);
      if (face && applyFn(face)) {
        face[timestampField] = this.gameTime;
        affectedCount++;
      }
    }
    if (affectedCount > 0) this.faceDataDirty = true;
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
      this.updateFaceDataTexture();
    }
  }

  public getUpdateCount(): number {
    return 0;
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

  public isPositionWalkable(worldX: number, worldZ: number): boolean {
    const faceId = this.findFaceAtPosition(worldX, worldZ);
    if (faceId === null) return false;
    if (!this.topology) return false;
    return isFaceWalkableBySlope(this.topology, faceId, HEIGHT_UNIT);
  }

  public getTerrainSpeedAt(worldX: number, worldZ: number): number {
    const faceId = this.findFaceAtPosition(worldX, worldZ);
    if (faceId === null || !this.topology) return 0;
    const tri = this.topology.triangles.get(faceId);
    if (!tri) return 0;
    return getTerrainSpeedModifier(getTerrainType(tri.terrainCode));
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

    if (this.faceDataTexture) {
      this.faceDataTexture.dispose();
      this.faceDataTexture = null;
    }

    if (this.overlayTexture) {
      this.overlayTexture.dispose();
      this.overlayTexture = null;
    }
    if (this.defaultOverlayTexture) {
      this.defaultOverlayTexture.dispose();
      this.defaultOverlayTexture = null;
    }

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

    this.clearAllEdgesMesh();
    this.clearFaceHighlight();
    if (this.faceHighlightMaterial) {
      this.faceHighlightMaterial.dispose();
      this.faceHighlightMaterial = null;
    }
    this.topology = null;
  }

  public setWireframeEnabled(enabled: boolean): void {
    this.wireframeEnabled = enabled;
    if (enabled && !this.wireframeMesh) {
      this.createWireframeMesh();
    }
    if (this.wireframeMesh) {
      const showForMode = this.activeTopologyMode === 'vertex' || this.activeTopologyMode === 'face';
      this.wireframeMesh.setEnabled(enabled || showForMode);
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

  private createWireframeMesh(color?: Color4): void {
    if (this.wireframeMesh) {
      this.wireframeMesh.dispose();
      this.wireframeMesh = null;
    }

    if (!this.topology) return;

    const lineColor = color ?? new Color4(0.8, 0.8, 0.2, 0.7);
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

      colors.push([lineColor, lineColor]);
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
