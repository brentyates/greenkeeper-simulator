# Constrained Delaunay Triangulation (CDT) Migration Plan

## Motivation

The current organic terrain system uses unconstrained Delaunay triangulation via
`Delaunator`. Region boundaries are approximated by sampling points along polygon
edges, but the triangulator is free to connect those points however it likes. The
result is that triangle edges rarely align with actual terrain boundaries, forcing
a cascade of workarounds:

- Centroid-based `pointInPolygon()` terrain classification (wrong for straddling triangles)
- Overlapping region definitions in course data (3 ellipses per green instead of 1)
- An entire SDF texture pipeline (`SDFGenerator.ts`) to visually smooth boundary artifacts
- Reverse-order region priority as an implicit, undocumented convention
- Floating-point-fragile ray casting with no epsilon tolerance
- Ghost triangle cleanup (`sanitizeTopology()`) after topology edits
- Synthetic grid coordinates (`vx >= 100000`) for organic vertices
- Three separate terrain assignment code paths (grid lookup, `pointInPolygon`, grid fallback)

CDT eliminates these problems by guaranteeing that specified edges appear in the
triangulation output. Every triangle is fully inside one terrain region by
construction.

---

## Library Selection

### Recommended: `cdt2d`

- **npm:** `cdt2d` (MIT license, ~4KB minified)
- **API:** `cdt2d(points, edges, options)` returns triangle index array
- **Features:** Constrained edges, optional interior point removal, Steiner point insertion
- **Why:** Minimal API surface, proven in production, handles non-convex polygons and holes,
  returns flat triangle array compatible with our existing `SerializedTopology` format.
  Works well as a drop-in replacement since our pipeline already converts point arrays
  to triangle arrays.

### Alternatives considered

| Library | Pros | Cons |
|---------|------|------|
| `poly2tri` | Well-known, Steiner points | Brittle with collinear/duplicate points, unmaintained |
| `earcut` | Fastest polygon triangulation | Not Delaunay, no constrained interior edges |
| `d3-delaunay` | Good API, Voronoi dual built-in | No edge constraints |
| `robust-cdt` | Robust predicates | Newer, smaller ecosystem |

### Decision

Use `cdt2d` with `robust-predicates` for numerical stability. If `cdt2d` proves
too limited for quality refinement (minimum angle constraints), consider wrapping
it with post-processing Steiner point insertion or switching to `robust-cdt`.

---

## Phases

### Phase 1: Core CDT Builder (replace `delaunay-topology.ts`)

**Goal:** Replace `buildDelaunayTopology()` with a CDT-based equivalent that produces
the same `SerializedTopology` output, but with triangle edges aligned to region
boundaries.

**Files modified:**
- `src/core/delaunay-topology.ts` (rewrite)
- `package.json` (add `cdt2d`, remove `delaunator` if no longer used elsewhere)

**Steps:**

1. **Install `cdt2d` and `robust-predicates`**
   ```bash
   npm install cdt2d robust-predicates
   ```

2. **Rewrite `buildDelaunayTopology()`** with this algorithm:

   a. **Collect all region boundary vertices** as indexed points, preserving polygon
      winding order. Deduplicate points that are shared between adjacent regions
      (within epsilon tolerance, e.g., 1e-6).

   b. **Build constraint edge list.** For each region boundary polygon with N vertices,
      emit edges `[i, i+1]` for `i = 0..N-2` and `[N-1, 0]` to close the polygon.
      These are the edges CDT must preserve.

   c. **Add world border points and edges.** Sample the rectangle `(0,0)-(worldWidth,worldHeight)`
      at `boundaryPointSpacing` intervals. Add constraint edges along the border.

   d. **Add interior fill points** (same jittered grid as today) but skip cells that
      already contain a boundary point. These are unconstrained and let the
      triangulator fill the interior with well-shaped triangles.

   e. **Call `cdt2d(points, constraintEdges, { exterior: false })`** to produce the
      triangulation. The `exterior: false` option keeps all triangles including
      those outside constrained regions.

   f. **Assign terrain codes deterministically.** For each triangle, test which
      constrained region contains it. Because edges follow boundaries exactly,
      a single centroid test is now correct (no triangle can straddle a boundary).
      Simplify `findContainingRegion()` to a single-pass region test without
      reverse-order priority.

   g. **Assign elevations** per vertex using the existing `elevationFn` / `elevation`
      lookup (unchanged from current code).

   h. **Output `SerializedTopology`** in the same format. Downstream code sees no
      change.

