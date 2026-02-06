# Terrain Shading Specification

A multi-layer rendering system for golf course terrain visualization, combining procedural textures, SDF-based edge blending, and dynamic overlays.

---

## Design Philosophy

**"Realism through procedural detail, clarity through visual hierarchy."**

Golf courses have distinct visual characteristics:
- Precisely maintained grass with visible mowing patterns
- Sharp transitions between terrain types (fairway edges, bunker lips)
- Subtle variations that convey health and moisture
- Dynamic elements (water shimmer, grass movement)

This system renders terrain using procedural shaders enhanced by signed distance field (SDF) textures for pixel-perfect edge blending.

---

## Rendering Architecture

### Multi-Layer Approach

```
┌─────────────────────────────────────────────────┐
│  Layer 4: Overlay (moisture/nutrients/height)   │  Debug/gameplay
├─────────────────────────────────────────────────┤
│  Layer 3: Procedural Detail (noise, patterns)   │  Visual richness
├─────────────────────────────────────────────────┤
│  Layer 2: SDF Edge Blending                     │  Smooth boundaries
├─────────────────────────────────────────────────┤
│  Layer 1: Base Terrain Colors                   │  Per-type coloring
├─────────────────────────────────────────────────┤
│  Layer 0: Mesh Geometry                         │  Vertex positions
└─────────────────────────────────────────────────┘
```

### Shader Pipeline

**Vertex Shader:**
1. Transform vertex position to world space
2. Compute vertex normal from adjacent faces
3. Pass terrain type, UV coordinates, world position to fragment

**Fragment Shader:**
1. Sample base color from terrain type
2. Apply SDF-based edge blending
3. Add procedural detail (noise, patterns)
4. Compute lighting (ambient + diffuse)
5. Apply optional overlay visualization

---

## Base Terrain Colors

### Color Palette

| Terrain Type | Base Color (RGB) | Hex | Description |
|--------------|------------------|-----|-------------|
| Fairway | (0.30, 0.65, 0.25) | #4DA640 | Vibrant maintained green |
| Rough | (0.35, 0.55, 0.20) | #598C33 | Deeper, less saturated green |
| Green | (0.25, 0.70, 0.30) | #40B34D | Bright, pristine putting surface |
| Bunker | (0.85, 0.78, 0.55) | #D9C78C | Warm sand tone |
| Water | (0.20, 0.45, 0.70) | #3373B3 | Deep blue with transparency |
| Tee | (0.28, 0.62, 0.28) | #479E47 | Similar to fairway, slightly brighter |

### Color Variation

Base colors are modulated by:
- **Health factor:** Unhealthy grass shifts toward brown (0.4, 0.35, 0.15)
- **Moisture factor:** Dry areas shift toward yellow-brown
- **Elevation shading:** Higher areas slightly lighter

```glsl
vec3 healthModulate(vec3 baseColor, float health) {
    vec3 brownTint = vec3(0.4, 0.35, 0.15);
    return mix(brownTint, baseColor, health);
}
```

---

## SDF-Based Edge Blending

### Signed Distance Field Generation

SDF textures encode per-pixel distance to terrain boundaries:

```
Positive values: Inside the terrain type
Negative values: Outside the terrain type
Zero: Exactly on the boundary
```

**Channel Encoding:**
| Channel | Terrain Type |
|---------|--------------|
| R | Fairway distance |
| G | Green distance |
| B | Bunker distance |
| A | Water distance |

### Generation Algorithm

```typescript
function generateSDF(terrainGrid: TerrainType[][], resolution: number): ImageData {
  for (each pixel at (px, py)) {
    const worldPos = pixelToWorld(px, py);

    for (each terrain type) {
      const dist = findNearestBoundaryDistance(worldPos, terrainType);
      setChannel(pixel, terrainType.channel, dist);
    }
  }
}
```

**Distance Calculation:**
- Iterates through all terrain boundaries
- Computes signed distance (positive inside, negative outside)
- Normalizes to texture range (0-255 maps to distance units)

### Blending Function

```glsl
float sdfBlend(float dist, float edgeWidth) {
    return smoothstep(-edgeWidth, edgeWidth, dist);
}

// Usage: Blend between rough and fairway
vec3 color = mix(roughColor, fairwayColor, sdfBlend(fairwayDist, 0.5));
```

