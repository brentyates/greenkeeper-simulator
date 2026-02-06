# Job Automation & Face-Based State Specification

A topology-driven work system where characters execute jobs on terrain regions with automated movement patterns, decoupling gameplay from the underlying grid.

---

## Design Philosophy

**"Click the fairway, not every cell."**

Instead of micromanaging character movement cell-by-cell, players assign jobs to terrain regions. Characters then autonomously execute the work using movement patterns appropriate to the terrain type and task. This supports the game's progression from hands-on greenkeeper to delegating superintendent.

---

## Architecture Overview

### Current Architecture (Topology-Driven)

```
┌──────────────────────────────────────────────────────┐
│                   PLAYER INPUT                        │
│         (select region/faces, assign job)             │
│         (optional: free walk for inspection)          │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                   JOB SYSTEM                          │
│         Job = { targetFaces[], taskType, worker }     │
│         Generates movement pattern for task           │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│               TERRAIN TOPOLOGY                        │
│         Character position = world coordinates        │
│         Health/moisture/nutrients per FACE            │
│         Movement = pathfinding within region          │
└──────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Jobs

A job represents a maintenance task assigned to a terrain region.

```typescript
interface Job {
  id: string;
  type: JobType;
  targetFaces: number[];           // Triangle IDs from topology
  assignedWorker: string | null;   // Character/employee ID
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;

  // Generated when job starts
  movementPattern?: MovementPattern;
  progress: number;                // 0-1, based on faces completed
  facesCompleted: Set<number>;
}

type JobType =
  | 'mow'           // Cut grass
  | 'water'         // Irrigate area
  | 'fertilize'     // Apply nutrients
  | 'rake'          // Maintain bunker
  | 'repair'        // Fix damaged turf
  | 'aerate'        // Aerate soil
  | 'overseed'      // Plant new grass
  | 'inspect';      // Walk and assess
```

### Movement Patterns

Each job type and terrain combination has an associated movement pattern generator.

```typescript
interface MovementPattern {
  type: PatternType;
  waypoints: Vector3[];            // Ordered points to visit
  currentIndex: number;

  // Pattern-specific parameters
  stripeWidth?: number;            // For linear patterns
  circleRadius?: number;           // For concentric patterns
  spiralTightness?: number;        // For spiral patterns
}

type PatternType =
  | 'linear_stripes'      // Back-and-forth mowing lines
  | 'concentric_circles'  // Bunker raking from edge to center
  | 'diagonal_stripes'    // Green mowing at 45°
  | 'spiral_inward'       // Spiral toward center
  | 'spiral_outward'      // Spiral from center out
  | 'perimeter_first'     // Edge then fill
  | 'random_coverage'     // Touch all faces, no specific order
  | 'shortest_path';      // Optimal route (for inspection)
```

### Pattern Selection by Context

| Terrain Type | Job Type | Default Pattern | Visual Result |
|--------------|----------|-----------------|---------------|
| Fairway | mow | `linear_stripes` | Classic mowing stripes |
| Fairway | water | `perimeter_first` | Even coverage |
| Green | mow | `diagonal_stripes` | Tournament-quality diagonal |
| Green | water | `spiral_outward` | Center-out coverage |
| Bunker | rake | `concentric_circles` | Traditional raked rings |
| Bunker | repair | `random_coverage` | Fill divots anywhere |
| Rough | mow | `linear_stripes` | Wider stripe width |
| Tee | mow | `linear_stripes` | Aligned with tee box |

---

## Face-Based State

### Per-Face State

Health/moisture/nutrients are stored per triangle face.

```typescript
interface FaceState {
  faceId: number;                  // Triangle ID from topology
  terrainCode: TerrainCode;        // Already exists on TerrainTriangle

  // Simulation state
  moisture: number;                // 0-100
  nutrients: number;               // 0-100
  grassHeight: number;             // 0-100 (for grass terrains)
  health: number;                  // Computed from above

  // Maintenance tracking
  lastMowed: number;               // Game timestamp
  lastWatered: number;
  lastFertilized: number;
  lastRaked: number;               // For bunkers

  // Visual state
  needsAttention: boolean;         // Flag for UI highlighting
}
```

### Face State Storage

```typescript
interface TopologyWithState extends TerrainMeshTopology {
  faceStates: Map<number, FaceState>;  // Indexed by triangle ID
}