3. **Simplify `TerrainRegion` interface.** Remove the need for overlapping regions.
   Each terrain feature is a single polygon:
   ```typescript
   interface TerrainRegion {
     terrainCode: number;
     boundary: Array<{ x: number; z: number }>;  // single closed polygon
     holes?: Array<Array<{ x: number; z: number }>>;  // optional holes
     elevation?: number;
     elevationFn?: (x: number, z: number) => number;
   }
   ```

4. **Delete `pointInPolygon()` export** from `delaunay-topology.ts` once no other
   file imports it (verify with grep). If still used elsewhere, keep but mark as
   `@deprecated`.

5. **Update types:** Add `@types/cdt2d` or write a minimal `.d.ts` shim if no
   DefinitelyTyped package exists.

**Validation:**
- Unit test: Build the 3-hole course topology and verify every triangle's centroid
  is inside its assigned region boundary (this test would *fail* on the current code
  for boundary triangles, confirming the fix).
- Unit test: Verify every constraint edge appears in the output triangulation.
- Unit test: Verify no triangle has vertices from two different regions' boundaries
  (the straddling check).
- Visual test: Render with current shader and confirm terrain boundaries are crisp.

---

### Phase 2: Simplify Course Definitions

**Goal:** Remove overlapping region workarounds from course data now that CDT
guarantees correct boundary classification.

**Files modified:**
- `src/data/courseData.ts`

**Steps:**

1. **Consolidate green regions.** Replace the 3-ellipse-per-green pattern with a
   single merged polygon per green. For example, Hole 1's green currently uses:
   ```typescript
   // BEFORE: 3 overlapping ellipses to cover boundary triangles
   regions.push({ terrainCode: G, boundary: makeEllipse(24, 38, 9.6, 7.2), ... });
   regions.push({ terrainCode: G, boundary: makeEllipse(29.2, 36.8, 4.4, 4.4), ... });
   regions.push({ terrainCode: G, boundary: makeEllipse(19.6, 41, 4.2, 4.2), ... });
   ```
   Replace with a single union polygon:
   ```typescript
   // AFTER: single kidney-shaped polygon
   regions.push({ terrainCode: G, boundary: makeKidneyGreen(24, 38, ...), ... });
   ```

2. **Write `mergeEllipses()` or `makeKidneyGreen()` helper** that produces a single
   closed polygon from the union of overlapping ellipses. This can be a build-time
   utility or a simple hand-authored polygon.

3. **Remove reverse-order dependency.** Regions can now be defined in any order.
   Add a comment documenting that region order does not affect terrain assignment.

4. **Remove the dummy grid layout** from `COURSE_3_HOLE`. Currently:
   ```typescript
   layout: Array.from({ length: 110 }, () => new Array(100).fill(R)),
   ```
   This all-rough grid exists only as a fallback. With CDT topology carrying correct
   terrain codes, the grid layout is unused for organic courses. Replace with an
   empty array or remove the field (requires making `layout` optional in
   `CourseData`).

**Validation:**
- Visual diff: Render before/after screenshots and confirm green/bunker shapes are
  preserved or improved.
- Gameplay test: Verify ball lies detect correct terrain at region boundaries.

---

### Phase 3: SDF Pipeline Simplification

**Goal:** Evaluate whether `SDFGenerator.ts` can be removed or reduced to purely
aesthetic soft blending.

**Files modified:**
- `src/babylon/systems/SDFGenerator.ts` (simplify or remove)
- `src/babylon/systems/TerrainMeshSystem.ts` (remove SDF dependency if possible)
- `src/babylon/shaders/terrainShader.ts` (simplify blending logic)

**Steps:**

1. **Add a feature flag** (`useLegacySDF: boolean`) to `TerrainMeshSystem` options
   so both paths can be tested side-by-side.

2. **Test rendering without SDF.** Disable SDF texture generation and shader
   sampling. With CDT boundaries, per-vertex terrain codes should produce clean
   edges without SDF smoothing. Evaluate visual quality:
   - If acceptable: proceed to remove SDF pipeline entirely.
   - If terrain transitions look too sharp at triangle edges: keep SDF but generate
     it from **topology boundaries** instead of the grid layout, eliminating the
     disconnected data source problem.

3. **If keeping SDF for soft blending,** rewrite `generateSDFFromGrid()` to
   `generateSDFFromTopology()`:
   - Walk constrained edges between regions of different terrain types.
   - Compute signed distance from each texel to the nearest constrained boundary
     edge (line segment distance, not grid cell distance).
   - This produces smooth, accurate distance fields that exactly match the mesh
     geometry.

4. **If removing SDF entirely:**
   - Delete `SDFGenerator.ts`.
   - Remove SDF texture uniforms from `terrainShader.ts`.
   - Remove `generateSDFTextures()` and `updateSDFFromGrid()` calls from
     `TerrainMeshSystem.ts`.
   - Remove `SDFTextureSet` import and storage.

