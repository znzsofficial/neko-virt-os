import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  HueSaturationEffect,
  KernelSize,
  LensDistortionEffect,
  LUT3DEffect,
  NoiseEffect,
  NormalPass,
  OutlineEffect,
  OverrideMaterialManager,
  RenderPass,
  SelectiveBloomEffect,
  SMAAEffect,
  SMAAPreset,
  SSAOEffect,
  TiltShiftEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sunPositionFromAngles } from "./mmdProjectDb";
import {
  resolvePostFxTune,
  useMmdStudioStore,
  type MmdLutLook,
  type MmdPostFxPreset,
  type MmdPostFxTune,
  type MmdSmaaQuality,
} from "./mmdStudioStore";
import { MmdSsrEffect, ssrIntensityForExport, ssrQualityFromPixels } from "./mmdSsrEffect";

OverrideMaterialManager.workaroundEnabled = true;

function smaaFromQuality(quality: MmdSmaaQuality) {
  if (quality === "low") return SMAAPreset.LOW;
  if (quality === "high") return SMAAPreset.HIGH;
  if (quality === "ultra") return SMAAPreset.ULTRA;
  return SMAAPreset.MEDIUM;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function bloomKernel(radius: number) {
  if (radius < 0.35) return KernelSize.SMALL;
  if (radius < 0.65) return KernelSize.MEDIUM;
  if (radius < 0.9) return KernelSize.LARGE;
  return KernelSize.VERY_LARGE;
}

/**
 * MSAA + HalfFloat at export/high res exhausts GPU memory (ANGLE D3D11).
 * Cap samples and prefer 8-bit buffers when the drawing buffer is large.
 *
 * `width`/`height` must be **logical** renderer size (getSize), not
 * drawing-buffer pixels — EffectComposer.setSize multiplies by pixelRatio.
 */
function resolveComposerQuality(
  gl: THREE.WebGLRenderer,
  requestedMsaa: number,
  logicalWidth: number,
  logicalHeight: number,
) {
  const w = Math.max(1, Math.round(logicalWidth));
  const h = Math.max(1, Math.round(logicalHeight));
  const pr = Math.max(1, gl.getPixelRatio() || 1);
  const pixels = Math.round(w * pr) * Math.round(h * pr);
  const maxTex = gl.capabilities?.maxTextureSize ?? 8192;
  const webgl2 = Boolean(gl.capabilities?.isWebGL2);
  let msaa = webgl2 ? Math.max(0, Math.min(8, Math.trunc(requestedMsaa))) : 0;
  // 1080p+ drawing buffer: no MSAA (SMAA still antialiases).
  if (pixels > 1280 * 720) msaa = 0;
  else if (pixels > 960 * 540) msaa = Math.min(msaa, 2);
  // HalfFloat × MSAA multiplies VRAM; drop HDR buffers when MSAA or large.
  const frameBufferType =
    msaa > 0 || pixels > 1920 * 1080 ? THREE.UnsignedByteType : THREE.HalfFloatType;
  return { width: w, height: h, msaa, frameBufferType, pixels, maxTex, pixelRatio: pr };
}

/** Safe composer resize: pass logical size only; never drawing-buffer dims. */
function resizeComposerToRenderer(composer: EffectComposer, gl: THREE.WebGLRenderer, scratch: THREE.Vector2) {
  if (isGlContextLost(gl)) return false;
  gl.getSize(scratch);
  const w = Math.max(1, Math.round(scratch.x));
  const h = Math.max(1, Math.round(scratch.y));
  const pr = Math.max(1, gl.getPixelRatio() || 1);
  const maxTex = gl.capabilities?.maxTextureSize ?? 8192;
  if (w * pr > maxTex || h * pr > maxTex) return false;
  try {
    // postprocessing setSize uses getDrawingBufferSize after optionally setSize'ing the renderer.
    composer.setSize(w, h);
    return true;
  } catch {
    return false;
  }
}

function isGlContextLost(gl: THREE.WebGLRenderer) {
  try {
    return Boolean(gl.getContext()?.isContextLost?.());
  } catch {
    return true;
  }
}

/** Only values that require rebuild of EffectPass graph. Continuous sliders update live. */
function structuralFxKey(tune: MmdPostFxTune, preset: MmdPostFxPreset, msaa: number, halfFloat: boolean) {
  return [
    preset,
    tune.smaa,
    msaa,
    halfFloat ? 1 : 0,
    tune.toneMapping ? 1 : 0,
    tune.lut,
    tune.ssao > 0.001 ? 1 : 0,
    // SSR rebuild only on/off (amount is hot-updated)
    tune.ssr > 0.001 ? 1 : 0,
    tune.outline > 0.001 ? 1 : 0,
    tune.dof > 0.001 ? 1 : 0,
    tune.bloom > 0.001 ? 1 : 0,
    tune.bloomSelective ? 1 : 0,
    bloomKernel(Math.max(0.05, tune.bloomRadius)),
    Math.abs(tune.saturation) > 0.001 ? 1 : 0,
    Math.abs(tune.brightness) > 0.001 || Math.abs(tune.contrast) > 0.001 ? 1 : 0,
    tune.chroma > 0.001 ? 1 : 0,
    tune.vignette > 0.001 ? 1 : 0,
    tune.grain > 0.001 ? 1 : 0,
    tune.godRays > 0.001 ? 1 : 0,
    tune.sparkle > 0.001 ? 1 : 0,
    // Sparkle point count steps — rebuild only when density band changes.
    Math.round(tune.sparkle * 6),
    tune.lensDistortion > 0.001 ? 1 : 0,
    tune.tiltShift > 0.001 ? 1 : 0,
  ].join("|");
}

function createGradeLut(look: MmdLutLook): THREE.Data3DTexture | null {
  if (look === "none") return null;
  const size = 32;
  const data = new Uint8Array(size * size * size * 4);
  let i = 0;
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let r = x / (size - 1);
        let g = y / (size - 1);
        let b = z / (size - 1);
        if (look === "warm") {
          r = clamp01(r * 1.08 + 0.02);
          g = clamp01(g * 1.01);
          b = clamp01(b * 0.9 - 0.01);
        } else if (look === "cool") {
          r = clamp01(r * 0.94);
          g = clamp01(g * 1.02);
          b = clamp01(b * 1.1 + 0.02);
        } else {
          const lift = (c: number) => clamp01(c * c * (3 - 2 * c));
          r = clamp01(lift(r) * 1.05 + 0.015);
          g = clamp01(lift(g) * 0.98);
          b = clamp01(lift(b) * 0.92 + 0.02);
        }
        data[i++] = Math.round(r * 255);
        data[i++] = Math.round(g * 255);
        data[i++] = Math.round(b * 255);
        data[i++] = 255;
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function isFxHelperName(name: string) {
  return (
    name.includes("grid")
    || name.includes("shadow")
    || name.includes("helper")
    || name.includes("godray")
    || name.includes("sparkle")
  );
}

function collectOutlineTargets(scene: THREE.Scene) {
  const targets: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.visible) return;
    if (mesh.userData?.mmdFxHelper) return;
    if (mesh.type === "SkinnedMesh" || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      targets.push(mesh);
      return;
    }
    const name = (mesh.name || "").toLowerCase();
    if (isFxHelperName(name)) return;
    if (mesh.userData?.mmdOutline === false) return;
  });
  return targets;
}