// Or extend TerrainTriangle directly:
interface TerrainTriangleWithState extends TerrainTriangle {
  state: FaceState;
}
```

### Benefits of Face-Based State

1. **Topology-aligned**: State lives where it's rendered
2. **No gridUV needed**: Faces know their own state directly
3. **Subdivision works**: When a face is subdivided, state can be copied/interpolated
4. **Variable resolution**: High-detail areas (greens) can have more faces = finer state
5. **Natural selection**: Click a visual region, get exactly those faces

---

## Region Selection

### Selecting Work Regions

Players select terrain regions for jobs through various methods:

```typescript
interface RegionSelection {
  faces: number[];                 // Selected triangle IDs
  terrainType: TerrainCode;        // Primary terrain type
  bounds: BoundingBox;             // Axis-aligned bounding box
  area: number;                    // Total surface area
}
```

**Selection Methods:**

1. **Click terrain type region**: Auto-select all connected faces of same terrain type
2. **Paint selection**: Brush to add/remove faces from selection
3. **Marquee selection**: Rectangle drag to select faces within bounds
4. **Named areas**: Pre-defined regions (e.g., "Fairway 7", "Practice Green")

### Connected Region Detection

```typescript
function selectConnectedFaces(
  topology: TerrainMeshTopology,
  startFaceId: number,
  terrainCode: TerrainCode
): number[] {
  const selected: Set<number> = new Set();
  const queue: number[] = [startFaceId];

  while (queue.length > 0) {
    const faceId = queue.shift()!;
    if (selected.has(faceId)) continue;

    const face = topology.triangles.get(faceId);
    if (!face || face.terrainCode !== terrainCode) continue;

    selected.add(faceId);

    // Add adjacent faces via shared edges
    for (const edgeId of face.edges) {
      const edge = topology.edges.get(edgeId);
      if (edge) {
        for (const adjFaceId of edge.triangles) {
          if (!selected.has(adjFaceId)) {
            queue.push(adjFaceId);
          }
        }
      }
    }
  }

  return Array.from(selected);
}
```

---

## Movement Pattern Generation

### Linear Stripes (Mowing)

Generate back-and-forth lines across a region.

```typescript
function generateLinearStripes(
  faces: number[],
  topology: TerrainMeshTopology,
  stripeWidth: number,
  angle: number = 0
): Vector3[] {
  const bounds = computeFacesBounds(faces, topology);
  const waypoints: Vector3[] = [];

  // Rotate bounds by angle for diagonal stripes
  const rotatedBounds = rotateBounds(bounds, angle);

  let direction = 1;  // Alternates for back-and-forth
  for (let y = rotatedBounds.minZ; y <= rotatedBounds.maxZ; y += stripeWidth) {
    if (direction === 1) {
      waypoints.push(new Vector3(rotatedBounds.minX, 0, y));
      waypoints.push(new Vector3(rotatedBounds.maxX, 0, y));
    } else {
      waypoints.push(new Vector3(rotatedBounds.maxX, 0, y));
      waypoints.push(new Vector3(rotatedBounds.minX, 0, y));
    }
    direction *= -1;
  }

  // Rotate waypoints back and project onto terrain
  return waypoints.map(p => {
    const rotated = rotatePoint(p, -angle);
    return projectOntoTerrain(rotated, topology);
  });
}
```

### Concentric Circles (Bunker Raking)

Generate inward spiral from bunker edge to center.

```typescript
function generateConcentricCircles(
  faces: number[],
  topology: TerrainMeshTopology,
  ringSpacing: number
): Vector3[] {
  const centroid = computeFacesCentroid(faces, topology);
  const maxRadius = computeMaxDistanceFromCentroid(faces, topology, centroid);
  const waypoints: Vector3[] = [];

  // Start from outside, work inward
  for (let r = maxRadius; r > 0; r -= ringSpacing) {
    const circlePoints = generateCirclePoints(centroid, r, 16);  // 16 segments
    waypoints.push(...circlePoints);
  }

  // End at center
  waypoints.push(centroid);

  return waypoints.map(p => projectOntoTerrain(p, topology));
}
```

### Spiral Pattern

```typescript
function generateSpiral(
  faces: number[],
  topology: TerrainMeshTopology,
  spacing: number,
  inward: boolean
): Vector3[] {
  const centroid = computeFacesCentroid(faces, topology);
  const maxRadius = computeMaxDistanceFromCentroid(faces, topology, centroid);
  const waypoints: Vector3[] = [];

  const totalRotations = maxRadius / spacing;
  const pointsPerRotation = 32;
  const totalPoints = totalRotations * pointsPerRotation;

  for (let i = 0; i < totalPoints; i++) {
    const t = i / totalPoints;
    const angle = t * totalRotations * Math.PI * 2;
    const radius = inward
      ? maxRadius * (1 - t)
      : maxRadius * t;

    const x = centroid.x + Math.cos(angle) * radius;
    const z = centroid.z + Math.sin(angle) * radius;
    waypoints.push(new Vector3(x, 0, z));
  }

  return waypoints.map(p => projectOntoTerrain(p, topology));
}
```

---

## Job Execution

### Job Lifecycle

```
┌─────────┐     ┌────────────┐     ┌─────────────┐     ┌───────────┐
│ Created │ ──► │  Assigned  │ ──► │ In Progress │ ──► │ Completed │
└─────────┘     └────────────┘     └─────────────┘     └───────────┘
     │                │                   │
     │                │                   │
     ▼                ▼                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Cancelled                                  │
