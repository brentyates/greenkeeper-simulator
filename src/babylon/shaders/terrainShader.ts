/**
 * Terrain Shader - per-vertex terrain type rendering with per-face state data.
 */

export const terrainVertexShader = `
precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute float terrainType;
attribute float faceId;

// Uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vTerrainType;
varying float vFaceId;

void main() {
  vec4 worldPos = world * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vPosition = position;
  vNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vTerrainType = terrainType;
  vFaceId = faceId;

  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

export const terrainFragmentShader = `
precision highp float;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vTerrainType;
varying float vFaceId;

// Face data texture (1 texel per face)
// R=moisture, G=nutrients (grass) or rake freshness (bunker), B=height, A=health
// Laid out as 2D texture with width=256 to stay within GPU texture size limits
uniform sampler2D faceData;
uniform vec2 faceDataDims;

// Parameters
uniform vec2 worldSize;
uniform float time;
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

// Image overlay
uniform sampler2D overlayImage;
uniform float overlayOpacity;
uniform float overlayOffsetX;
uniform float overlayOffsetZ;
uniform float overlayScaleX;
uniform float overlayScaleZ;
uniform float overlayFlipX;
uniform float overlayFlipY;
uniform float overlayRotation;

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
  // Read per-face state data from 2D texture
  float fdGrassHeight = 0.0;
  float fdMoisture = 0.5;
  float fdHealth = 1.0;
  float fdAux = 0.0;
  if (faceDataDims.x > 0.5) {
    float fid = floor(vFaceId + 0.5);
    float col = mod(fid, faceDataDims.x);
    float row = floor(fid / faceDataDims.x);
    float u = (col + 0.5) / faceDataDims.x;
    float v = (row + 0.5) / faceDataDims.y;
    vec4 faceSample = texture2D(faceData, vec2(u, v));
    fdMoisture = faceSample.r;
    fdAux = faceSample.g;
    fdGrassHeight = faceSample.b;
    fdHealth = faceSample.a;
  }

  // Determine masks based on vTerrainType attribute
  float type = floor(vTerrainType + 0.5);

  float fairwayMask = (abs(type - CODE_FAIRWAY) < 0.1) ? 1.0 : 0.0;
  float greenMask = (abs(type - CODE_GREEN) < 0.1) ? 1.0 : 0.0;
  float bunkerMask = (abs(type - CODE_BUNKER) < 0.1) ? 1.0 : 0.0;
  float waterMask = (abs(type - CODE_WATER) < 0.1) ? 1.0 : 0.0;
  float teeMask = (abs(type - CODE_TEE) < 0.1) ? 1.0 : 0.0;
  float roughMask = (abs(type - CODE_ROUGH) < 0.1) ? 1.0 : 0.0;

  // Mowed grass shows stripes; overgrown grass hides them
  float stripeVis = 1.0 - smoothstep(0.0, 0.4, fdGrassHeight);
  // Overgrown grass darkens slightly
  float heightDarken = fdGrassHeight * 0.06;
  // Moisture controls grass vibrancy
  // moisture=0 fully dry, moisture=15 (one sprinkler pass) ~20% green, moisture=50 fully green
  float wetness = smoothstep(0.0, 0.5, fdMoisture);

  vec3 color = roughColor;

  if (roughMask > 0.5) {
      color = roughColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz, color, 0.03);
      vec3 dryColor = color * 0.45 + vec3(0.14, 0.09, 0.0);
      color = mix(dryColor, color, wetness);
      color -= vec3(heightDarken);
  }
  else if (fairwayMask > 0.5) {
      color = fairwayColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz, color, 0.04);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 1.0, 0.08 * stripeVis);
         color = mix(color - vec3(0.04 * stripeVis), color + vec3(0.04 * stripeVis), stripe);
      }
      vec3 dryColor = color * 0.45 + vec3(0.14, 0.09, 0.0);
      color = mix(dryColor, color, wetness);
      color -= vec3(heightDarken);
  }
  else if (greenMask > 0.5) {
      color = greenColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz * 2.0, color, 0.02);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 0.3, 0.04 * stripeVis);
         color = mix(color - vec3(0.02 * stripeVis), color + vec3(0.02 * stripeVis), stripe);
      }
      vec3 dryColor = color * 0.45 + vec3(0.14, 0.09, 0.0);
      color = mix(dryColor, color, wetness);
      color -= vec3(heightDarken);
  }
  else if (teeMask > 0.5) {
      color = teeColor;
      if (enableNoise > 0.5) color = grassNoise(vWorldPosition.xz * 1.5, color, 0.03);
      if (enableStripes > 0.5) {
         float stripe = mowingStripes(vWorldPosition.xz, 0.5, 0.06 * stripeVis);
         color = mix(color - vec3(0.03 * stripeVis), color + vec3(0.03 * stripeVis), stripe);
      }
      vec3 dryColor = color * 0.45 + vec3(0.14, 0.09, 0.0);
      color = mix(dryColor, color, wetness);
      color -= vec3(heightDarken);
  }
  else if (bunkerMask > 0.5) {
      color = bunkerColor;
      color = sandGrain(vWorldPosition.xz, color);
      float rakeFreshness = fdAux;
      float grooveA = sin((vWorldPosition.x * 22.0 + vWorldPosition.z * 8.0));
      float grooveB = sin((vWorldPosition.x * 22.0 - vWorldPosition.z * 8.0));
      float rakeLines = max(smoothstep(0.55, 0.95, grooveA), smoothstep(0.65, 0.98, grooveB) * 0.7);
      float smoothSand = fbm(vWorldPosition.xz * 2.2) - 0.5;
      color += vec3(smoothSand * 0.07 * (1.0 - rakeFreshness));
      color = mix(color * 0.86, color, rakeFreshness * 0.35);
      color = mix(color, color + vec3(0.11, 0.09, 0.06), rakeLines * rakeFreshness);
  }
  else if (waterMask > 0.5) {
      color = waterColor;
      if (enableWaterAnim > 0.5) {
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

  // Image overlay
  if (overlayOpacity > 0.001) {
    vec2 overlayUV = (vWorldPosition.xz - vec2(overlayOffsetX, overlayOffsetZ)) / vec2(overlayScaleX, overlayScaleZ);
    vec2 centered = overlayUV - 0.5;
    if (overlayRotation > 0.5 && overlayRotation < 1.5) {
      centered = vec2(centered.y, -centered.x);
    } else if (overlayRotation > 1.5 && overlayRotation < 2.5) {
      centered = vec2(-centered.x, -centered.y);
    } else if (overlayRotation > 2.5) {
      centered = vec2(-centered.y, centered.x);
    }
    overlayUV = centered + 0.5;
    if (overlayUV.x >= 0.0 && overlayUV.x <= 1.0 && overlayUV.y >= 0.0 && overlayUV.y <= 1.0) {
      overlayUV.y = 1.0 - overlayUV.y;
      if (overlayFlipX > 0.5) overlayUV.x = 1.0 - overlayUV.x;
      if (overlayFlipY > 0.5) overlayUV.y = 1.0 - overlayUV.y;
      vec4 overlayColor = texture2D(overlayImage, overlayUV);
      float alpha = overlayColor.a * overlayOpacity;
      color = mix(color, overlayColor.rgb, alpha);
    }
  }

  // Overlays (per-face data lookup)
  if (overlayMode > 0.5 && faceDataDims.x > 0.5) {
     float fid = floor(vFaceId + 0.5);
     float col = mod(fid, faceDataDims.x);
     float row = floor(fid / faceDataDims.x);
     float u = (col + 0.5) / faceDataDims.x;
     float v = (row + 0.5) / faceDataDims.y;
     vec4 faceSample = texture2D(faceData, vec2(u, v));
     float moisture = faceSample.r;
     float nutrients = faceSample.g;
     float grassHeight = faceSample.b;
     float health = faceSample.a;

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
  overlayMode: number;
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
  overlayOpacity: number;
  overlayOffsetX: number;
  overlayOffsetZ: number;
  overlayScaleX: number;
  overlayScaleZ: number;
  overlayFlipX: number;
  overlayFlipY: number;
  overlayRotation: number;
}

export function getDefaultUniforms(
  worldWidth: number,
  worldHeight: number
): TerrainShaderUniforms {
  return {
    worldSize: [worldWidth, worldHeight],
    time: 0,
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
    overlayOpacity: 0,
    overlayOffsetX: 0,
    overlayOffsetZ: 0,
    overlayScaleX: 1,
    overlayScaleZ: 1,
    overlayFlipX: 0,
    overlayFlipY: 0,
    overlayRotation: 0,
  };
}