/** Character meshes for selective bloom (avoid blooming whole HDR sky/floor). */
function collectBloomTargets(scene: THREE.Scene) {
  const targets: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.visible) return;
    if (mesh.userData?.mmdFxHelper) return;
    const name = (mesh.name || "").toLowerCase();
    if (isFxHelperName(name)) return;
    if (mesh.type === "SkinnedMesh" || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      targets.push(mesh);
      return;
    }
    // Non-skinned parts that still belong to model (accessories).
    if (mesh.userData?.mmdBloom === true) targets.push(mesh);
  });
  return targets;
}

function createSparkleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,245,220,0.85)");
  g.addColorStop(0.55, "rgba(255,220,160,0.35)");
  g.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createAirSparkles(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const r = 4 + Math.random() * 28;
    const theta = Math.random() * Math.PI * 2;
    const y = -1 + Math.random() * 22;
    const x = Math.cos(theta) * r * (0.4 + Math.random() * 0.8);
    const z = Math.sin(theta) * r * (0.4 + Math.random() * 0.8);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.25 + Math.random() * 0.9;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aBase", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  const map = createSparkleTexture();
  const material = new THREE.PointsMaterial({
    map: map ?? undefined,
    color: new THREE.Color("#fff2d0"),
    size: 0.28,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "mmd-air-sparkles";
  points.frustumCulled = false;
  points.renderOrder = 40;
  points.userData.mmdFxHelper = true;
  return points;
}

function resolveModelFocusWorld(
  scene: THREE.Scene,
  selectedId: string | null,
  models: { id: string; visible: boolean; transform: { positionX: number; positionY: number; positionZ: number; scale: number } }[],
  out: THREE.Vector3,
) {
  const storeModels = models;
  const id = selectedId ?? storeModels.find((m) => m.visible)?.id ?? null;
  if (!id) return false;

  // Prefer selected model root / skinned meshes (tagged with userData.mmdModelId).
  const root = scene.children.find((child) => child.userData?.mmdModelId === id);
  const skinned: THREE.Object3D[] = [];
  const scope = root ?? scene;
  scope.traverse((obj) => {
    if (obj.userData?.mmdModelId !== id) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && ((mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.type === "SkinnedMesh")) {
      skinned.push(mesh);
    }
  });

  if (skinned.length) {
    const box = new THREE.Box3();
    for (const mesh of skinned) box.expandByObject(mesh);
    if (!box.isEmpty()) {
      box.getCenter(out);
      out.y = box.min.y + (box.max.y - box.min.y) * 0.72;
      return true;
    }
  }

  if (root) {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      box.getCenter(out);
      out.y = box.min.y + (box.max.y - box.min.y) * 0.72;
      return true;
    }
    root.getWorldPosition(out);
    out.y += 10;
    return true;
  }

  const model = storeModels.find((m) => m.id === id);
  if (!model) return false;
  out.set(
    model.transform.positionX,
    model.transform.positionY + 12 * model.transform.scale,
    model.transform.positionZ,
  );
  return true;
}

/**
 * WebGL post stack (WebGPU forced off in store).
 * Structural changes rebuild the pass graph; continuous sliders update live.
 */
export function MmdPostFx({ preset }: { preset: MmdPostFxPreset }) {
  const { gl, scene, camera, size } = useThree();
  const backend = useMmdStudioStore((state) => state.backend);
  const postFx = useMmdStudioStore((state) => state.postFx);
  const postFxTune = useMmdStudioStore((state) => state.postFxTune);
  const models = useMmdStudioStore((state) => state.models);
  const lights = useMmdStudioStore((state) => state.lights);
  const modelOutlineKey = useMemo(
    () => models.map((item) => `${item.id}:${item.visible ? 1 : 0}`).join("|"),
    [models],
  );
  const tune = useMemo(
    () => resolvePostFxTune(backend, postFx, postFxTune),
    [backend, postFx, postFxTune],
  );
  const sunPos = useMemo(
    () => sunPositionFromAngles(lights.sunAzimuth, lights.sunElevation, lights.sunDistance),
    [lights.sunAzimuth, lights.sunDistance, lights.sunElevation],
  );
  // Logical size for quality/rebuild keys. During export, gl logical size is the
  // export resolution (pixelRatio=1); R3F `size` may still be the CSS viewport.
  const exporting = useMmdStudioStore((state) => state.recording || state.exportingOffline);
  const sizeScratch = useMemo(() => new THREE.Vector2(), []);
  const logicalW = exporting
    ? Math.max(1, Math.round(gl.getSize(sizeScratch).x) || size.width)
    : Math.max(1, size.width);
  const logicalH = exporting
    ? Math.max(1, Math.round(gl.getSize(sizeScratch).y) || size.height)
    : Math.max(1, size.height);

  const composerQuality = useMemo(
    () => resolveComposerQuality(gl, tune.msaa, logicalW, logicalH),
    [gl, logicalH, logicalW, tune.msaa],
  );

  const structureKey = useMemo(
    () =>
      `${structuralFxKey(
        tune,
        preset,
        composerQuality.msaa,
        composerQuality.frameBufferType === THREE.HalfFloatType,
      )}|sun:${lights.sunIntensity > 0.001 ? 1 : 0}|${modelOutlineKey}|px:${composerQuality.pixels}`,
    [
      composerQuality.frameBufferType,
      composerQuality.msaa,
      composerQuality.pixels,
      lights.sunIntensity,
      modelOutlineKey,
      preset,
      tune,
    ],
  );

  const composer = useMemo(() => {
    if (isGlContextLost(gl)) return null;
    const next = new EffectComposer(gl, {
      multisampling: composerQuality.msaa,
      frameBufferType: composerQuality.frameBufferType,
      depthBuffer: true,
    });
    next.addPass(new RenderPass(scene, camera));
    resizeComposerToRenderer(next, gl, sizeScratch);
    return next;
  }, [camera, composerQuality.frameBufferType, composerQuality.msaa, gl, scene, sizeScratch]);

  const dofRef = useRef<DepthOfFieldEffect | null>(null);
  const bloomRef = useRef<BloomEffect | SelectiveBloomEffect | null>(null);
  const godRaysRef = useRef<GodRaysEffect | null>(null);
  const grainRef = useRef<NoiseEffect | null>(null);
  const lensRef = useRef<LensDistortionEffect | null>(null);
  const tiltRef = useRef<TiltShiftEffect | null>(null);
  const ssrRef = useRef<MmdSsrEffect | null>(null);
  const pixelsRef = useRef(composerQuality.pixels);
  pixelsRef.current = composerQuality.pixels;
  const exportingRef = useRef(exporting);
  exportingRef.current = exporting;
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sparklesRef = useRef<THREE.Points | null>(null);
  const bloomSelectionKeyRef = useRef("");
  const focusScratch = useMemo(() => new THREE.Vector3(), []);
  const lensDistScratch = useMemo(() => new THREE.Vector2(), []);
  const tuneRef = useRef(tune);
  tuneRef.current = tune;
  const sunPosRef = useRef(sunPos);
  sunPosRef.current = sunPos;
  const modelOutlineKeyRef = useRef(modelOutlineKey);
  modelOutlineKeyRef.current = modelOutlineKey;

  useEffect(() => {
    if (!composer) return;
    resizeComposerToRenderer(composer, gl, sizeScratch);
  }, [composer, exporting, gl, logicalH, logicalW, size.height, size.width, sizeScratch]);

  useEffect(() => {
    if (!composer || isGlContextLost(gl)) return;
    while (composer.passes.length > 1) {
      const pass = composer.passes[composer.passes.length - 1];
      composer.removePass(pass);
      pass.dispose();
    }
    dofRef.current = null;
    bloomRef.current = null;
    godRaysRef.current = null;
    grainRef.current = null;
    lensRef.current = null;
    tiltRef.current = null;
    ssrRef.current = null;
    if (sunMeshRef.current) {
      scene.remove(sunMeshRef.current);
      sunMeshRef.current.geometry.dispose();
      (sunMeshRef.current.material as THREE.Material).dispose();
      sunMeshRef.current = null;
    }
    if (sparklesRef.current) {
      scene.remove(sparklesRef.current);
      sparklesRef.current.geometry.dispose();
      const mat = sparklesRef.current.material as THREE.PointsMaterial;
      mat.map?.dispose();
      mat.dispose();
      sparklesRef.current = null;
    }

    if (preset === "off") return;

    const t = tuneRef.current;
    const disposableTextures: THREE.Texture[] = [];
    const grade: ConstructorParameters<typeof EffectPass>[1][] = [];
    let normalPass: NormalPass | null = null;
    // SSR is CONVOLUTION — must be its own EffectPass (before grade).
    let ssrPass: EffectPass | null = null;

    if (t.ssr > 0.001) {
      const ssr = new MmdSsrEffect({
        intensity: ssrIntensityForExport(t.ssr, false),
        maxDistance: 20 + t.ssr * 16,
        thickness: 0.42 + t.ssr * 0.32,
        roughnessFade: 0.55,
      });
      ssrRef.current = ssr;
      ssrPass = new EffectPass(camera, ssr);
    }

    if (t.ssao > 0.001) {
      normalPass = new NormalPass(scene, camera);
      composer.addPass(normalPass);
      const ssao = new SSAOEffect(camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 11,
        rings: 5,
        intensity: 0.4 + t.ssao * 1.8,
        radius: 0.08 + t.ssao * 0.12,
        luminanceInfluence: 0.55,
        bias: 0.03,
        fade: 0.02,
        resolutionScale: 0.65,
        worldDistanceThreshold: 40,
        worldDistanceFalloff: 12,
        worldProximityThreshold: 0.6,
        worldProximityFalloff: 0.25,
      });
      ssao.blendMode.opacity.value = clamp01(0.35 + t.ssao * 0.65);
      grade.push(ssao);
    }

    if (t.outline > 0.001) {
      const outline = new OutlineEffect(scene, camera, {
        blendFunction: BlendFunction.SCREEN,
        edgeStrength: 0.8 + t.outline * 2.4,
        pulseSpeed: 0,
        visibleEdgeColor: 0x1a1a22,
        hiddenEdgeColor: 0x000000,
        kernelSize: KernelSize.SMALL,
        blur: true,
        xRay: false,
        multisampling: 0,
        resolutionScale: 0.6,
      });
      outline.blendMode.opacity.value = clamp01(t.outline);
      const targets = collectOutlineTargets(scene);
      outline.selection.clear();
      for (const target of targets) outline.selection.add(target);
      grade.push(outline);
    }

    if (t.dof > 0.001) {
      const aperture = Math.max(0.05, t.dofAperture);
      const dof = new DepthOfFieldEffect(camera, {
        focusDistance: t.dofFocus,
        focusRange: Math.max(0.5, t.dofRange),
        bokehScale: (0.25 + t.dof * 2.8) * aperture,
        resolutionScale: 0.55,
      });
      dofRef.current = dof;
      grade.push(dof);
    }

    if (t.bloom > 0.001) {
      const radius = Math.max(0.05, t.bloomRadius);
      const bloomOpts = {
        intensity: t.bloom * (0.7 + radius * 0.6),
        luminanceThreshold: t.bloomThreshold,
        luminanceSmoothing: 0.18 + (1 - t.bloomThreshold) * 0.2,
        mipmapBlur: true,
        kernelSize: bloomKernel(radius),
        radius: 0.25 + radius * 0.85,
      };
      if (t.bloomSelective) {
        const selective = new SelectiveBloomEffect(scene, camera, bloomOpts);
        selective.inverted = false;
        selective.ignoreBackground = true;
        selective.selection.clear();
        for (const target of collectBloomTargets(scene)) selective.selection.add(target);
        bloomSelectionKeyRef.current = modelOutlineKeyRef.current;
        bloomRef.current = selective;
        grade.push(selective);
      } else {
        const bloom = new BloomEffect(bloomOpts);
        bloomRef.current = bloom;
        grade.push(bloom);
      }
    }

    if (t.godRays > 0.001 && lights.sunIntensity > 0.001) {
      // Tiny dim marker — only for GodRays sampling, not a visible sun ball.
      const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.35, lights.sunDistance * 0.012), 12, 12),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color("#fff8e8"),
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      sunMesh.name = "mmd-godray-sun";
      sunMesh.position.set(sunPos[0], sunPos[1], sunPos[2]);
      sunMesh.frustumCulled = false;
      sunMesh.renderOrder = 50;
      sunMesh.userData.mmdFxHelper = true;
      // Keep out of raycast / outline heuristics.
      sunMesh.layers.set(1);
      scene.add(sunMesh);
      sunMeshRef.current = sunMesh;

      const rays = new GodRaysEffect(camera, sunMesh, {
        blendFunction: BlendFunction.SCREEN,
        samples: 48,
        density: 0.88 + t.godRays * 0.08,
        decay: 0.92,
        weight: 0.25 + t.godRays * 0.45,
        exposure: 0.35 + t.godRays * 0.55,
        clampMax: 1,
        blur: true,
        kernelSize: KernelSize.SMALL,
        resolutionScale: 0.45,
      });
      rays.blendMode.opacity.value = clamp01(0.25 + t.godRays * 0.75);
      godRaysRef.current = rays;
      grade.push(rays);
    }

    if (t.sparkle > 0.001) {
      const count = Math.round(40 + t.sparkle * 180);
      const sparkles = createAirSparkles(count);
      const mat = sparkles.material as THREE.PointsMaterial;
      mat.opacity = clamp01(0.25 + t.sparkle * 0.75) * clamp01(t.sparkleIntensity);
      mat.size = 0.16 + t.sparkle * 0.28;
      scene.add(sparkles);
      sparklesRef.current = sparkles;
    }

    if (Math.abs(t.saturation) > 0.001) {
      grade.push(new HueSaturationEffect({ saturation: t.saturation }));
    }
    if (Math.abs(t.brightness) > 0.001 || Math.abs(t.contrast) > 0.001) {
      grade.push(new BrightnessContrastEffect({ brightness: t.brightness, contrast: t.contrast }));
    }
    if (t.chroma > 0.001) {
      const amount = 0.0002 + t.chroma * 0.0012;
      grade.push(
        new ChromaticAberrationEffect({
          offset: new THREE.Vector2(amount, amount),
          radialModulation: true,
          modulationOffset: 0.18,
        }),
      );
    }
    if (t.lensDistortion > 0.001) {
      const amount = t.lensDistortion * 0.18;
      const lens = new LensDistortionEffect({
        distortion: new THREE.Vector2(amount, amount * 0.92),
        principalPoint: new THREE.Vector2(0, 0),
        focalLength: new THREE.Vector2(1, 1),
        skew: 0,
      });
      lensRef.current = lens;
      grade.push(lens);
    }
    if (t.tiltShift > 0.001) {
      const amount = clamp01(t.tiltShift);
      const tilt = new TiltShiftEffect({
        offset: 0,
        rotation: 0,
        focusArea: Math.max(0.12, 0.55 - amount * 0.28),
        feather: 0.22 + amount * 0.35,
        kernelSize: amount > 0.55 ? KernelSize.LARGE : KernelSize.MEDIUM,
        resolutionScale: 0.5,
      });
      tilt.blendMode.opacity.value = clamp01(0.35 + amount * 0.65);
      tiltRef.current = tilt;
      grade.push(tilt);
    }
    if (t.vignette > 0.001) {
      grade.push(new VignetteEffect({ darkness: t.vignette, offset: 0.34 }));
    }
    if (t.toneMapping) {
      grade.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    }
    if (t.lut !== "none") {
      const lutTex = createGradeLut(t.lut);
      if (lutTex) {
        disposableTextures.push(lutTex);
        grade.push(new LUT3DEffect(lutTex));
      }
    }
    if (t.grain > 0.001) {
      const noise = new NoiseEffect({
        blendFunction: BlendFunction.SOFT_LIGHT,
        premultiply: true,
      });
      noise.blendMode.opacity.value = clamp01(t.grain * 0.55);
      grainRef.current = noise;
      grade.push(noise);
    }

    // Order: RenderPass → [SSR] → grade (SSAO/bloom/…) → SMAA
    if (ssrPass) composer.addPass(ssrPass);
    if (grade.length) composer.addPass(new EffectPass(camera, ...grade));
    composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: smaaFromQuality(t.smaa) })));

    return () => {
      while (composer.passes.length > 1) {
        const pass = composer.passes[composer.passes.length - 1];
        composer.removePass(pass);
        pass.dispose();
      }
      for (const texture of disposableTextures) texture.dispose();
      dofRef.current = null;
      bloomRef.current = null;
      godRaysRef.current = null;
      grainRef.current = null;
      lensRef.current = null;
      tiltRef.current = null;
      ssrRef.current = null;
      if (sunMeshRef.current) {
        scene.remove(sunMeshRef.current);
        sunMeshRef.current.geometry.dispose();
        (sunMeshRef.current.material as THREE.Material).dispose();
        sunMeshRef.current = null;
      }
      if (sparklesRef.current) {
        scene.remove(sparklesRef.current);
        sparklesRef.current.geometry.dispose();
        const mat = sparklesRef.current.material as THREE.PointsMaterial;
        mat.map?.dispose();
        mat.dispose();
        sparklesRef.current = null;
      }
    };
    // structureKey encodes preset + structural flags; continuous sliders update in useFrame.
  }, [camera, composer, gl, lights.sunDistance, lights.sunIntensity, scene, structureKey, sunPos]);

  useFrame((state, delta) => {
    if (preset === "off" || !composer) return;
    if (isGlContextLost(state.gl as THREE.WebGLRenderer)) return;
    const t = tuneRef.current;
    const sun = sunPosRef.current;

    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sun[0], sun[1], sun[2]);
    }

    const ssr = ssrRef.current;
    if (ssr && t.ssr > 0.001) {
      const exportMode = exportingRef.current;
      ssr.intensity = ssrIntensityForExport(t.ssr, exportMode);
      ssr.maxDistance = 20 + t.ssr * 16;
      ssr.thickness = 0.42 + t.ssr * 0.32;
      const q = ssrQualityFromPixels(pixelsRef.current, t.ssr, { exportMode });
      // Prefer drawing-buffer size (composer / export may differ from CSS size)
      const glr = state.gl as THREE.WebGLRenderer;
      const db = glr.getDrawingBufferSize(sizeScratch);
      const dw = Math.max(1, Math.round(db.x));
      const dh = Math.max(1, Math.round(db.y));
      ssr.syncCamera(state.camera, dw, dh, q);
    }

    const bloom = bloomRef.current;
    if (bloom && t.bloom > 0.001) {
      const radius = Math.max(0.05, t.bloomRadius);
      bloom.intensity = t.bloom * (0.7 + radius * 0.6);
      bloom.luminanceMaterial.threshold = t.bloomThreshold;
      bloom.luminanceMaterial.smoothing = 0.18 + (1 - t.bloomThreshold) * 0.2;
      if ("radius" in bloom && typeof (bloom as BloomEffect & { radius?: number }).radius === "number") {
        (bloom as BloomEffect & { radius: number }).radius = 0.25 + radius * 0.85;
      }
      if (bloom instanceof SelectiveBloomEffect) {
        // Refresh selection only when model set / visibility changes.
        const key = modelOutlineKeyRef.current;
        if (key !== bloomSelectionKeyRef.current) {
          bloom.selection.clear();
          for (const target of collectBloomTargets(scene)) bloom.selection.add(target);
          bloomSelectionKeyRef.current = key;
        }
      }
    }

    const lens = lensRef.current;
    if (lens && t.lensDistortion > 0.001) {
      const amount = t.lensDistortion * 0.18;
      lensDistScratch.set(amount, amount * 0.92);
      lens.distortion = lensDistScratch;
    }

    const tilt = tiltRef.current;
    if (tilt && t.tiltShift > 0.001) {
      const amount = clamp01(t.tiltShift);
      tilt.focusArea = Math.max(0.12, 0.55 - amount * 0.28);
      tilt.feather = 0.22 + amount * 0.35;
      tilt.blendMode.opacity.value = clamp01(0.35 + amount * 0.65);
    }

    const rays = godRaysRef.current;
    if (rays && t.godRays > 0.001) {
      const mat = rays.godRaysMaterial;
      if (mat) {
        mat.density = 0.88 + t.godRays * 0.08;
        mat.weight = 0.25 + t.godRays * 0.45;
        mat.exposure = 0.35 + t.godRays * 0.55;
      }
      rays.blendMode.opacity.value = clamp01(0.25 + t.godRays * 0.75);
    }

    if (sparklesRef.current && t.sparkle > 0.001) {
      const pos = sparklesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const base = sparklesRef.current.geometry.getAttribute("aBase") as THREE.BufferAttribute | undefined;
      const phase = sparklesRef.current.geometry.getAttribute("aPhase") as THREE.BufferAttribute | undefined;
      const speed = sparklesRef.current.geometry.getAttribute("aSpeed") as THREE.BufferAttribute | undefined;
      const time = state.clock.elapsedTime;
      for (let i = 0; i < pos.count; i += 1) {
        const p = phase?.getX(i) ?? 0;
        const s = speed?.getX(i) ?? 0.5;
        const bx = base?.getX(i) ?? pos.getX(i);
        const by = base?.getY(i) ?? pos.getY(i);
        const bz = base?.getZ(i) ?? pos.getZ(i);
        pos.setXYZ(
          i,
          bx + Math.sin(time * s * 0.7 + p) * 0.08,
          by + Math.sin(time * s + p) * 0.12,
          bz + Math.cos(time * s * 0.55 + p) * 0.08,
        );
      }
      pos.needsUpdate = true;
      const mat = sparklesRef.current.material as THREE.PointsMaterial;
      mat.opacity = clamp01(0.25 + t.sparkle * 0.75) * clamp01(t.sparkleIntensity)
        * (0.65 + 0.35 * Math.sin(time * 2.2));
      mat.size = 0.16 + t.sparkle * 0.28;
      sparklesRef.current.rotation.y = time * 0.02;
    }

    const grain = grainRef.current;
    if (grain && t.grain > 0.001) {
      grain.blendMode.opacity.value = clamp01(t.grain * 0.55);
    }

    const dof = dofRef.current;
    if (dof && t.dof > 0.001) {
      let focus = t.dofFocus;
      if (t.dofLockModel) {
        const store = useMmdStudioStore.getState();
        if (resolveModelFocusWorld(scene, store.selectedModelId, store.models, focusScratch)) {
          focus = camera.position.distanceTo(focusScratch);
        }
      }
      const coc = dof.cocMaterial;
      if (coc) {
        coc.focusDistance = Math.max(0.5, focus);
        coc.focusRange = Math.max(0.5, t.dofRange);
      }
      const aperture = Math.max(0.05, t.dofAperture);
      dof.bokehScale = (0.25 + t.dof * 2.8) * aperture;
    }

    // Sync composer to renderer logical size (EffectComposer multiplies by DPR).
    // Never skip the frame on resize failure — that leaves a black canvas.
    const renderer = state.gl as THREE.WebGLRenderer;
    if (isGlContextLost(renderer)) return;
    renderer.getSize(sizeScratch);
    const lw = Math.max(1, Math.round(sizeScratch.x));
    const lh = Math.max(1, Math.round(sizeScratch.y));
    const dpr = Math.max(1, renderer.getPixelRatio() || 1);
    const wantW = Math.round(lw * dpr);
    const wantH = Math.round(lh * dpr);
    if (
      composer.inputBuffer
      && (composer.inputBuffer.width !== wantW || composer.inputBuffer.height !== wantH)
    ) {
      resizeComposerToRenderer(composer, renderer, sizeScratch);
    }

    state.gl.autoClear = true;
    try {
      composer.render(delta);
    } catch {
      // Context lost / incomplete FBO — fall back to direct scene render.
      try {
        renderer.render(scene, camera);
      } catch {
        // ignore
      }
    }
  }, 1);

  useEffect(() => () => {
    try {
      composer?.dispose();
    } catch {
      // ignore
    }
  }, [composer]);

  return null;
}
