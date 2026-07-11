import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  KernelSize,
  LUT3DEffect,
  NoiseEffect,
  NormalPass,
  OutlineEffect,
  OverrideMaterialManager,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  SSAOEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  resolvePostFxTune,
  useMmdStudioStore,
  type MmdLutLook,
  type MmdPostFxPreset,
  type MmdPostFxTune,
  type MmdSmaaQuality,
} from "./mmdStudioStore";

OverrideMaterialManager.workaroundEnabled = true;

function smaaFromQuality(quality: MmdSmaaQuality) {
  if (quality === "low") return SMAAPreset.LOW;
  if (quality === "high") return SMAAPreset.HIGH;
  if (quality === "ultra") return SMAAPreset.ULTRA;
  return SMAAPreset.MEDIUM;
}

function hasGrade(tune: MmdPostFxTune) {
  return (
    tune.bloom > 0.001
    || tune.vignette > 0.001
    || Math.abs(tune.brightness) > 0.001
    || Math.abs(tune.contrast) > 0.001
    || Math.abs(tune.saturation) > 0.001
    || tune.chroma > 0.001
    || tune.toneMapping
    || tune.dof > 0.001
    || tune.grain > 0.001
    || tune.ssao > 0.001
    || tune.outline > 0.001
    || tune.lut !== "none"
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Procedural 3D LUT — MME-like color grade without external .cube files. */
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
          // film: slight S-curve + teal shadows / orange mids
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

function collectOutlineTargets(scene: THREE.Scene) {
  const targets: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.visible) return;
    // Prefer skinned / MMD body meshes; skip helpers, ground, shadows
    if (mesh.type === "SkinnedMesh" || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      targets.push(mesh);
      return;
    }
    const name = (mesh.name || "").toLowerCase();
    if (name.includes("grid") || name.includes("shadow") || name.includes("helper")) return;
    if (mesh.userData?.mmdOutline === false) return;
  });
  return targets;
}

/**
 * WebGL post stack (WebGPU forced off in store).
 * Select only primitive store fields — never call object-returning helpers in selectors.
 */
