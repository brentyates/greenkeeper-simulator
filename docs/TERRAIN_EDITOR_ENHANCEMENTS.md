# Terrain Editor Enhancements

Design document for two new terrain editor capabilities: **shape stamps** and **group rotation**, building on the existing Delaunay topology pipeline.

---

## 0. Terminology & Architecture Context

### Delaunay Triangulation

The codebase uses the `delaunator` library for Delaunay triangulation — an algorithm that produces triangulations where no point falls inside the circumscribed circle of any triangle, guaranteeing well-shaped triangles.

### Current Naming vs Proper Terminology

| In codebase | Proper term | Impact |
|---|---|---|
| "organic topology" | Delaunay triangulation | "Organic" suggests freeform/procedural, not algorithm-specific |
| "VectorTerrainSystem" | Mesh topology terrain system | "Vector" is vague |
| `gridUV` | Grid anchor / normalized position | Not texture UVs |
| `meshResolution` | Vertex density / grid scale | Not LOD-related |

### Delaunator vs Custom Topology Layer

- **Delaunator provides:** initial triangulation + read-only `halfedges[]` adjacency structure
- **Delaunator does NOT provide:** mutable topology (add/remove triangles, split/flip/collapse edges, delete vertices)
- The custom topology layer (`mesh-topology.ts`) was necessary because the editor requires all mutable operations
- The `halfedges[]` output is discarded after triangulation — edges and neighbors are rebuilt from triangle connectivity in `deserializeTopology()` and `createTriangle()`
- `d3-delaunay` (higher-level Delaunator wrapper) offers `neighbors(i)` and `find(x,y)` but is also immutable
- Edge flipping exists inside Delaunator (`_legalize()`) but only for maintaining the Delaunay condition during construction — not exposed as a public API. The codebase's `flipEdge()` is a user-facing editor operation.

### `gridUV` Is Dead Code

Stored on every `TerrainVertex`, carefully interpolated during edge ops, serialized/deserialized. Fed into the mesh as UV data, passed through the shader as `vUV` varying — but the fragment shader never reads it. The overlay uses `vWorldPosition.xz` instead. The pick result's `getTextureCoordinates()` return is also never consumed.

Full removal chain: `TerrainVertex.gridUV`, `SerializedVertex.gridUV`, `GridUV` type, interpolation in `subdivideEdge`/`collapseEdge`, `buildMeshArrays` UV output, shader `uv` attribute, `vUV` varying.

### Unified Architecture

Both grid-based and Delaunay-based courses converge to the same `TerrainMeshTopology` structure with only one branching point (`initTopology()`). Everything downstream is topology-agnostic.

---

## 1. Current Infrastructure

### Organic Topology Pipeline (`src/core/organic-topology.ts`)

`buildOrganicTopology(options)` — complete polygon-regions-to-Delaunay-mesh converter:
- Takes `TerrainRegion[]` with polygon boundaries, terrain codes, elevation functions
- Seeds boundary points along polygon edges (configurable spacing)
- Seeds interior fill points on a jittered grid (configurable spacing)
- Runs Delaunator for Delaunay triangulation
- Assigns terrain codes per triangle via centroid-in-polygon test
- Assigns elevation per vertex via region elevation functions
- Returns `SerializedTopology` (vertices + triangles)

`pointInPolygon()` — ray-casting test, exported and tested. Already used in production for the 3-hole organic course.

### Shape Primitives (`src/data/courseData.ts`, lines 52-108)

- `makeEllipse(cx, cz, rx, rz, n=24)` — circular/elliptical polygon boundaries
- `makeRect(x1, z1, x2, z2)` — rectangular boundaries
- `makeFairwayPoly(...)` — sinuous curved paths

Currently only used for CourseData definition, not exposed as editor tools.

### Topology Operations (`src/core/mesh-topology.ts`)

- `retriangulateHole(topology, holeVertices)` — fills a boundary loop with Delaunay triangles
- `createTriangle(topology, v0, v1, v2)` — adds triangle with proper edge/neighbor management
- `deleteVertex(topology, vertexId)` — removes vertex and retriangulates the hole
- `subdivideEdge()`, `flipEdge()`, `collapseEdge()` — edge operations
- `findNearestTopologyVertex()` — nearest vertex lookup
- `deserializeTopology()` — reconstructs edges/neighbors from serialized form

### Terrain Editor (`src/babylon/systems/TerrainEditorSystem.ts`)

- Modes: SCULPT / PAINT with BRUSH / SELECT interaction
- Topology modes: Vertex / Edge / Face
- Selection: single + shift-additive for vertices, edges, faces
- Vertex movement: axis-constrained XYZ dragging
- `getSelectedVerticesFromSelection()` — collects vertex IDs from any selection mode
- `getSelectionCentroid()` — centroid of selected vertices

### VectorTerrainSystem (`src/babylon/systems/VectorTerrainSystem.ts`)

- `moveVertices(vertices[], delta)` / `moveSelectedFaces(dx, dy, dz)` — translation transforms
- `findFaceAtPosition()` — spatial index for fast triangle lookup
- `getFacesInBrush()` — faces within radius
- `registerNewTopologyVertex()` — registers new vertices in grid mapping
- `rebuildMesh()` — regenerates Babylon.js mesh from topology
- No rotation or scale transforms currently exist

---

## 2. Shape Stamps

### Concept

Place predefined mesh templates that replace local topology with ideal vertex layouts for specific terrain features (bunkers, greens, mounds).

### Why Ring-Based Templates, Not Polygon Regions