└───────────────────────────────────────────────────────────────────┘
```

### Execution Loop

```typescript
function executeJob(job: Job, worker: Character, deltaTime: number): void {
  if (!job.movementPattern) {
    job.movementPattern = generatePattern(job);
  }

  const pattern = job.movementPattern;
  const targetPoint = pattern.waypoints[pattern.currentIndex];

  // Move toward current waypoint
  const moved = moveToward(worker, targetPoint, worker.speed * deltaTime);

  // Check if reached waypoint
  if (distanceTo(worker.position, targetPoint) < 0.1) {
    // Apply job effect to nearby faces
    const nearbyFaces = getFacesNearPoint(worker.position, job.effectRadius);
    for (const faceId of nearbyFaces) {
      if (job.targetFaces.includes(faceId) && !job.facesCompleted.has(faceId)) {
        applyJobEffect(job.type, faceId);
        job.facesCompleted.add(faceId);
      }
    }

    // Advance to next waypoint
    pattern.currentIndex++;

    // Update progress
    job.progress = job.facesCompleted.size / job.targetFaces.length;

    // Check completion
    if (pattern.currentIndex >= pattern.waypoints.length) {
      job.status = 'completed';
    }
  }
}
```

### Job Effects

```typescript
function applyJobEffect(type: JobType, faceId: number): void {
  const state = getFaceState(faceId);

  switch (type) {
    case 'mow':
      state.grassHeight = getMowHeight(state.terrainCode);
      state.lastMowed = gameTime;
      break;

    case 'water':
      state.moisture = Math.min(100, state.moisture + 30);
      state.lastWatered = gameTime;
      break;

    case 'fertilize':
      state.nutrients = Math.min(100, state.nutrients + 25);
      state.lastFertilized = gameTime;
      break;

    case 'rake':
      state.health = 100;  // Bunkers don't have grass health
      state.lastRaked = gameTime;
      break;
  }

  recalculateHealth(state);
}
```

---

## Free Walk Mode

Players can still directly control characters for:
- Inspection walks
- Manual positioning
- Early game (before employees)
- Emergencies

```typescript
interface MovementMode {
  type: 'job' | 'free' | 'follow_path';

  // For 'job' mode
  activeJob?: Job;

  // For 'free' mode
  inputDirection?: Vector2;        // From WASD/joystick