**Edge Width Parameter:**
- Smaller values: Sharper transitions
- Larger values: Softer, more natural blending
- Recommended: 0.3-0.8 world units

### SDF Resolution

| Setting | Value | Description |
|---------|-------|-------------|
| Default | 8 px/unit | Good balance of quality and performance |
| High | 16 px/unit | Sharper edges, larger texture |
| Low | 4 px/unit | Performance mode, softer edges |

---

## Procedural Detail

### Grass Noise

Multi-octave fractal noise creates natural grass variation.

```glsl
float grassNoise(vec2 uv, float scale, int octaves) {
    float noise = 0.0;
    float amplitude = 1.0;
    float frequency = scale;

    for (int i = 0; i < octaves; i++) {
        noise += amplitude * snoise(uv * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return noise * 0.5 + 0.5;  // Normalize to 0-1
}
```

**Parameters by Terrain Type:**
| Terrain | Scale | Octaves | Intensity |
|---------|-------|---------|-----------|
| Fairway | 20.0 | 3 | 0.08 |
| Rough | 15.0 | 4 | 0.15 |
| Green | 40.0 | 2 | 0.04 |
| Tee | 25.0 | 3 | 0.06 |

### Mowing Stripes

Classic alternating light/dark bands on maintained grass.

```glsl
float mowingStripes(vec2 worldPos, float stripeWidth, float angle) {
    // Rotate coordinates to stripe direction
    vec2 rotated = rotate2D(worldPos, angle);

    // Create alternating bands
    float stripe = sin(rotated.x * PI / stripeWidth);

    // Subtle effect: ±5% brightness variation
    return 1.0 + stripe * 0.05;
}
```

**Stripe Parameters:**
| Terrain | Width | Angle | Notes |
|---------|-------|-------|-------|
| Fairway | 3.0 units | Varies by hole | Parallel to play direction |
| Green | 2.0 units | Perpendicular to slope | Classic putting green look |
| Tee | 2.5 units | Aligned to tee box | Subtle effect |

**Stripe Direction Logic:**
- Fairways: Follow hole centerline
- Greens: Perpendicular to primary slope
- Tees: Aligned with tee box orientation
- Can be customized per area in course designer

### Sand Grain (Bunkers)

```glsl
float sandGrain(vec2 uv, float time) {
    // Base sand texture from noise
    float grain = snoise(uv * 50.0) * 0.5 + 0.5;

    // Add larger variation for raked patterns
    float rakes = sin(uv.x * 8.0 + snoise(uv * 5.0) * 2.0);

    // Combine for final texture
    return grain * 0.7 + rakes * 0.15 + 0.15;
}
```

### Water Effects

```glsl
vec3 waterSurface(vec2 uv, float time) {
    // Animated wave pattern
    float wave1 = sin(uv.x * 10.0 + time * 2.0);
    float wave2 = sin(uv.y * 8.0 + time * 1.5);
    float waves = (wave1 + wave2) * 0.5;

    // Shimmer effect
    float shimmer = snoise(uv * 30.0 + time) * 0.1;

    // Depth variation (darker toward center)
    float depth = smoothstep(0.0, 5.0, sdfDist);

    vec3 shallowColor = vec3(0.3, 0.55, 0.75);
    vec3 deepColor = vec3(0.15, 0.35, 0.55);

    vec3 color = mix(shallowColor, deepColor, depth);
    color += waves * 0.05 + shimmer;

    return color;
}
```

---

## Lighting Model

### Simple Directional Light

```glsl
uniform vec3 lightDirection = normalize(vec3(-1.0, 2.0, -1.0));
uniform vec3 lightColor = vec3(1.0, 0.98, 0.95);  // Slight warm tint
uniform float ambientStrength = 0.4;
```

### Lighting Calculation

```glsl
vec3 applyLighting(vec3 baseColor, vec3 normal) {
    // Ambient component
    vec3 ambient = ambientStrength * lightColor;

    // Diffuse component
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * lightColor;

    // Combine
    return baseColor * (ambient + diffuse * 0.6);
}
```

### Normal Calculation

Normals are computed per-vertex from adjacent triangle faces:

