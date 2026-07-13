import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import {
  Matrix4,
  Uniform,
  Vector2,
  type Camera,
  type PerspectiveCamera,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

/**
 * Lightweight screen-space reflections for MMD / MeshToon.
 * - Depth via EffectAttribute.DEPTH (`depth` arg + depthBuffer)
 * - Own EffectPass (CONVOLUTION: samples inputBuffer at hit UV)
 * - Adaptive steps from pixel count; export path further reduces cost
 */
const fragmentShader = /* glsl */ `
uniform float intensity;
uniform float maxDistance;
uniform float thickness;
uniform float roughnessFade;
uniform float qualityScale;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 cameraProjectionMatrix;
uniform mat4 cameraProjectionMatrixInverse;

float ssrSampleDepth(const in vec2 uv) {
  #if DEPTH_PACKING == 3201
    return unpackRGBAToDepth(texture2D(depthBuffer, uv));
  #else
    return texture2D(depthBuffer, uv).r;
  #endif
}

float ssrViewZ(const in float d) {
  #ifdef PERSPECTIVE_CAMERA
    return perspectiveDepthToViewZ(d, cameraNear, cameraFar);
  #else
    return orthographicDepthToViewZ(d, cameraNear, cameraFar);
  #endif
}

vec3 ssrViewPos(const in vec2 uv, const in float d) {
  // Reconstruct via inverse projection (stable across camera types)
  float z = d * 2.0 - 1.0;
  vec4 clip = vec4(uv * 2.0 - 1.0, z, 1.0);
  vec4 view = cameraProjectionMatrixInverse * clip;
  view.xyz /= max(view.w, 1e-5);
  // Prefer depth-consistent Z (inverse can drift with packing)
  view.z = ssrViewZ(d);
  return view.xyz;
}

vec2 ssrProject(const in vec3 viewPos) {
  vec4 clip = cameraProjectionMatrix * vec4(viewPos, 1.0);
  float w = max(abs(clip.w), 1e-5);
  return clip.xy / w * 0.5 + 0.5;
}

// Cheap hash for sub-pixel jitter (breaks banding, not temporal TAA)
float ssrHash(const in vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (intensity < 0.001) return;
  // Far / sky
  if (depth >= 0.9995 || depth <= 0.0001) return;

  vec3 viewPos = ssrViewPos(uv, depth);
  float distCam = -viewPos.z;
  if (distCam > maxDistance * 1.35) return;

  vec2 texel = 1.0 / max(resolution, vec2(1.0));
  float dR = ssrSampleDepth(uv + vec2(texel.x, 0.0));
  float dU = ssrSampleDepth(uv + vec2(0.0, texel.y));
  // Unstable depth discontinuities → skip (hair/edges noise)
  if (abs(dR - depth) > 0.012 || abs(dU - depth) > 0.012) return;

  vec3 p1 = ssrViewPos(uv + vec2(texel.x, 0.0), dR);
  vec3 p2 = ssrViewPos(uv + vec2(0.0, texel.y), dU);
  vec3 viewNormal = normalize(cross(p1 - viewPos, p2 - viewPos));
  vec3 viewDir = normalize(viewPos);
  if (dot(viewNormal, -viewDir) < 0.0) viewNormal = -viewNormal;

  float ndotv = max(0.0, dot(viewNormal, -viewDir));
  // Early-out: faces looking away contribute almost nothing
  if (ndotv > 0.92 && intensity < 0.45) return;

  float fresnel = pow(1.0 - ndotv, 2.6);
  float faceWeight = mix(0.06, 1.0, fresnel);
  // Prefer ground / side planes slightly (common MMD floor bounce)
  float floorBias = smoothstep(0.15, 0.75, abs(viewNormal.y));
  faceWeight *= mix(1.0, 1.15, floorBias * 0.5);

  float depthGrad = abs(dR - depth) + abs(dU - depth);
  float gloss = 1.0 - clamp(depthGrad * 90.0, 0.0, 1.0) * clamp(roughnessFade, 0.0, 1.0);
  if (faceWeight * gloss < 0.04) return;

  float q = clamp(qualityScale, 0.0, 1.0);
  int maxSteps = int(mix(6.0, 14.0, q) + 0.5);
  int refineSteps = q > 0.55 ? 3 : 2;
  float stride = mix(0.065, 0.024, q);
  stride *= max(0.28, min(2.2, distCam * 0.038));
  // Sub-pixel start jitter reduces step banding
  float jitter = ssrHash(uv * resolution) * 0.65;
  vec3 reflectDir = normalize(reflect(viewDir, viewNormal));
  vec3 rayPos = viewPos + viewNormal * (0.015 + distCam * 0.0002) + reflectDir * (stride * jitter);
  vec2 hitUv = uv;
  bool hit = false;
  float lastStride = stride;

  for (int i = 0; i < 16; i++) {
    if (i >= maxSteps) break;
    lastStride = stride;
    rayPos += reflectDir * stride;
    hitUv = ssrProject(rayPos);
    if (hitUv.x <= 0.002 || hitUv.x >= 0.998 || hitUv.y <= 0.002 || hitUv.y >= 0.998) break;

    float sceneD = ssrSampleDepth(hitUv);
    if (sceneD >= 0.9995) {
      stride *= 1.14;
      continue;
    }
    float sceneZ = ssrViewZ(sceneD);
    float delta = rayPos.z - sceneZ;
    float thick = thickness * (0.35 + float(i) * 0.07 + distCam * 0.008);
    if (delta > 0.0 && delta < thick) {
      vec3 lo = rayPos - reflectDir * lastStride;
      vec3 hi = rayPos;
      for (int r = 0; r < 4; r++) {
        if (r >= refineSteps) break;
        vec3 mid = (lo + hi) * 0.5;
        vec2 midUv = ssrProject(mid);
        float midD = ssrSampleDepth(midUv);
        float midZ = ssrViewZ(midD);
        if (mid.z - midZ > 0.0) hi = mid; else lo = mid;
        hitUv = midUv;
        rayPos = mid;
      }
      // Reject hits that are still too thick (silhouette false positives)
      float finalD = ssrSampleDepth(hitUv);
      float finalDelta = rayPos.z - ssrViewZ(finalD);
      if (finalDelta > 0.0 && finalDelta < thick * 1.15) hit = true;
      break;
    }
    stride *= 1.09;
  }

  if (!hit) return;

  vec2 edge = abs(hitUv * 2.0 - 1.0);
  float edgeFade = 1.0 - smoothstep(0.68, 0.97, max(edge.x, edge.y));
  float travel = length(rayPos - viewPos);
  float distFade = 1.0 - smoothstep(maxDistance * 0.28, maxDistance, travel);
  float selfFade = smoothstep(0.025, 0.14, travel);
  // Avoid reflecting nearly the same pixel (fireflies)
  float uvTravel = length((hitUv - uv) * resolution);
  float sepFade = smoothstep(1.5, 6.0, uvTravel);

  // 1-tap blur on hit reduces sparkle (cheap)
  vec2 blurTexel = texel * mix(1.5, 0.8, q);
  vec3 reflected =
    texture2D(inputBuffer, hitUv).rgb * 0.5
    + texture2D(inputBuffer, hitUv + vec2(blurTexel.x, 0.0)).rgb * 0.25
    + texture2D(inputBuffer, hitUv + vec2(0.0, blurTexel.y)).rgb * 0.25;

  float w = intensity * faceWeight * gloss * edgeFade * distFade * selfFade * sepFade;
  w = clamp(w, 0.0, 0.72);
  outputColor.rgb = inputColor.rgb * (1.0 - w * 0.38) + reflected * w;
  outputColor.a = inputColor.a;
}
`;

const _proj = new Matrix4();
const _projInv = new Matrix4();
const _res = new Vector2();

export class MmdSsrEffect extends Effect {
  private readonly uIntensity: Uniform;
  private readonly uMaxDistance: Uniform;
  private readonly uThickness: Uniform;
  private readonly uRoughnessFade: Uniform;
  private readonly uQualityScale: Uniform;
  private readonly uResolution: Uniform;
  private readonly uCameraNear: Uniform;
  private readonly uCameraFar: Uniform;
  private readonly uProj: Uniform;
  private readonly uProjInv: Uniform;

  constructor({
    intensity = 0.35,
    maxDistance = 32,
    thickness = 0.65,
    roughnessFade = 0.55,
  }: {
    intensity?: number;
    maxDistance?: number;
    thickness?: number;
    roughnessFade?: number;
  } = {}) {
    const uIntensity = new Uniform(intensity);
    const uMaxDistance = new Uniform(maxDistance);
    const uThickness = new Uniform(thickness);
    const uRoughnessFade = new Uniform(roughnessFade);
    const uQualityScale = new Uniform(0.55);
    const uResolution = new Uniform(new Vector2(1, 1));
    const uCameraNear = new Uniform(0.1);
    const uCameraFar = new Uniform(1000);
    const uProj = new Uniform(new Matrix4());
    const uProjInv = new Uniform(new Matrix4());

    super("MmdSsrEffect", fragmentShader, {
      // CONVOLUTION: samples inputBuffer off-UV → must be sole convolution in its EffectPass
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ["intensity", uIntensity],
        ["maxDistance", uMaxDistance],
        ["thickness", uThickness],
        ["roughnessFade", uRoughnessFade],
        ["qualityScale", uQualityScale],
        ["resolution", uResolution],
        ["cameraNear", uCameraNear],
        ["cameraFar", uCameraFar],
        ["cameraProjectionMatrix", uProj],
        ["cameraProjectionMatrixInverse", uProjInv],
      ]),
    });

    this.uIntensity = uIntensity;
    this.uMaxDistance = uMaxDistance;
    this.uThickness = uThickness;
    this.uRoughnessFade = uRoughnessFade;
    this.uQualityScale = uQualityScale;
    this.uResolution = uResolution;
    this.uCameraNear = uCameraNear;
    this.uCameraFar = uCameraFar;
    this.uProj = uProj;
    this.uProjInv = uProjInv;
  }

  get intensity() {
    return this.uIntensity.value as number;
  }
  set intensity(v: number) {
    this.uIntensity.value = v;
  }

  get maxDistance() {
    return this.uMaxDistance.value as number;
  }
  set maxDistance(v: number) {
    this.uMaxDistance.value = v;
  }

  get thickness() {
    return this.uThickness.value as number;
  }
  set thickness(v: number) {
    this.uThickness.value = v;
  }

  get roughnessFade() {
    return this.uRoughnessFade.value as number;
  }
  set roughnessFade(v: number) {
    this.uRoughnessFade.value = v;
  }

  /** Call each frame (or on camera/size change). */
  syncCamera(camera: Camera, drawingWidth: number, drawingHeight: number, qualityScale: number) {
    const cam = camera as PerspectiveCamera;
    this.uCameraNear.value = cam.near ?? 0.1;
    this.uCameraFar.value = cam.far ?? 1000;
    _proj.copy(cam.projectionMatrix);
    _projInv.copy(cam.projectionMatrixInverse);
    this.uProj.value = _proj;
    this.uProjInv.value = _projInv;
    _res.set(Math.max(1, drawingWidth), Math.max(1, drawingHeight));
    (this.uResolution.value as Vector2).copy(_res);
    this.uQualityScale.value = qualityScale;
  }

  update(_renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, _deltaTime?: number) {
    // camera sync done from MmdPostFx useFrame
  }
}

export type SsrQualityOptions = {
  /** Offline export / high-cost capture — further cut steps. */
  exportMode?: boolean;
};

/** Map drawing-buffer pixels + user amount → step quality (0.15–1). */
export function ssrQualityFromPixels(
  pixels: number,
  userAmount: number,
  options: SsrQualityOptions = {},
): number {
  let scale = 0.28 + clamp01(userAmount) * 0.62;
  if (pixels > 1920 * 1080) scale *= 0.48;
  else if (pixels > 1280 * 720) scale *= 0.65;
  else if (pixels > 960 * 540) scale *= 0.82;
  if (pixels > 2560 * 1440) scale *= 0.72;
  if (options.exportMode) scale *= 0.55;
  return Math.min(1, Math.max(0.15, scale));
}

/** Intensity scale during export so SSR doesn't dominate offline cost. */
export function ssrIntensityForExport(userAmount: number, exportMode: boolean): number {
  const base = 0.12 + clamp01(userAmount) * 0.52;
  return exportMode ? base * 0.72 : base;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