export function MmdPostFx({ preset }: { preset: MmdPostFxPreset }) {
  const { gl, scene, camera, size } = useThree();
  const backend = useMmdStudioStore((state) => state.backend);
  const postFx = useMmdStudioStore((state) => state.postFx);
  const postFxTune = useMmdStudioStore((state) => state.postFxTune);
  const models = useMmdStudioStore((state) => state.models);
  const modelOutlineKey = useMemo(
    () => models.map((item) => `${item.id}:${item.visible ? 1 : 0}`).join("|"),
    [models],
  );
  const tune = useMemo(
    () => resolvePostFxTune(backend, postFx, postFxTune),
    [backend, postFx, postFxTune],
  );

  const composer = useMemo(() => {
    const supportsMsaa = Boolean(gl.capabilities?.isWebGL2);
    const samples = supportsMsaa ? tune.msaa : 0;
    const next = new EffectComposer(gl, {
      multisampling: samples,
      frameBufferType: THREE.HalfFloatType,
      depthBuffer: true,
    });
    next.addPass(new RenderPass(scene, camera));
    return next;
  }, [camera, gl, scene, tune.msaa]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.height, size.width]);

  useEffect(() => {
    while (composer.passes.length > 1) {
      const pass = composer.passes[composer.passes.length - 1];
      composer.removePass(pass);
      pass.dispose();
    }
    if (preset === "off") return;

    const disposableTextures: THREE.Texture[] = [];
    const grade: ConstructorParameters<typeof EffectPass>[1][] = [];
    let normalPass: NormalPass | null = null;

    if (hasGrade(tune)) {
      if (tune.ssao > 0.001) {
        normalPass = new NormalPass(scene, camera);
        composer.addPass(normalPass);
        const ssao = new SSAOEffect(camera, normalPass.texture, {
          blendFunction: BlendFunction.MULTIPLY,
          samples: 11,
          rings: 5,
          intensity: 0.4 + tune.ssao * 1.8,
          radius: 0.08 + tune.ssao * 0.12,
          luminanceInfluence: 0.55,
          bias: 0.03,
          fade: 0.02,
          resolutionScale: 0.65,
          worldDistanceThreshold: 40,
          worldDistanceFalloff: 12,
          worldProximityThreshold: 0.6,
          worldProximityFalloff: 0.25,
        });
        ssao.blendMode.opacity.value = clamp01(0.35 + tune.ssao * 0.65);
        grade.push(ssao);
      }

      if (tune.outline > 0.001) {
        const outline = new OutlineEffect(scene, camera, {
          blendFunction: BlendFunction.SCREEN,
          edgeStrength: 0.8 + tune.outline * 2.4,
          pulseSpeed: 0,
          visibleEdgeColor: 0x1a1a22,
          hiddenEdgeColor: 0x000000,
          kernelSize: KernelSize.SMALL,
          blur: true,
          xRay: false,
          multisampling: 0,
          resolutionScale: 0.6,
        });
        outline.blendMode.opacity.value = clamp01(tune.outline);
        const targets = collectOutlineTargets(scene);
        outline.selection.clear();
        for (const target of targets) outline.selection.add(target);
        grade.push(outline);
      }

      if (tune.dof > 0.001) {
        const dof = new DepthOfFieldEffect(camera, {
          focusDistance: tune.dofFocus,
          focusRange: Math.max(1, tune.dofRange),
          bokehScale: 0.4 + tune.dof * 3.2,
          resolutionScale: 0.55,
        });
        grade.push(dof);
      }

      if (tune.bloom > 0.001) {
        grade.push(
          new BloomEffect({
            intensity: tune.bloom,
            luminanceThreshold: tune.bloomThreshold,
            luminanceSmoothing: 0.22,
            mipmapBlur: true,
            kernelSize: KernelSize.MEDIUM,
            radius: 0.45 + tune.bloom * 0.5,
          }),
        );
      }
      if (Math.abs(tune.saturation) > 0.001) {
        grade.push(new HueSaturationEffect({ saturation: tune.saturation }));
      }
      if (Math.abs(tune.brightness) > 0.001 || Math.abs(tune.contrast) > 0.001) {
        grade.push(new BrightnessContrastEffect({ brightness: tune.brightness, contrast: tune.contrast }));
      }
      if (tune.chroma > 0.001) {
        const amount = 0.0002 + tune.chroma * 0.0012;
        grade.push(
          new ChromaticAberrationEffect({
            offset: new THREE.Vector2(amount, amount),
            radialModulation: true,
            modulationOffset: 0.18,
          }),
        );
      }
      if (tune.vignette > 0.001) {
        grade.push(new VignetteEffect({ darkness: tune.vignette, offset: 0.34 }));
      }
      if (tune.toneMapping) {
        grade.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      }

      if (tune.lut !== "none") {
        const lutTex = createGradeLut(tune.lut);
        if (lutTex) {
          disposableTextures.push(lutTex);
          grade.push(new LUT3DEffect(lutTex));
        }
      }

      if (tune.grain > 0.001) {
        const noise = new NoiseEffect({
          blendFunction: BlendFunction.SOFT_LIGHT,
          premultiply: true,
        });
        noise.blendMode.opacity.value = clamp01(tune.grain * 0.55);
        grade.push(noise);
      }
    }

    if (grade.length) composer.addPass(new EffectPass(camera, ...grade));
    composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: smaaFromQuality(tune.smaa) })));

    return () => {
      while (composer.passes.length > 1) {
        const pass = composer.passes[composer.passes.length - 1];
        composer.removePass(pass);
        pass.dispose();
      }
      for (const texture of disposableTextures) texture.dispose();
    };
  }, [camera, composer, modelOutlineKey, preset, scene, tune]);

  useFrame((state, delta) => {
    if (preset === "off") return;
    // Composer owns the frame; keep autoClear true so RenderPass starts clean.
    // Priority 1 runs after R3F's default pass; we clear by re-rendering into composer only.
    // Suppress redundant default buffer by rendering composer last (covers canvas).
    state.gl.autoClear = true;
    composer.render(delta);
  }, 1);

  useEffect(() => () => composer.dispose(), [composer]);

  return null;
}
