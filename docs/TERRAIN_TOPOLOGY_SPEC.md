# Terrain Topology Specification

A vertex/edge/face topology system for terrain modeling, inspired by Links 2001 Course Designer and Blender's mesh editing paradigm.

---

## Design Philosophy

**"From cells to vertices, from painting to sculpting."**

Traditional golf games use cell-based grids where terrain types are painted onto rectangular tiles. This system elevates terrain editing to a true 3D mesh topology, enabling:

- **Vertex-level control**: Move individual points in 3D space
- **Edge operations**: Subdivide, flip, or collapse mesh edges
- **Face painting**: Apply terrain types to triangular faces
- **Smooth elevation**: Natural terrain contours via vertex heights
- **Non-destructive editing**: Full undo/redo with topology state capture

This approach mirrors professional 3D tools while remaining intuitive for course design.

---

## Core Data Structures

### Vertices

The fundamental building blocks of the terrain mesh.

```typescript
interface TerrainVertex {
  id: number;                    // Unique identifier
  position: { x: number; y: number; z: number };  // World-space 3D position
  gridUV: { u: number; v: number };  // Normalized grid anchor (see below)
  neighbors: Set<number>;        // Adjacent vertex IDs (via edges)
}
```

**Key Properties:**
- Vertices define mesh shape through their positions
- The `y` component represents elevation (height above ground)
- Neighbor tracking enables efficient adjacency queries

**Understanding `gridUV` (Grid Anchor Coordinates):**

Despite the name, `gridUV` is NOT a texture coordinate. It's a **normalized position anchor** (0-1 range) that remembers where the vertex logically belongs on the original course grid:

```typescript
// Calculated during grid-to-topology conversion:
gridUV: {
  u: (vertexX / meshResolution) / worldWidth,   // 0-1 across course width
  v: (vertexY / meshResolution) / worldHeight,  // 0-1 across course height
}
```

