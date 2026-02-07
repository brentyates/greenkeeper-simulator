# Constrained Delaunay Triangulation (CDT) Migration Plan

## Current State (as of grid removal + SDF removal)

The codebase is now topology-native end to end:
- Editor logic uses vertex IDs and topology references directly
- `TerrainSystemInterface` uses world coordinates and face IDs only
- Grid compatibility layer, SDF pipeline, GrassSystem, CellState, and cliff faces are all removed
- `TerrainMeshSystem.ts` is 2,082 lines, down from ~2,879

The remaining problem CDT addresses: **organic course boundary accuracy**. The
unconstrained Delaunay in `delaunay-topology.ts` (172 lines) samples boundary
points along region polygons, but triangle edges don't follow those boundaries.
Terrain codes are assigned by centroid-based `pointInPolygon()`, which misclassifies
triangles that straddle boundaries. With SDF removed, there is no visual smoothing
to hide this — misclassified boundary triangles are directly visible.

Remaining workarounds caused by unconstrained Delaunay:
- Centroid-based `pointInPolygon()` terrain classification (wrong for straddling triangles)
- Overlapping region definitions in course data (3 ellipses per green instead of 1)
- Reverse-order region priority as an implicit, undocumented convention
- Floating-point-fragile ray casting with no epsilon tolerance
- `sanitizeTopology()` call in `rebuildMesh()` (line 1072 of TerrainMeshSystem.ts)

---

## Library Selection

### Recommended: `cdt2d`

- **npm:** `cdt2d` (MIT license, ~4KB minified)
- **API:** `cdt2d(points, edges, options)` returns triangle index array
- **Features:** Constrained edges, optional interior point removal
- **Why:** Minimal API surface, proven in production, returns flat triangle array
  compatible with our existing `SerializedTopology` format. Drop-in replacement
  since our pipeline already converts point arrays to triangle arrays.

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

### Input Sensitivity

CDT libraries are fussy about degenerate input. A preprocessing step is required:
- Deduplicate near-coincident points (within epsilon ~1e-6)
- Validate no constraint edges intersect (overlapping region polygons must be
  merged into single non-overlapping polygons before calling CDT)
- Handle collinear points along constraint edges

This is ~50-80 lines of preprocessing code.

---

## Phases

### Phase 1: Core CDT Builder (replace `delaunay-topology.ts`)

**Goal:** Replace `buildDelaunayTopology()` with a CDT-based equivalent that produces
the same `SerializedTopology` output, but with triangle edges aligned to region
boundaries.

**Files modified:**
- `src/core/delaunay-topology.ts` (rewrite)
- `package.json` (add `cdt2d`, potentially remove `delaunator` — check if
  `mesh-topology.ts:retriangulateHole()` still uses it)

**Steps:**

1. **Install `cdt2d` and `robust-predicates`**
   ```bash
   npm install cdt2d robust-predicates
   ```

2. **Add input preprocessing.** Write a `deduplicatePoints()` function that snaps
   near-coincident vertices and validates no constraint edges cross. This runs
   before `cdt2d` to prevent crashes from degenerate input.

3. **Rewrite `buildDelaunayTopology()`** with this algorithm:

   a. **Collect all region boundary vertices** as indexed points, preserving polygon
      winding order. Run deduplication on shared boundary points.

   b. **Build constraint edge list.** For each region boundary polygon with N vertices,
      emit edges `[i, i+1]` for `i = 0..N-2` and `[N-1, 0]` to close the polygon.
      These are the edges CDT must preserve.

   c. **Add world border points and edges.** Sample the rectangle
      `(0,0)-(worldWidth,worldHeight)` at `boundaryPointSpacing` intervals.
      Add constraint edges along the border.

   d. **Add interior fill points** (same jittered grid as today) but skip cells that
      already contain a boundary point. These are unconstrained and let the
      triangulator fill the interior with well-shaped triangles.

   e. **Call `cdt2d(points, constraintEdges, { exterior: false })`** to produce the
      triangulation.

   f. **Assign terrain codes deterministically.** For each triangle, test which
      constrained region contains it. Because edges follow boundaries exactly,
      a single centroid test is now correct (no triangle can straddle a boundary).
      Simplify `findContainingRegion()` to a single-pass region test without
      reverse-order priority.

   g. **Assign elevations** per vertex using the existing `elevationFn` / `elevation`
      lookup (unchanged from current code).

   h. **Output `SerializedTopology`** in the same format. Downstream code
      (`TerrainMeshSystem.initTopology()` → `deserializeTopology()`) sees no change.

4. **Delete `pointInPolygon()` export** if no other file imports it. If still used
   by stamp system or elsewhere, keep but mark as `@deprecated`.

