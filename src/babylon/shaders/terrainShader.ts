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
attribute float terrainType;

// Uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vWorldPosition;
varying float vTerrainType;

void main() {
  vec4 worldPos = world * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vPosition = position;
  vNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vUV = uv;
  vTerrainType = terrainType;

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
varying float vTerrainType;

// SDF Textures (Kept for compatibility/overlays, but primary type comes from attribute)
uniform sampler2D healthData;   // R=moisture, G=nutrients, B=height, A=health

// Parameters
uniform vec2 worldSize;
uniform float time;
uniform float edgeBlend;
uniform float overlayMode;

// Terrain colors
uniform vec3 roughColor;
uniform vec3 fairwayColor;
uniform vec3 greenColor;
uniform vec3 bunkerColor;
uniform vec3 waterColor;
uniform vec3 waterDeepColor;
uniform vec3 teeColor;

// Feature toggles
uniform float enableStripes;
uniform float enableNoise;
uniform float enableWaterAnim;

// Constants
const float PI = 3.14159265359;
const float CODE_FAIRWAY = 0.0;
const float CODE_ROUGH = 1.0;
const float CODE_GREEN = 2.0;
const float CODE_BUNKER = 3.0;
const float CODE_WATER = 4.0;
const float CODE_TEE = 5.0;

// ... (noise functions omitted for brevity, assuming they are unchanged - Need to include them if I replace the whole string)
// Actually I need to replace only the relevant parts or the whole string if I can't target specifically.

// Hash function
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  value += amplitude * noise(p);
  amplitude *= 0.5;
  value += amplitude * noise(p * 2.0);
  amplitude *= 0.5;
  value += amplitude * noise(p * 4.0);
  return value;
}

// Procedural detail functions
float mowingStripes(vec2 worldPos, float stripeWidth, float intensity) {
  float stripe = sin(worldPos.y * PI / stripeWidth);
  stripe = smoothstep(-0.3, 0.3, stripe);
  return stripe * intensity;
}

vec3 grassNoise(vec2 worldPos, vec3 baseColor, float intensity) {
  float n = fbm(worldPos * 8.0);
  n = n * 2.0 - 1.0;
  return baseColor + vec3(n * 0.3, n * 1.0, n * 0.2) * intensity;
}

vec3 sandGrain(vec2 worldPos, vec3 baseColor) {
  float grain = noise(worldPos * 50.0) - 0.5;
  float pattern = fbm(worldPos * 5.0) - 0.5;
  return baseColor + vec3(grain * 0.08 + pattern * 0.05);
}

vec3 waterEffect(vec2 worldPos, vec3 waterColor, vec3 deepColor, float distFromShore, float time) {
  vec3 baseWater = waterColor;
  float wave1 = sin(worldPos.x * 3.0 + time * 2.0) * 0.5 + 0.5;
  float wave2 = sin(worldPos.y * 4.0 + time * 1.5 + 1.0) * 0.5 + 0.5;
  float wave = (wave1 + wave2) * 0.5;
  vec3 waterFinal = baseWater + vec3(0.02, 0.03, 0.04) * wave;
  float shimmer = noise(worldPos * 15.0 + time * 2.0);
  waterFinal += vec3(shimmer * 0.02);
  return waterFinal;
}

void main() {
  vec2 sdfUV = vUV; // Kept for overlays

  // Determine masks based on vTerrainType attribute
  // We use a small epsilon for float comparison logic
  float type = floor(vTerrainType + 0.5);

  float fairwayMask = (abs(type - CODE_FAIRWAY) < 0.1) ? 1.0 : 0.0;
  float greenMask = (abs(type - CODE_GREEN) < 0.1) ? 1.0 : 0.0;
  float bunkerMask = (abs(type - CODE_BUNKER) < 0.1) ? 1.0 : 0.0;
  float waterMask = (abs(type - CODE_WATER) < 0.1) ? 1.0 : 0.0;
  float teeMask = (abs(type - CODE_TEE) < 0.1) ? 1.0 : 0.0;
  // Rough is default/background, or code 1
  float roughMask = (abs(type - CODE_ROUGH) < 0.1) ? 1.0 : 0.0;

  // Start with rough as base?
  // If we have explicit rough mask, we can just mix.
  // Actually, let's just pick the color directly.

  vec3 color = roughColor; // Default
  
  if (roughMask > 0.5) {
      color = roughColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz, color, 0.03);
  }
  else if (fairwayMask > 0.5) {
      color = fairwayColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz, color, 0.04);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 1.0, 0.08);
         color = mix(color - vec3(0.04), color + vec3(0.04), stripe);
      }
  }
  else if (greenMask > 0.5) {
      color = greenColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz * 2.0, color, 0.02);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 0.3, 0.04);
         color = mix(color - vec3(0.02), color + vec3(0.02), stripe);
      }
  }
  else if (teeMask > 0.5) {
      color = teeColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz * 1.5, color, 0.03);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 0.5, 0.06);
         color = mix(color - vec3(0.03), color + vec3(0.03), stripe);
      }
  }
  else if (bunkerMask > 0.5) {
      color = bunkerColor;
      color = sandGrain(vWorldPosition.xz, color);
  }
  else if (waterMask > 0.5) {
      color = waterColor;
      if (enableWaterAnim > 0.5) {
         // rough approximate dist logic or just uniform
         float dist = 1.0; 
         color = waterEffect(vWorldPosition.xz, waterColor, waterDeepColor, dist, time);
      }
  }

  // Lighting
  vec3 lightDir = normalize(vec3(-1.0, 2.0, -1.0));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.5;
  float lighting = ambient + diffuse * 0.5;

  color *= lighting;

  // Overlays
  if (overlayMode > 0.5) {
     vec4 healthSample = texture2D(healthData, sdfUV);
     float moisture = healthSample.r;
     float nutrients = healthSample.g;
     float grassHeight = healthSample.b;
     float health = healthSample.a;

     vec3 overlayColor = color;

    if (overlayMode > 0.5 && overlayMode < 1.5) {
      overlayColor = mix(vec3(0.8, 0.4, 0.2), vec3(0.2, 0.4, 0.8), moisture);
    }
    else if (overlayMode > 1.5 && overlayMode < 2.5) {
      overlayColor = mix(vec3(0.6, 0.3, 0.5), vec3(0.2, 0.7, 0.3), nutrients);
    }
    else if (overlayMode > 2.5 && overlayMode < 3.5) {
      overlayColor = mix(vec3(0.3, 0.5, 0.2), vec3(0.7, 0.8, 0.3), grassHeight);
    }
    else if (overlayMode > 3.5) {
      overlayColor = mix(vec3(0.8, 0.2, 0.2), vec3(0.2, 0.8, 0.3), health);
    }
    
    // Mask out non-grass
    float grassRatio = 1.0 - max(waterMask, bunkerMask);
    color = mix(color, overlayColor * lighting, grassRatio * 0.7);
  }

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
  overlayMode: number;  // 0=normal, 1=moisture, 2=nutrients, 3=height, 4=health
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
    overlayMode: 0,
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