The existing `buildOrganicTopology()` creates natural-looking Delaunay meshes from polygon outlines, but bunker construction needs predictable vertex placement — one clean outer ring (lip), one inner ring (sand edge), and a center point (bowl bottom). Ring-based templates give explicit control over where vertices land, producing cleaner meshes for specific feature types.

### Template Format

- Ring definitions: radius fraction (0-1), point count, elevation offset, terrain code
- Base radius (scalable)
- Fill point spacing for interior
- Example: Circle Bunker = outer lip ring at 1.0 radius + inner edge ring at 0.85 + center point at 0.0

### Topology Generation

- Generate vertices from ring definitions using the `makeEllipse` cos/sin pattern
- Run Delaunator on ring vertices (same library, same pattern as `buildOrganicTopology`)
- Assign terrain codes by which ring zone the triangle centroid falls in

### Mesh Stitching (Key New Logic)

1. Remove existing triangles whose centroids fall within stamp boundary (using `pointInPolygon` + spatial index)
2. Insert template vertices with new IDs
3. Create template triangles via `createTriangle()`
4. Stitch boundary: collect outer template ring vertices + surviving boundary vertices, run `retriangulateHole()` to fill the gap (exact same pattern as `deleteVertex()`)

### Elevation Toggle

- "Apply elevation" checkbox (default: on)
- On: vertex Y = surface elevation + ring elevation offset
- Off: vertex Y = surface elevation (flat, for manual sculpting)

### UI

- New STAMP mode alongside SCULPT / PAINT
- Template picker (button grid)
- Preview wireframe on hover
- Click to place, auto-select stamped faces after placement

---

## 3. Group Rotation

### Concept

Rotate selected vertices around their centroid to create slopes. Primary workflow: stamp a bunker, then rotate it to create a lower entry and higher back lip.

### Rotation Math

- Standard 3D rotation matrices around X/Y/Z axes
- Pivot = centroid of selected vertices (already computed by `getSelectionCentroid()`)
- For each vertex: translate to pivot-relative coords, apply rotation, translate back

### Integration

- New `rotateSelectedVertices(angleX, angleY, angleZ)` on VectorTerrainSystem
- Collects vertices from current selection mode (same pattern as `moveSelectedFaces()`)
- Sets `meshDirty = true`, calls `rebuildMesh()`

### UI

- Rotation controls (X/Y/Z degree inputs + Apply button) in the transform section
- Visible in sculpt + select mode when something is selected
- Phase 2: R+drag gesture using existing axis constraints

---

## 4. Combined Workflow

1. Enter STAMP mode, select template, hover for preview, click to place
2. Stamped faces auto-selected, editor switches to sculpt/select mode
3. Rotation controls appear, adjust tilt for drainage/slope
4. Further sculpt individual vertices if needed

---

## 5. Implementation Phases

| Phase | Scope | Rationale |
|-------|-------|-----------|
| 1 | Rotation | Self-contained, immediately useful on existing geometry |
| 2 | Template core | Template definitions + topology generation + tests |
| 3 | Mesh stitching | `stampTemplate()` with remove/insert/stitch |
| 4 | Stamp UI | Mode, picker, preview, click-to-place |
| 5 | Polish | Drag rotation gesture, more templates, radius scaling |

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/core/transform-ops.ts` | Rotation math (pure functions) |
| `src/core/shape-templates.ts` | Template types + topology generation |
| `src/data/shape-templates.ts` | Built-in template library |

## 7. Modified Files

| File | Changes |
|------|---------|
| `VectorTerrainSystem.ts` | `stampTemplate()`, `rotateSelectedVertices()` |
| `TerrainEditorSystem.ts` | Stamp mode, rotation dispatch, preview |
| `terrain-editor-logic.ts` | `'stamp'` mode, `activeTemplate` state |
| `TerrainEditorUI.ts` | Stamp button, template picker, rotation controls |
| `createTerrainModifier.ts` | Wire new methods |
| `BabylonMain.ts` | Wire new callbacks |

---

## 8. Cleanup Opportunities

### Removable Dead Code: `gridUV`

| Location | What to remove |
|----------|---------------|
| `TerrainVertex.gridUV` | Field on every vertex |
| `SerializedVertex.gridUV` | Serialization field |
| `GridUV` type | Type definition |
| `subdivideEdge()` (line 289-290) | Interpolation logic |
| `collapseEdge()` (line 568-570) | Interpolation logic |
| `buildMeshArrays()` (line 841) | UV output |
| Shader `attribute vec2 uv` / `varying vec2 vUV` | Declared, passed, never consumed |
| `vertexData.uvs` (VectorTerrainSystem line 1271) | Assignment |
| `getTextureCoordinates()` (VectorTerrainSystem line 2258) | Return value never read |

### Terminology Renames

| Current | Suggested | Scope |
|---|---|---|
| `organic-topology.ts` | `delaunay-topology.ts` | File rename |
| `buildOrganicTopology()` | `buildDelaunayTopology()` | Function + callers |
| `OrganicTopologyOptions` | `DelaunayTopologyOptions` | Type + callers |
| `organic-topology.test.ts` | `delaunay-topology.test.ts` | File rename |

### Grid Coordinate API — Future Consideration

The `vx/vy` coordinate API (`getVertexPosition(vx, vy)`, `setVertexElevation(vx, vy, z)`) is still load-bearing in the editor system, but it's a translation layer: every call goes through `gridToVertexId` to topology vertex ID lookup. For organic topologies, `registerNewTopologyVertex()` generates synthetic vx/vy values — a workaround to fit topology vertices into the grid API.

New features (stamps, rotation) should work with topology vertex IDs directly, not grid coordinates. Eventually the grid API could be deprecated in favor of direct topology vertex operations, but that's a larger refactor.
