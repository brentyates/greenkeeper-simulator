# Terrain Grid Specification

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
  gridUV: { u: number; v: number };  // Texture mapping coordinates
  neighbors: Set<number>;        // Adjacent vertex IDs (via edges)
}
```

**Key Properties:**
- Vertices define mesh shape through their positions
- The `y` component represents elevation (height above ground)
- Grid UV coordinates enable consistent texture mapping after topology changes
- Neighbor tracking enables efficient adjacency queries

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
Usage: Terrain type painting, cell state, pathfinding
```

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

### Corner Heights (RCT-Inspired)

Each grid cell has four corner heights, enabling slope detection:

```typescript
interface RCTCornerHeights {
  nw: number;  // North-west corner
  ne: number;  // North-east corner
  se: number;  // South-east corner
  sw: number;  // South-west corner
}
```

### Slope Classification

| Slope Type | Description | Corner Pattern |
|------------|-------------|----------------|
| `flat` | All corners equal height | nw = ne = se = sw |
| `slope_n` | Rising to north | ne, nw higher |
| `slope_e` | Rising to east | ne, se higher |
| `slope_s` | Rising to south | se, sw higher |
| `slope_w` | Rising to west | nw, sw higher |
| `slope_ne` | Rising to NE corner | ne highest |
| `slope_se` | Rising to SE corner | se highest |
| `slope_sw` | Rising to SW corner | sw highest |
| `slope_nw` | Rising to NW corner | nw highest |
| `valley_n` | Dip at north | nw, ne lower |
| `valley_e` | Dip at east | ne, se lower |
| `valley_s` | Dip at south | se, sw lower |
| `valley_w` | Dip at west | nw, sw lower |
| `saddle_ns` | N/S corners high | Saddle point |
| `saddle_ew` | E/W corners high | Saddle point |

### Constraints

- **Maximum slope delta:** 2 height units between adjacent corners
- **Elevation range:** 0 to configurable maximum (typically 20)
- **Vertex interpolation:** Smooth elevation across mesh resolution subdivisions

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

### With Cell State System

While topology handles mesh geometry, cell state tracks gameplay values:
- Grass height, moisture, nutrients (per cell)
- Obstacle placement
- Maintenance history

**Resolution mapping:** Multiple mesh faces may fall within one gameplay cell.

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

### RollerCoaster Tycoon

- Corner-based slope system
- Intuitive height adjustment
- Clear visual feedback for terrain types

---

## Future Considerations

- **Multi-resolution mesh:** Different detail levels for near/far terrain
- **Bezier patches:** Curved surfaces for greens
- **Terrain stamps:** Save and apply terrain shapes
- **Procedural generation:** Auto-generate rough/bunker placement
- **Import/export:** Standard mesh format support (OBJ, glTF)