**Why it exists:** When you sculpt terrain (move vertices in 3D), the `position` changes but `gridUV` stays fixed. This allows the system to look up which grid cell a vertex belongs to for:
- Terrain type data (which cell's terrain code applies)
- Cell state lookup (moisture, nutrients, grass height)
- Consistent data mapping after topology edits (subdivide, collapse)

**Key distinction:**
- `position` = where the vertex IS in 3D space (changes during sculpting)
- `gridUV` = where the vertex BELONGS on the logical grid (stable reference)

### Edges

Connections between vertex pairs, referencing adjacent faces.

```typescript
interface TerrainEdge {
  id: number;                    // Unique identifier
  vertices: [number, number];    // The two vertex IDs (always sorted: v1 < v2)
  triangles: number[];           // Adjacent triangle IDs (1 or 2)
}
```

**Key Properties:**
- Edges always store vertices in canonical order to prevent duplicates
- Interior edges have 2 adjacent triangles; boundary edges have 1
- Edge ID is derived from vertex pair: `"${min},${max}"`

### Faces (Triangles)

The visible surface elements that display terrain types.

```typescript
interface TerrainTriangle {
  id: number;                    // Unique identifier
  vertices: [number, number, number];  // Three vertex IDs (counter-clockwise winding)
  edges: [number, number, number];     // Three edge IDs
  terrainCode: TerrainCode;      // Surface type for this face
}
```

**Terrain Codes:**
| Code | Type | Description |
|------|------|-------------|
| 0 | Fairway | Primary playing surface, maintained grass |
| 1 | Rough | Taller grass bordering fairways |
| 2 | Green | Putting surface, finest grass |
| 3 | Bunker | Sand hazard |
| 4 | Water | Water hazard |
| 5 | Tee | Teeing ground |

### Topology Container

The complete mesh topology structure.

```typescript
interface TerrainMeshTopology {
  vertices: Map<number, TerrainVertex>;
  edges: Map<number, TerrainEdge>;
  triangles: Map<number, TerrainTriangle>;

  nextVertexId: number;
  nextEdgeId: number;
  nextTriangleId: number;

  worldWidth: number;
  worldHeight: number;
}
```

---

## Grid-to-Topology Conversion

The initial terrain is generated from a rectangular cell grid.

### Grid Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `courseWidth` | Number of cells horizontally | Varies (e.g., 50) |
| `courseHeight` | Number of cells vertically | Varies (e.g., 55) |
| `meshResolution` | Vertices per cell edge | 2.0 |

**Resulting Dimensions:**
- Vertex grid: `(courseWidth * meshRes + 1) × (courseHeight * meshRes + 1)`
- Example: 50×55 course at 2.0 resolution = 101×111 vertices = 11,211 vertices

### Triangulation Pattern

Each grid cell is subdivided into 2 triangles using a consistent diagonal:

```
   v0 ─────── v1        Cell corners:
    │ ╲     │          v0 = (x, y)
    │   ╲   │          v1 = (x+1, y)
    │     ╲ │          v2 = (x+1, y+1)
   v3 ─────── v2        v3 = (x, y+1)

   Triangle A: v0, v1, v2 (upper-right)
   Triangle B: v0, v2, v3 (lower-left)
```

**Winding Order:** Counter-clockwise when viewed from above (Y-up), ensuring correct normal direction.

---

## Organic Topology

Courses can also use pre-built Delaunay topology from polygon regions, bypassing the grid entirely.

### Topology Sources

| Source | Method | Use Case |
|--------|--------|----------|
| Grid layout | `gridToTopology()` from `CourseData.layout` | Traditional rectangular courses |
| Serialized topology | `CourseData.topology` with `deserializeTopology()` | Organic/free-form courses |

### Organic Topology Pipeline

1. Define `TerrainRegion` polygons (fairway outline, green boundary, etc.)
2. `buildOrganicTopology()` generates Delaunay triangulation from region vertices
3. Each triangle inherits its `terrainCode` from the enclosing region
4. Topology is serialized into `CourseData.topology` for persistence

### Unified Vertex Mapping

After topology creation (either path), all vertices are mapped to grid coordinates for compatibility with grid-based APIs:

```typescript
for (const [id, vertex] of topology.vertices) {
  const vx = Math.round(vertex.position.x * meshResolution);
  const vy = Math.round(vertex.position.z * meshResolution);
  gridToVertexId.set(`${vx},${vy}`, id);
}
```

For organic topology, some grid cells may not have a directly mapped vertex. These cells use barycentric interpolation on the containing triangle face for elevation queries.

### Vertex Position Calculation

```typescript
function gridToWorld(gridX: number, gridY: number, elevation: number): Vector3 {
  return {
    x: gridX * CELL_SIZE,
    y: elevation * HEIGHT_UNIT,
    z: gridY * CELL_SIZE
  };
}
```

**Constants:**
- `CELL_SIZE`: World units per grid cell (typically 1.0)
- `HEIGHT_UNIT`: Elevation scale factor (0.5 default)

---

## Topology Operations

### Edge Subdivision

Splits an edge by inserting a vertex at its midpoint.

**Before:**
```
    A ─────────── B
    ╲    T1    ╱
      ╲      ╱
        ╲  ╱
          C
```

**After:**
```
    A ─── M ─── B
    ╲  T1a ╱T1b╱
      ╲  ╱  ╱
        ╲╱╱
        C
```

**Algorithm:**
1. Create new vertex `M` at edge midpoint
2. For each adjacent triangle (1 or 2):
   - Split into 2 triangles using the new vertex
   - Inherit terrain code from original triangle
3. Remove original edge and triangles
4. Create new edges connecting `M` to existing vertices
5. Return new vertex ID for selection

**Use Cases:**
- Add detail to specific areas
- Create smoother elevation transitions
- Enable finer terrain type boundaries

### Edge Flip

Rotates an edge to the opposite diagonal within its quad.

**Before:**
```
    A ─────── B          Quad ABDC
    │╲   T1  │          Edge: A-D (diagonal)
    │  ╲     │          T1: ABD
    │    ╲   │          T2: ACD
    │ T2   ╲ │
    C ─────── D
```

**After:**
```
    A ─────── B          Quad ABDC
    │      ╱ │          Edge: B-C (flipped diagonal)
    │    ╱   │          T1': ABC
    │  ╱     │          T2': BCD
    │╱   T2' │
    C ─────── D
```

**Algorithm:**
1. Identify the quad formed by the two adjacent triangles
2. Remove the original edge and triangles
3. Create new edge along opposite diagonal
4. Create two new triangles with flipped orientation

**Use Cases:**
- Improve mesh quality (avoid thin triangles)
- Adjust how terrain types flow across cells
- Manual Delaunay optimization

### Edge Collapse

Merges two vertices into one, simplifying the mesh.

**Before:**
```
    A ─── M ─── B        Triangles around edge A-B
     ╲   │   ╱
       ╲ │ ╱
         ╲│╱
          C
```

**After:**
```
    A ───────── B        M removed, A-B connected
      ╲       ╱          Re-triangulated
        ╲   ╱
          C
```

**Algorithm:**
1. Calculate midpoint of the two vertices
2. Remove both vertices and all connected triangles
3. Create new vertex at midpoint
4. Identify the "hole" boundary vertices
5. Re-triangulate using Delaunay algorithm
6. Assign terrain codes from nearest original triangles

**Use Cases:**
- Simplify mesh in flat areas
- Remove unnecessary detail
- Clean up after heavy subdivision

### Vertex Deletion

Removes a vertex and re-triangulates the resulting hole.

**Algorithm:**
1. Collect all triangles containing the vertex
2. Identify the boundary vertices of the hole
3. Remove vertex and connected triangles/edges
4. Triangulate the hole using Delaunay
5. Restore terrain codes from surrounding context

**Constraint:** Cannot delete boundary vertices (would create invalid mesh).

---

## Coordinate Systems

### Grid Space (Cells)

```
Y ↑
  │
  ├─────────────────►
0,0                  X

Range: (0..width) × (0..height)
Units: Cell indices (integers)
Usage: Spatial indexing for face lookup
```

> **Note:** Grid space is used internally for spatial indexing only. World coordinates via topology are the primary coordinate system.

### Vertex Space

```
Y ↑
  │
  ├─────────────────►
0,0                  X

Range: (0..width*meshRes) × (0..height*meshRes)
Units: Vertex indices
Usage: Mesh topology, elevation editing
```

### World Space (3D)

```
Y (up)
│
│    Z (forward)
│   ╱
│  ╱
│ ╱
│╱──────────── X (right)

Units: World units (continuous floats)
Usage: Rendering, physics, asset placement
```

### Coordinate Conversions

| From | To | Conversion |
|------|-----|------------|
| Grid → Vertex | `vx = gx * meshRes`, `vy = gy * meshRes` |
| Vertex → World | Lookup position in topology map |
| World → Vertex | `vx = worldX / CELL_SIZE * meshRes` |
| World → Grid | `gx = floor(worldX / CELL_SIZE)` |

---

## Elevation System

### Per-Vertex Elevation

Elevation is stored directly in each vertex's `position.y` component. This enables:
- **Continuous slopes:** Any angle, not just discrete RCT-style steps
- **Smooth terrain:** Natural contours via vertex interpolation
- **Fine control:** Move individual vertices for precise shaping

```typescript
// Elevation is simply the Y component of position
vertex.position.y = elevationValue * HEIGHT_UNIT;
```

### Elevation During Sculpting

When using sculpt tools (raise, lower, smooth, flatten), the system:
1. Finds all vertices within the brush radius
2. Modifies each vertex's `position.y` based on tool and falloff
3. Recomputes normals for affected triangles
4. Marks mesh as dirty for re-rendering

### Slope Calculation

Slopes are computed from triangle face normals, not discrete classifications:

```typescript
// Per-face normal from vertex positions
function computeFaceNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const edge1 = subtract(v1, v0);
  const edge2 = subtract(v2, v0);
  return normalize(cross(edge1, edge2));
}

// Slope angle from normal
const slopeAngle = Math.acos(normal.y) * (180 / Math.PI);
```

### Elevation Constraints

- **Elevation range:** 0 to configurable maximum (typically 20 units)
- **No discrete steps:** Unlike RCT, any floating-point elevation is valid
- **Mesh resolution:** Higher `meshResolution` = smoother elevation gradients

> **Note:** Legacy code in `terrain.ts` contains RCT-style corner heights and slope classifications (`slope_n`, `saddle_ns`, etc.). This is deprecated and scheduled for removal. See CLAUDE.md migration plan.

---

## Editor Modes

### Selection Modes

| Mode | Selectable Elements | Primary Actions |
|------|---------------------|-----------------|
| `vertex` | Individual vertices | Move in 3D space |
| `edge` | Mesh edges | Subdivide, flip, collapse |
| `face` | Triangles | Paint terrain type |
| `none` | Grid cells | Traditional cell-based editing |

### Sculpting Tools

| Tool | Effect | Parameters |
|------|--------|------------|
| `raise` | Increase vertex elevation | Strength, radius |
| `lower` | Decrease vertex elevation | Strength, radius |
| `smooth` | Blend toward neighborhood average | Strength, radius |
| `flatten` | Set all to single elevation | Target height, radius |
| `level` | Set to average of selection | Radius |

### Brush Parameters

```typescript
interface BrushSettings {
  radius: number;      // Brush size in world units (1-20)
  strength: number;    // Effect intensity per stroke (0.1-1.0)
  falloff: 'linear' | 'smooth' | 'constant';  // Edge blending
}
```

**Falloff Functions:**
- `constant`: Full strength across entire radius
- `linear`: Linearly decreases from center to edge
- `smooth`: Smooth ease-out curve (default)

---

## State Management

### Undo/Redo System

```typescript
interface EditorAction {
  type: 'elevation' | 'paint' | 'position' | 'topology';
  before: TopologySnapshot | CellSnapshot;
  after: TopologySnapshot | CellSnapshot;
  affectedIds: number[];
}
```

**Topology State Capture:**
```typescript
function captureTopologyState(): TopologySnapshot {
  return {
    vertices: deepClone(topology.vertices),
    edges: deepClone(topology.edges),
    triangles: deepClone(topology.triangles),
    nextIds: { vertex, edge, triangle }
  };
}
```

**History Management:**
- Maximum undo stack: 50 actions
- Topology changes capture full mesh state
- Elevation changes capture only affected vertices

---

## Mesh Quality

### Delaunay Triangulation

After topology changes (collapse, delete), the mesh is re-triangulated using Delaunay algorithm:

**Properties:**
- Maximizes minimum angle of triangles
- Avoids thin, degenerate triangles
- Produces "natural" looking terrain subdivisions

**Library:** Uses `delaunator` for efficient triangulation.

### Quality Metrics

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Min angle | > 20° | Avoid needle triangles |
| Max angle | < 140° | Avoid flat triangles |
| Aspect ratio | < 3:1 | Balanced proportions |

---

## Integration Points

### With Terrain Shading System

The topology provides to the shader:
- Vertex positions (for 3D rendering)
- Vertex normals (computed from adjacent faces)
- Terrain codes per face (as vertex attribute)
- Grid UVs (for texture mapping)

### With Face State System

Face states (`FaceState`) are the source of truth for gameplay simulation values:
- Grass height, moisture, nutrients (per triangle face)
- Maintenance timestamps (lastMowed, lastWatered, etc.)
- Health calculations

Face states are queried directly by face ID or via spatial lookup from world coordinates.

### With Course Designer

The designer UI coordinates between:
- Selection state (selected vertices/edges/faces)
- Tool parameters (brush settings)
- Preview rendering (ghost effects)
- Commit/cancel operations

---

## Key Files

| File | Responsibility |
|------|----------------|
| `src/core/mesh-topology.ts` | Data structures and operations |
| `src/core/terrain-editor-logic.ts` | Sculpting algorithms |
| `src/babylon/systems/VectorTerrainSystem.ts` | 3D mesh rendering |
| `src/babylon/systems/TerrainEditorSystem.ts` | Editor coordination |

---

## Design Inspirations

### Links 2001 Course Designer

- Vertex-based elevation control
- Smooth terrain sculpting
- Professional course design workflow

### Blender Mesh Editing

- Vertex/edge/face selection modes
- Subdivision and edge operations
- Non-destructive editing with full undo

### RollerCoaster Tycoon (Historical)

> **Note:** The RCT corner-based slope system and cell-based grid have been fully replaced by topology-first architecture.

- ~~Corner-based slope system~~ → Per-vertex elevation
- ~~Cell-based terrain type grid~~ → Per-face terrain codes with face states
- Clear visual feedback for terrain types

---

## Future Considerations

- **Multi-resolution mesh:** Different detail levels for near/far terrain
- **Bezier patches:** Curved surfaces for greens
- **Terrain stamps:** Save and apply terrain shapes
- **Procedural generation:** Auto-generate rough/bunker placement
- **Import/export:** Standard mesh format support (OBJ, glTF)
