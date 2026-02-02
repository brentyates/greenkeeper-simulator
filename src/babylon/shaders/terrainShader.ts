/**
 * Terrain Shader - SDF-based smooth terrain rendering
 *
 * Uses signed distance fields for pixel-perfect smooth edges between terrain types.
 * Includes procedural details: grass noise, mowing stripes, water animation.
 */

export const terrainVertexShader = `
precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

// Uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPos = world * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vPosition = position;
  vNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vUV = uv;

  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

export const terrainFragmentShader = `
precision highp float;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vWorldPosition;

// SDF Textures
uniform sampler2D sdfCombined;  // R=fairway, G=green, B=bunker, A=water
uniform sampler2D sdfTee;       // R=tee

// Parameters
uniform vec2 worldSize;         // World dimensions for UV calculation
uniform float time;             // For water animation
uniform float edgeBlend;        // Edge blend width (world units)
uniform float maxSdfDistance;   // Max encoded SDF distance

// Terrain colors
uniform vec3 roughColor;
uniform vec3 fairwayColor;
uniform vec3 greenColor;
uniform vec3 bunkerColor;
uniform vec3 waterColor;
uniform vec3 waterDeepColor;
uniform vec3 teeColor;

// Feature toggles
uniform float enableStripes;    // Mowing stripes on fairway
uniform float enableNoise;      // Grass noise variation
uniform float enableWaterAnim;  // Water animation

// Constants
const float PI = 3.14159265359;

//
// Noise functions for procedural detail
//

// Hash function for pseudo-random values
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  // Smooth interpolation
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian Motion for organic-looking noise
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

//
// SDF helpers
//

// Decode SDF value from texture (0-255 encoded as 0-1)
float decodeSDF(float encoded) {
  return (encoded * 2.0 - 1.0) * maxSdfDistance;
}

// Smooth edge mask from SDF
// Returns 0 outside, 1 inside, smooth transition at edge
float sdfMask(float sdfValue, float blendWidth) {
  return 1.0 - smoothstep(-blendWidth, blendWidth, sdfValue);
}

// Sharp edge mask (no blending)
float sdfMaskSharp(float sdfValue) {
  return sdfValue < 0.0 ? 1.0 : 0.0;
}

//
// Procedural detail functions
//

// Mowing stripes effect
float mowingStripes(vec2 worldPos, float stripeWidth, float intensity) {
  // Horizontal stripes (along X axis)
  float stripe = sin(worldPos.y * PI / stripeWidth);
  // Smooth the stripe edges
  stripe = smoothstep(-0.3, 0.3, stripe);
  return stripe * intensity;
}

// Grass variation noise
vec3 grassNoise(vec2 worldPos, vec3 baseColor, float intensity) {
  // Multi-octave noise for natural variation
  float n = fbm(worldPos * 8.0, 3);
  n = n * 2.0 - 1.0; // Center around 0

  // Apply mostly to green channel for grass
  return baseColor + vec3(n * 0.3, n * 1.0, n * 0.2) * intensity;
}

// Bunker sand grain
vec3 sandGrain(vec2 worldPos, vec3 baseColor) {
  // High frequency noise for individual grains
  float grain = noise(worldPos * 50.0) - 0.5;
  // Lower frequency for larger patterns
  float pattern = fbm(worldPos * 5.0, 2) - 0.5;

  return baseColor + vec3(grain * 0.08 + pattern * 0.05);
}

// Water animation
vec3 waterEffect(vec2 worldPos, vec3 shallowColor, vec3 deepColor, float distFromShore, float time) {
  // Depth-based color
  float depthFactor = smoothstep(0.0, 3.0, -distFromShore);
  vec3 baseWater = mix(shallowColor, deepColor, depthFactor);

  // Animated waves
  float wave1 = sin(worldPos.x * 3.0 + time * 2.0) * 0.5 + 0.5;
  float wave2 = sin(worldPos.y * 4.0 + time * 1.5 + 1.0) * 0.5 + 0.5;
  float wave = (wave1 + wave2) * 0.5;

  // Caustics pattern (simplified)
  float caustic = noise(worldPos * 8.0 + time * 0.5);
  caustic = pow(caustic, 3.0) * 0.3;

  // Combine effects
  vec3 waterFinal = baseWater;
  waterFinal += vec3(0.05, 0.08, 0.1) * wave * 0.5;
  waterFinal += vec3(0.1, 0.15, 0.2) * caustic;

  // Subtle shimmer
  float shimmer = noise(worldPos * 20.0 + time * 3.0);
  waterFinal += vec3(shimmer * 0.03);

  return waterFinal;
}

//
// Main shader
//