5. **Write a minimal `.d.ts` shim** for `cdt2d` if no DefinitelyTyped types exist.

**Validation:**
- Unit test: Build the 3-hole course topology and verify every triangle's centroid
  is inside its assigned region boundary (this test would *fail* on the current code
  for boundary triangles, confirming the fix).
- Unit test: Verify every constraint edge appears in the output triangulation.
- Unit test: Verify no triangle has vertices from two different regions' boundaries
  (the straddling check).
- Visual test: Render and confirm terrain boundaries are crisp without SDF.

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
   Important: the merged polygon must be non-self-intersecting for CDT. Overlapping
   ellipses need to be unioned into a single closed polygon.

2. **Write `mergeEllipses()` or `makeKidneyGreen()` helper** that produces a single
   closed polygon from the union of overlapping ellipses. This can be a build-time
   utility or a simple hand-authored polygon.

3. **Remove reverse-order dependency.** Regions can now be defined in any order.
   Add a comment documenting that region order does not affect terrain assignment.

4. **Remove the dummy grid layout** from `COURSE_3_HOLE` if still present.

**Validation:**
- Visual diff: Render before/after and confirm green/bunker shapes match or improve.
- Gameplay test: Verify face states detect correct terrain at region boundaries.

---

### Phase 3: Topology Edit Operations

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

2. **Prevent flipping constrained edges.** In `flipEdge()`, add an early return
   if the edge is constrained. Keep convexity check as secondary safeguard.

3. **Prevent collapsing across constrained edges.** In `collapseEdge()`, if
   collapsing would remove a constrained edge, either refuse the operation or
   slide the surviving vertex along the constraint line.

4. **Constrained retriangulation.** Replace `retriangulateHole()` to use `cdt2d`
   instead of `Delaunator`, passing constrained boundary edges so terrain
   boundaries are preserved through vertex deletion.

5. **Edge subdivision on constrained edges.** When subdividing a constrained edge,
   mark both resulting half-edges as constrained.

6. **Evaluate removing `sanitizeTopology()`** (called at TerrainMeshSystem.ts:1072)
   once the above changes eliminate ghost triangle references. If defensive checks
   are still desired, convert to `assert`-style validation that throws in dev mode.

7. **Serialize the constrained flag.** Update `SerializedTopology` to include edge
   data (currently only stores vertices and triangles):
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

### Phase 4: Quality Refinement (Optional)

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
   ~20.7 degrees. `cdt2d` doesn't include this, so it would be custom code
   (~100-150 lines).

**Validation:**
- Metric test: Assert no triangle has minimum angle below threshold.
- Performance test: Measure triangle count increase from refinement (expect 10-20%
  more triangles; should be acceptable for course sizes of 100x110).

---

## Migration Order and Risk

| Phase | Risk | Rollback | Depends on |
|-------|------|----------|------------|
| 1. Core CDT builder | Medium (new dependency, input sensitivity) | Revert `delaunay-topology.ts` | None |
| 2. Simplify course data | Low (data-only change) | Revert `courseData.ts` | Phase 1 |
| 3. Topology edit operations | High (affects editor) | Feature flag per operation | Phase 1 |
| 4. Quality refinement | Low (additive) | Skip entirely | Phase 1 |

Phases 2 and 3 are independent of each other and can be done in any order after
Phase 1. Phase 4 is optional.

## Files Affected Summary

| File | Phase | Change |
|------|-------|--------|
| `package.json` | 1 | Add `cdt2d`, `robust-predicates` |
| `src/core/delaunay-topology.ts` | 1 | Rewrite to use CDT |
| `src/core/mesh-topology.ts` | 3 | Add `constrained` flag, update edit ops, evaluate removing `sanitizeTopology()` |
| `src/data/courseData.ts` | 2 | Simplify region definitions, remove overlapping ellipses |

## Things CDT Does Not Solve

- **`sanitizeTopology()` may still be needed.** Ghost triangle references come from
  topology edit operations, not from CDT itself. Phase 3 addresses this but it's the
  highest-risk phase.
- **3D elevation conflicts.** CDT operates in 2D (XZ plane). Vertices shared between
  regions with different elevation functions still need a priority rule.
- **Performance of large courses.** CDT is ~2-5x slower than unconstrained Delaunay.
  For 100x110 courses with ~300 points this is negligible.
- **Curved boundaries.** CDT constraints are line segments. Ellipses and splines are
  still polyline approximations sampled at `boundaryPointSpacing`. CDT makes the
  mesh edges follow the polyline exactly, but the polyline is still an approximation
  of the curve.
- **`Delaunator` may still be needed.** `retriangulateHole()` in `mesh-topology.ts`
  uses `Delaunator` for hole filling. Phase 3 replaces this with `cdt2d`, but until
  then both dependencies coexist.