  // For 'follow_path' mode
  pathWaypoints?: Vector3[];
}
```

**Free walk uses world coordinates**, not grid cells:
- Character position is `Vector3` in world space
- Movement is continuous, not cell-locked
- Collision uses terrain topology, not grid boundaries
- Speed affected by terrain type (rough is slower)

---

## Simulation Updates

### Per-Frame Update (Face-Based)

```typescript
function updateFaceSimulation(deltaMinutes: number): void {
  for (const [faceId, state] of faceStates) {
    // Skip non-grass terrains
    if (state.terrainCode === TerrainCode.Water ||
        state.terrainCode === TerrainCode.Bunker) {
      continue;
    }

    // Grass growth
    const growthRate = getGrowthRate(state.terrainCode, state.moisture, state.nutrients);
    state.grassHeight = Math.min(100, state.grassHeight + growthRate * deltaMinutes);

    // Moisture decay
    state.moisture = Math.max(0, state.moisture - 0.01 * deltaMinutes);

    // Nutrient decay
    state.nutrients = Math.max(0, state.nutrients - 0.005 * deltaMinutes);

    // Recalculate health
    recalculateHealth(state);
  }
}
```

### Health Calculation

```typescript
function recalculateHealth(state: FaceState): void {
  if (state.terrainCode === TerrainCode.Water) {
    state.health = 100;
    return;
  }

  if (state.terrainCode === TerrainCode.Bunker) {
    // Bunker health based on time since raked
    const timeSinceRaked = gameTime - state.lastRaked;
    state.health = Math.max(0, 100 - timeSinceRaked * 0.1);
    return;
  }

  // Grass health formula
  const moistureFactor = state.moisture / 100;
  const nutrientFactor = state.nutrients / 100;
  const heightPenalty = state.grassHeight > 50 ? (state.grassHeight - 50) / 100 : 0;

  state.health = Math.max(0, Math.min(100,
    moistureFactor * 35 +
    nutrientFactor * 35 +
    (1 - heightPenalty) * 30
  ));
}
```

---

## Integration with Existing Systems

### Overlay Visualization

Overlays now sample from face state instead of cell textures:

```glsl
// Shader change: sample from face attribute instead of texture
varying float vMoisture;    // Passed from face state
varying float vNutrients;
varying float vHealth;

// Instead of:
// vec4 healthSample = texture2D(healthData, sdfUV);
```

### Course Statistics

```typescript
function getCourseStats(): CourseStats {
  let totalHealth = 0;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let grassFaceCount = 0;

  for (const [faceId, state] of faceStates) {
    if (isGrassTerrain(state.terrainCode)) {
      totalHealth += state.health;
      totalMoisture += state.moisture;
      totalNutrients += state.nutrients;
      grassFaceCount++;
    }
  }

  return {
    health: totalHealth / grassFaceCount,
    moisture: totalMoisture / grassFaceCount,
    nutrients: totalNutrients / grassFaceCount,
    faceCount: faceStates.size,
  };
}
```

### Pathfinding

For movement between regions (not within a job), use navmesh-style pathfinding on the topology:

```typescript
function findPath(
  start: Vector3,
  end: Vector3,
  topology: TerrainMeshTopology
): Vector3[] {
  const startFace = findContainingFace(start, topology);
  const endFace = findContainingFace(end, topology);

  // A* over face adjacency graph
  const facePath = aStarFaces(startFace, endFace, topology);

  // Convert to waypoints through face centroids
  return facePath.map(faceId => getFaceCentroid(faceId, topology));
}
```

---

## Architecture Notes

Face states are the source of truth. The simulation runs on faces, jobs update face state directly, and overlays read from face attributes.

---

## Game Progression Integration

| Stage | Job System Behavior |
|-------|---------------------|
| **Solo Greenkeeper** | Player executes jobs directly, sees movement pattern |
| **First Employees** | Assign jobs to workers, they auto-execute |
| **Working Manager** | Queue multiple jobs, prioritize |
| **Superintendent** | Assign standing orders ("keep fairways < 20mm") |
| **Resort Director** | Department heads manage job queues |

**Standing Orders** (late game):

```typescript
interface StandingOrder {
  condition: (state: FaceState) => boolean;
  jobType: JobType;
  priority: number;
  assignedDepartment: string;
}

// Example: "Mow any fairway grass over 25mm"
const autoMowFairways: StandingOrder = {
  condition: (s) => s.terrainCode === TerrainCode.Fairway && s.grassHeight > 25,
  jobType: 'mow',
  priority: 5,
  assignedDepartment: 'grounds',
};
```

---

## Key Files (Future)

| File | Responsibility |
|------|----------------|
| `src/core/job-system.ts` | Job creation, assignment, lifecycle |
| `src/core/movement-patterns.ts` | Pattern generators |
| `src/core/face-state.ts` | Face-based simulation state |
| `src/core/region-selection.ts` | Connected face selection |
| `src/babylon/systems/JobVisualization.ts` | Show active jobs, patterns |