void main() {
  // Calculate UV for SDF sampling based on world position
  vec2 sdfUV = vWorldPosition.xz / worldSize;

  // Clamp UVs to valid range
  sdfUV = clamp(sdfUV, 0.0, 1.0);

  // Sample SDF textures
  vec4 sdfCombinedSample = texture2D(sdfCombined, sdfUV);
  vec4 sdfTeeSample = texture2D(sdfTee, sdfUV);

  // Decode SDF values
  float fairwayDist = decodeSDF(sdfCombinedSample.r);
  float greenDist = decodeSDF(sdfCombinedSample.g);
  float bunkerDist = decodeSDF(sdfCombinedSample.b);
  float waterDist = decodeSDF(sdfCombinedSample.a);
  float teeDist = decodeSDF(sdfTeeSample.r);

  // Calculate masks with smooth edges
  float fairwayMask = sdfMask(fairwayDist, edgeBlend);
  float greenMask = sdfMask(greenDist, edgeBlend);
  float bunkerMask = sdfMask(bunkerDist, edgeBlend * 0.5); // Sharper bunker edges
  float waterMask = sdfMask(waterDist, edgeBlend * 1.5);   // Softer water edges
  float teeMask = sdfMask(teeDist, edgeBlend);

  // Start with rough as base
  vec3 color = roughColor;

  // Apply grass noise to base if enabled
  if (enableNoise > 0.5) {
    color = grassNoise(vWorldPosition.xz, color, 0.03);
  }

  // Layer terrain types (order matters - later types overlay earlier)
  // Fairway
  vec3 fairwayFinal = fairwayColor;
  if (enableNoise > 0.5) {
    fairwayFinal = grassNoise(vWorldPosition.xz, fairwayFinal, 0.04);
  }
  if (enableStripes > 0.5) {
    float stripe = mowingStripes(vWorldPosition.xz, 1.0, 0.08);
    fairwayFinal = mix(fairwayFinal - vec3(0.04), fairwayFinal + vec3(0.04), stripe);
  }
  color = mix(color, fairwayFinal, fairwayMask);

  // Tee box
  vec3 teeFinal = teeColor;
  if (enableNoise > 0.5) {
    teeFinal = grassNoise(vWorldPosition.xz * 1.5, teeFinal, 0.03);
  }
  if (enableStripes > 0.5) {
    float stripe = mowingStripes(vWorldPosition.xz, 0.5, 0.06);
    teeFinal = mix(teeFinal - vec3(0.03), teeFinal + vec3(0.03), stripe);
  }
  color = mix(color, teeFinal, teeMask);

  // Green (tightest mowing)
  vec3 greenFinal = greenColor;
  if (enableNoise > 0.5) {
    greenFinal = grassNoise(vWorldPosition.xz * 2.0, greenFinal, 0.02);
  }
  if (enableStripes > 0.5) {
    float stripe = mowingStripes(vWorldPosition.xz, 0.3, 0.04);
    greenFinal = mix(greenFinal - vec3(0.02), greenFinal + vec3(0.02), stripe);
  }
  color = mix(color, greenFinal, greenMask);

  // Bunker (sand texture)
  vec3 bunkerFinal = bunkerColor;
  bunkerFinal = sandGrain(vWorldPosition.xz, bunkerFinal);
  color = mix(color, bunkerFinal, bunkerMask);

  // Water (with animation)
  vec3 waterFinal = waterColor;
  if (enableWaterAnim > 0.5) {
    waterFinal = waterEffect(vWorldPosition.xz, waterColor, waterDeepColor, waterDist, time);
  }
  color = mix(color, waterFinal, waterMask);

  // Simple lighting
  vec3 lightDir = normalize(vec3(-1.0, 2.0, -1.0));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.4;
  float lighting = ambient + diffuse * 0.6;

  color *= lighting;

  // Subtle elevation-based shading
  float elevationShade = 1.0 - vWorldPosition.y * 0.02;
  color *= clamp(elevationShade, 0.9, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Default terrain colors (can be customized)
 */
export const defaultTerrainColors = {
  rough: { r: 0.35, g: 0.55, b: 0.25 },
  fairway: { r: 0.4, g: 0.7, b: 0.3 },
  green: { r: 0.3, g: 0.8, b: 0.35 },
  bunker: { r: 0.85, g: 0.75, b: 0.5 },
  water: { r: 0.2, g: 0.4, b: 0.65 },
  waterDeep: { r: 0.1, g: 0.25, b: 0.45 },
  tee: { r: 0.35, g: 0.65, b: 0.3 },
};

/**
 * Shader uniform configuration helper
 */
export interface TerrainShaderUniforms {
  worldSize: [number, number];
  time: number;
  edgeBlend: number;
  maxSdfDistance: number;
  roughColor: [number, number, number];
  fairwayColor: [number, number, number];
  greenColor: [number, number, number];
  bunkerColor: [number, number, number];
  waterColor: [number, number, number];
  waterDeepColor: [number, number, number];
  teeColor: [number, number, number];
  enableStripes: number;
  enableNoise: number;
  enableWaterAnim: number;
}

export function getDefaultUniforms(
  worldWidth: number,
  worldHeight: number
): TerrainShaderUniforms {
  return {
    worldSize: [worldWidth, worldHeight],
    time: 0,
    edgeBlend: 0.3,
    maxSdfDistance: 5,
    roughColor: [defaultTerrainColors.rough.r, defaultTerrainColors.rough.g, defaultTerrainColors.rough.b],
    fairwayColor: [defaultTerrainColors.fairway.r, defaultTerrainColors.fairway.g, defaultTerrainColors.fairway.b],
    greenColor: [defaultTerrainColors.green.r, defaultTerrainColors.green.g, defaultTerrainColors.green.b],
    bunkerColor: [defaultTerrainColors.bunker.r, defaultTerrainColors.bunker.g, defaultTerrainColors.bunker.b],
    waterColor: [defaultTerrainColors.water.r, defaultTerrainColors.water.g, defaultTerrainColors.water.b],
    waterDeepColor: [defaultTerrainColors.waterDeep.r, defaultTerrainColors.waterDeep.g, defaultTerrainColors.waterDeep.b],
    teeColor: [defaultTerrainColors.tee.r, defaultTerrainColors.tee.g, defaultTerrainColors.tee.b],
    enableStripes: 1,
    enableNoise: 1,
    enableWaterAnim: 1,
  };
}