**Validation:**
- Visual test: Confirm terrain transitions look good at various zoom levels.
- Performance test: Measure build time with and without SDF generation. SDF
  generation is O(texWidth * texHeight * searchRadius^2), so removal is a
  meaningful perf win for large courses.

---

### Phase 4: Topology Edit Operations

**Goal:** Make `retriangulateHole()`, `subdivideEdge()`, `flipEdge()`, and
`collapseEdge()` CDT-aware so edits near terrain boundaries remain correct.

**Files modified:**
- `src/core/mesh-topology.ts`

**Steps:**

1. **Store constrained edge metadata in topology.** Add a `constrained: boolean`
   flag to `TerrainEdge`:
   ```typescript
   interface TerrainEdge {
     id: number;
     v1: number;
     v2: number;
     triangles: number[];
     constrained: boolean;  // NEW: true for terrain boundary edges
   }
   ```
   Set this flag during CDT construction for every edge that was in the constraint
   list.

2. **Prevent flipping constrained edges.** In `flipEdge()` (mesh-topology.ts),
   add an early return if the edge is constrained:
   ```typescript
   if (edge.constrained) {
     return { success: false, reason: 'Cannot flip constrained boundary edge' };
   }
   ```
   This replaces the current convexity check as the primary guard (keep convexity
   check as a secondary safeguard).

3. **Prevent collapsing across constrained edges.** In `collapseEdge()`, if
   collapsing would remove a constrained edge, either:
   - Refuse the operation, or
   - Slide the surviving vertex along the constraint line instead of to the midpoint.

4. **Constrained retriangulation.** Replace `retriangulateHole()` to use `cdt2d`
   instead of `Delaunator`:
   ```typescript
   // Collect boundary edges of the hole
   const constraintEdges = boundaryEdges
     .filter(e => e.constrained)
     .map(e => [vertexIndexMap.get(e.v1), vertexIndexMap.get(e.v2)]);

   const triangles = cdt2d(coords, constraintEdges);
   ```
   This ensures that retriangulation after vertex deletion preserves terrain
   boundaries.

5. **Edge subdivision on constrained edges.** When subdividing a constrained edge,
   mark both resulting half-edges as constrained. The new midpoint vertex inherits
   the constraint — it lies on the terrain boundary.

6. **Remove `sanitizeTopology()`** once the above changes eliminate ghost triangle
   references. If defensive checks are still desired, convert to `assert`-style
   validation that throws in dev mode.

7. **Serialize the constrained flag.** Update `SerializedTopology` to include edge
   data (currently only stores vertices and triangles). Add:
   ```typescript
   interface SerializedEdge {
     id: number;
     v1: number;
     v2: number;
     constrained: boolean;
   }
   ```
   Update `serializeTopology()` / `deserializeTopology()` accordingly.

**Validation:**
- Unit test: Subdivide a constrained edge and verify both halves are constrained.
- Unit test: Attempt to flip a constrained edge and verify it's rejected.
- Unit test: Delete a vertex adjacent to a constrained edge and verify the boundary
  is preserved in the retriangulated hole.
- Unit test: Collapse a non-constrained edge near a boundary and verify terrain
  codes remain correct.

---

### Phase 5: Unify Terrain Assignment

**Goal:** Collapse the three terrain assignment code paths into one.

**Files modified:**
- `src/babylon/systems/TerrainMeshSystem.ts`
- `src/core/mesh-topology.ts`

**Steps:**

1. **Remove `initializeTriangleTerrainsFromGrid()`.** For grid-based courses, have
   `gridToTopology()` set terrain codes on triangles directly during construction
   (it already knows the grid cell for each triangle). Remove the separate
   post-processing pass.

2. **Remove grid layout fallback for organic courses.** The check at
   `TerrainMeshSystem.ts:210-212` currently skips terrain initialization for courses
   with topology. Verify that the CDT topology's terrain codes are used directly
   and no grid fallback is needed.

3. **Single terrain assignment path:**
   - Grid courses: `gridToTopology()` assigns terrain codes from grid cells.
   - Organic courses: `buildCDTTopology()` assigns terrain codes from constrained
     regions.
   - Both produce `TerrainMeshTopology` with correct `terrainCode` per triangle.
   - `TerrainMeshSystem.initTopology()` just deserializes and indexes — no terrain
     reassignment.

4. **Remove synthetic vertex coordinates.** With terrain codes coming from topology
   (not grid lookups), the synthetic `vx >= 100000` system is no longer needed for
   terrain queries. Evaluate whether it's still needed for elevation queries or the
   vertex position API; if so, document that it's an elevation-only concern.