```typescript
function computeVertexNormal(vertexId: number, topology: TerrainMeshTopology): Vector3 {
  const adjacentTriangles = getAdjacentTriangles(vertexId);

  let normalSum = Vector3.Zero();
  for (const tri of adjacentTriangles) {
    const faceNormal = computeFaceNormal(tri);
    normalSum = normalSum.add(faceNormal);
  }

  return normalSum.normalize();
}
```

---

## Overlay Visualization

### Overlay Modes

| Mode | Channel | Color Mapping | Use Case |
|------|---------|---------------|----------|
| 0 | None | Normal rendering | Gameplay |
| 1 | Moisture | Blue (high) → Red (low) | Irrigation planning |
| 2 | Nutrients | Green (high) → Yellow (low) | Fertilization |
| 3 | Grass Height | Dark (short) → Light (tall) | Mowing schedule |
| 4 | Health | Green (healthy) → Red (unhealthy) | Problem diagnosis |

### Overlay Blending

```glsl
uniform int overlayMode;
uniform sampler2D overlayData;  // Cell state data texture

vec3 applyOverlay(vec3 baseColor, vec2 cellUV) {
    if (overlayMode == 0) return baseColor;

    float value = texture(overlayData, cellUV)[overlayMode - 1];

    vec3 overlayColor;
    if (overlayMode == 1) {  // Moisture
        overlayColor = mix(vec3(1.0, 0.2, 0.1), vec3(0.2, 0.4, 1.0), value);
    } else if (overlayMode == 2) {  // Nutrients
        overlayColor = mix(vec3(1.0, 0.9, 0.2), vec3(0.2, 0.8, 0.3), value);
    }
    // ... etc

    return mix(baseColor, overlayColor, 0.6);
}
```

---

## Texture Atlases

### Terrain Detail Textures (Future Enhancement)

For additional realism, detail textures can be blended:

| Texture | Resolution | Tiling | Purpose |
|---------|------------|--------|---------|
| Grass blade | 256×256 | 0.5/unit | Individual grass detail |
| Sand grain | 256×256 | 1.0/unit | Bunker surface |
| Water caustics | 512×512 | 2.0/unit | Underwater light patterns |

### Texture Sampling

```glsl
vec3 sampleDetailTexture(sampler2D tex, vec2 worldPos, float tileScale) {
    vec2 uv = worldPos * tileScale;
    return texture(tex, uv).rgb;
}

// Tri-planar mapping for steep slopes
vec3 triplanarSample(sampler2D tex, vec3 worldPos, vec3 normal) {
    vec3 blend = abs(normal);
    blend = normalize(max(blend, 0.00001));

    vec3 xSample = texture(tex, worldPos.yz).rgb;
    vec3 ySample = texture(tex, worldPos.xz).rgb;
    vec3 zSample = texture(tex, worldPos.xy).rgb;

    return xSample * blend.x + ySample * blend.y + zSample * blend.z;
}
```

---

## Performance Considerations

### Shader Complexity Budget

| Feature | Cost | Enabled By Default |
|---------|------|-------------------|
| Base terrain colors | Low | Yes |
| SDF edge blending | Medium | Yes |
| Grass noise (3 octaves) | Medium | Yes |
| Mowing stripes | Low | Yes |
| Water animation | Medium | Yes |
| Overlay modes | Low | When active |
| Detail textures | High | Quality setting |

### Level of Detail (LOD)

| Distance | Features Enabled |
|----------|-----------------|
| Near (< 20 units) | All features |
| Medium (20-50 units) | No detail textures |
| Far (50-100 units) | Reduced noise octaves |
| Distant (> 100 units) | Base colors only |

### Optimization Techniques

1. **SDF Texture Caching:** Generate once, update only on terrain changes
2. **Overlay Data Texture:** Pack cell state into single RGBA texture
3. **Shader Branching:** Use uniform flags to skip unused features
4. **Instanced Rendering:** For repeated elements (trees, shrubs)

---

## Shader Implementation

### Vertex Shader

```glsl
// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float terrainType;

// Uniforms
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float heightUnit;

// Varyings
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;
varying float vTerrainType;

void main() {
    vec4 worldPos = world * vec4(position, 1.0);
    worldPos.y *= heightUnit;

    gl_Position = worldViewProjection * worldPos;

    vWorldPos = worldPos.xyz;
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);
    vUV = uv;
    vTerrainType = terrainType;
}
```