5. **Make `CourseData.layout` optional** for organic courses:
   ```typescript
   interface CourseData {
     name: string;
     width: number;
     height: number;
     par: number;
     layout?: number[][];     // required for grid courses, absent for organic
     topology?: SerializedTopology;  // required for organic courses
     // ...
   }
   ```

**Validation:**
- Unit test: Load each course type (grid, organic) and verify all triangles have
  correct terrain codes.
- Unit test: Confirm no triangle has `terrainCode` of ROUGH when its centroid is
  inside a green/fairway/bunker region.
- Regression test: Run full gameplay simulation for 100 ticks and verify face states
  match expected terrain behaviors.

---

### Phase 6: Quality Refinement (Optional)

**Goal:** Improve triangle quality near boundaries using Steiner point insertion.

**Files modified:**
- `src/core/delaunay-topology.ts`

**Steps:**

1. **Post-CDT quality pass.** After `cdt2d` produces the initial triangulation,
   iterate over triangles and check quality metrics:
   - Minimum angle (target: > 20 degrees)
   - Maximum aspect ratio (target: < 5:1)
   - Maximum edge length (target: < 2x `fillPointSpacing`)

2. **Insert Steiner points** at circumcenters of poor-quality triangles. Re-run
   `cdt2d` with the original constraints plus the new Steiner points.

3. **Repeat** until quality targets are met or a maximum iteration count is reached
   (typically 2-3 passes suffice).

4. **Alternative: Ruppert's algorithm.** If manual Steiner insertion is insufficient,
   implement Ruppert's refinement algorithm, which guarantees minimum angles of
   ~20.7 degrees. Libraries like `cdt2d` don't include this, so it would be custom
   code (~100-150 lines).

**Validation:**
- Metric test: Assert no triangle has minimum angle below threshold.
- Performance test: Measure triangle count increase from refinement (expect 10-20%
  more triangles; should be acceptable for course sizes of 100x110).

---

## Migration Order and Risk

| Phase | Risk | Rollback | Depends on |
|-------|------|----------|------------|
| 1. Core CDT builder | Medium (new dependency, algorithm change) | Revert `delaunay-topology.ts` | None |
| 2. Simplify course data | Low (data-only change) | Revert `courseData.ts` | Phase 1 |
| 3. SDF simplification | Medium (visual change) | Feature flag | Phase 1 |
| 4. Topology edit operations | High (affects editor) | Feature flag per operation | Phase 1 |
| 5. Unify terrain assignment | Medium (removes fallbacks) | Keep old paths behind flag | Phase 1 |
| 6. Quality refinement | Low (additive) | Skip entirely | Phase 1 |

Phases 2, 3, 4, and 5 are independent of each other and can be done in any order
after Phase 1. Phase 6 is optional and can be added at any time.

## Files Affected Summary

| File | Phase | Change |
|------|-------|--------|
| `package.json` | 1 | Add `cdt2d`, `robust-predicates` |
| `src/core/delaunay-topology.ts` | 1 | Rewrite to use CDT |
| `src/core/mesh-topology.ts` | 1, 4 | Add `constrained` flag, update edit ops |
| `src/data/courseData.ts` | 2 | Simplify region definitions |
| `src/babylon/systems/SDFGenerator.ts` | 3 | Simplify or remove |
| `src/babylon/systems/TerrainMeshSystem.ts` | 3, 5 | Remove SDF dep, unify terrain paths |
| `src/babylon/shaders/terrainShader.ts` | 3 | Simplify blending (if removing SDF) |

## Things CDT Does Not Solve

For completeness, these are issues in the current system that CDT does not address:

- **Grid-based course limitations.** Grid courses will still use `gridToTopology()`
  with axis-aligned cells. CDT only applies to organic (polygon-region) courses.
- **3D elevation conflicts.** CDT operates in 2D (XZ plane). Elevation assignment
  is a separate concern. Vertices shared between regions with different elevation
  functions will still need a priority rule.
- **Performance of large courses.** CDT is slightly slower than unconstrained
  Delaunay for the same point count (~2x). For 100x110 courses with ~300 points,
  this is negligible. For much larger courses, profile before optimizing.
- **Curved boundaries.** CDT constraints are line segments. Curved regions (ellipses,
  splines) are still approximated by polylines sampled at `boundaryPointSpacing`.
  The approximation is now exact at the mesh level (edges follow the polyline
  exactly), but the polyline is still an approximation of the curve. Increase
  `boundaryPointSpacing` density for smoother curves.