### Fragment Shader Structure

```glsl
// Uniforms
uniform sampler2D sdfTexture;
uniform sampler2D overlayTexture;
uniform float time;
uniform int overlayMode;
uniform vec3 lightDirection;

// Varyings
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;
varying float vTerrainType;

// Include procedural functions
#include "noise.glsl"
#include "terrain_colors.glsl"
#include "terrain_effects.glsl"

void main() {
    // 1. Get base color for terrain type
    vec3 baseColor = getTerrainColor(int(vTerrainType + 0.5));

    // 2. Apply SDF edge blending
    vec4 sdfValues = texture2D(sdfTexture, vUV);
    baseColor = applySdfBlending(baseColor, sdfValues, vTerrainType);

    // 3. Apply procedural detail
    baseColor = applyProceduralDetail(baseColor, vWorldPos, vTerrainType, time);

    // 4. Apply lighting
    baseColor = applyLighting(baseColor, vNormal);

    // 5. Apply overlay if active
    if (overlayMode > 0) {
        baseColor = applyOverlay(baseColor, vUV, overlayMode);
    }

    gl_FragColor = vec4(baseColor, 1.0);
}
```

---

## Visual Reference

### Terrain Type Visual Characteristics

**Fairway:**
- Bright, saturated green
- Visible mowing stripes (alternating 3-unit bands)
- Subtle grass texture noise
- Cleanly defined edges against rough

**Rough:**
- Deeper, less saturated green
- More pronounced texture variation
- Slightly darker overall
- Gradual transition at edges (wider SDF blend)

**Green:**
- Brightest, most pristine green
- Fine, subtle mowing stripes
- Minimal texture noise (smooth appearance)
- Very sharp edges (narrow SDF blend)

**Bunker:**
- Warm sand color with grain texture
- Visible rake patterns (subtle waves)
- Sharp lip edges against grass
- Slight depth variation (darker in center)

**Water:**
- Deep blue with subtle transparency
- Animated wave patterns
- Shimmer highlights
- Sharp shoreline with foam effect (future)

**Tee:**
- Similar to fairway but slightly more manicured
- Aligned stripe pattern with tee box
- Well-defined rectangular boundaries

---

## Integration Points

### With Terrain Topology

The shading system receives from topology:
- Vertex positions and normals
- Per-face terrain codes
- UV coordinates for texture mapping

### With Cell State System

The shading system receives:
- Moisture, nutrients, grass height values
- Health calculations
- Used for color modulation and overlay display

### With Course Designer

The designer provides:
- Mowing stripe direction overrides
- Custom terrain color adjustments (future)
- Preview rendering for edits

---

## Key Files

| File | Responsibility |
|------|----------------|
| `src/babylon/shaders/terrainShader.ts` | GLSL vertex/fragment shaders |
| `src/babylon/systems/SDFGenerator.ts` | SDF texture generation |
| `src/babylon/systems/VectorTerrainSystem.ts` | Material setup and uniforms |
| `src/core/terrain.ts` | Terrain color constants |

---

## Constants Reference

```typescript
// Shader Constants
const HEIGHT_UNIT = 0.5;           // Elevation scale
const SDF_RESOLUTION = 8;          // Pixels per world unit
const SDF_EDGE_WIDTH = 0.5;        // Default blend width

// Noise Parameters
const FAIRWAY_NOISE_SCALE = 20.0;
const ROUGH_NOISE_SCALE = 15.0;
const GREEN_NOISE_SCALE = 40.0;

// Stripe Parameters
const FAIRWAY_STRIPE_WIDTH = 3.0;
const GREEN_STRIPE_WIDTH = 2.0;

// Lighting
const AMBIENT_STRENGTH = 0.4;
const DIFFUSE_STRENGTH = 0.6;
```

---

## Future Enhancements

- **Seasonal variations:** Color shifts for spring/summer/fall
- **Weather effects:** Wet grass sheen, frost texture
- **Time-of-day lighting:** Sunrise/sunset color temperatures
- **Subsurface scattering:** More realistic grass light transmission
- **Grass blade geometry:** Instanced grass blades for close-up views
- **Dynamic shadows:** From trees, buildings, and clouds
- **Reflection probes:** Water reflections of surrounding environment
