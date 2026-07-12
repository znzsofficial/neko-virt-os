import {
  applyMmdCameraStateToThreeCamera,
  createMmdTextureMapFromFiles,
  syncMmdSpecularDirection,
  ThreeMmdLoader,
  type TextureMap,
} from "@yohawing/three-mmd-loader";
import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import * as THREE from "three";
import { createBulletPhysicsBackend } from "./mmdPhysics";
import {
  applyMaterialOverrides,
  applyMaterialVisibility,
  createDefaultMaterialOverrides,
  mergeMaterialOverride,
  refreshMaterialTextures,
  stripWebGlOnlyMaterialShaders,
  type MaterialOverride,
} from "./mmdRuntimeMaterials";
import {
  applyModelTransform,
  applyMorphOverrides,
  cloneTransform,
  DEFAULT_MODEL_TRANSFORM,
  disposeModelObject,
  enableModelShadows,
  enforceModelCastOnlyShadows,
  extractMaterialNames,
  extractMorphNames,
  recomputeEntryAnimation,
  toSnapshot,
  type MmdModelTransform,
  type RuntimeEntry,
  type RuntimeModelSnapshot,
} from "./mmdRuntimeEntry";

export type { MaterialOverride } from "./mmdRuntimeMaterials";
export type { MmdModelTransform, RuntimeModelSnapshot } from "./mmdRuntimeEntry";
export { cloneTransform, DEFAULT_MODEL_TRANSFORM };

export type MmdLoadReport = {
  textureCount: number;
  missingTextures: string[];
  textureWarnings: string[];
  modelId: string;
  morphNames: string[];
  materialNames: string[];
};

export type MmdMotionSlot = "body" | "face";

export type MmdProjectModelAssets = {
  id: string;
  name: string;
  visible: boolean;
  morphWeights: Record<string, number>;
  morphFavorites: string[];
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
  modelFile: File;
  companionFiles: File[];
  bodyMotionFile: File | null;
  faceMotionFile: File | null;
  transform: MmdModelTransform;
};

export type MmdAddModelOptions = {
  physics?: boolean;
  preferredId?: string;
  transform?: Partial<MmdModelTransform>;
  /** @deprecated use transform.positionX */
  offsetX?: number;
};

export type MmdRuntimeHandle = {
  hasCameraTrack: boolean;
  duration: number;
  selectedId: string | null;
  listModels: () => RuntimeModelSnapshot[];
  exportProjectModels: () => MmdProjectModelAssets[];
  clearAll: () => void;
  addModel: (modelFile: File, companionFiles?: readonly File[], options?: MmdAddModelOptions) => Promise<MmdLoadReport>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  setModelVisible: (id: string, visible: boolean) => void;
  setModelTransform: (id: string, patch: Partial<MmdModelTransform>) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialOverride: (modelId: string, materialName: string, patch: Partial<MaterialOverride>) => void;
  setLighting: (options: { envIntensity: number; directionalLight: THREE.DirectionalLight | null }) => void;
  setPhysicsEnabled: (enabled: boolean) => Promise<void>;
  update: (seconds: number, physics: boolean, camera: THREE.PerspectiveCamera, aspect: number, useMotionCamera: boolean) => void;
  dispose: () => void;
};

let nextModelSeq = 1;

function buildTextureMap(modelFile: File, companionFiles: readonly File[] = []): TextureMap {
  const allFiles = companionFiles.length ? companionFiles : [modelFile];
  const baseMap = createMmdTextureMapFromFiles(allFiles, modelFile) as Record<string, File | string>;
  // Index by basename so loads without webkitRelativePath (old project DB rows)
  // still resolve nested PMX refs like "tex/foo.png" -> "foo.png".
  const byBaseName = new Map<string, File>();
  for (const file of allFiles) {
    byBaseName.set(file.name.toLowerCase(), file);
  }
  for (const [key, value] of Object.entries(baseMap)) {
    if (typeof value === "string" || !value) continue;
    const base = key.split(/[/\\]/).pop();
    if (base) {
      baseMap[base] = value;
      byBaseName.set(base.toLowerCase(), value);
    }
  }

  return new Proxy(baseMap, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
      const direct = Reflect.get(target, prop, receiver);
      if (direct !== undefined) return direct;
      const normalized = prop.replaceAll("\\", "/").replace(/^\.\/+/, "");
      const nested = Reflect.get(target, normalized, receiver);
      if (nested !== undefined) return nested;
      const base = normalized.split("/").pop();
      if (!base) return undefined;
      return Reflect.get(target, base, receiver) ?? byBaseName.get(base.toLowerCase());
    },
  }) as TextureMap;
}

export type MmdRuntimeOptions = {
  /** When true, strip WebGL-only MMD shaders and use MeshStandard for scene lights. */
  webGpu?: boolean;
};

export function createMmdRuntimeHandle(scene: THREE.Scene, options: MmdRuntimeOptions = {}): MmdRuntimeHandle {
  const entries = new Map<string, RuntimeEntry>();
  let selectedId: string | null = null;
  let physicsBackend: MmdPhysicsBackend | null = null;
  let physicsWanted = false;
  let duration = 0;
  let hasCameraTrack = false;
  let envIntensity = 0;
  let directionalLight: THREE.DirectionalLight | null = null;
  const webGpuMode = Boolean(options.webGpu);

  function recomputeGlobal() {
    duration = 0;
    hasCameraTrack = false;
    for (const entry of entries.values()) {
      duration = Math.max(duration, entry.duration);
      if (entry.hasCameraTrack) hasCameraTrack = true;
    }
  }

  function disposePhysicsBackend() {
    physicsBackend?.dispose?.();
    physicsBackend = null;
  }

  async function ensurePhysicsBackend() {
    if (physicsBackend && !physicsBackend.disposed) return physicsBackend;
    physicsBackend = await createBulletPhysicsBackend();
    return physicsBackend;
  }

  function removeEntry(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    scene.remove(entry.model.root);
    disposeModelObject(entry);
    entries.delete(id);
    if (selectedId === id) {
      selectedId = entries.keys().next().value ?? null;
    }
    recomputeGlobal();
  }

  async function createEntry(
    modelFile: File,
    companionFiles: readonly File[],
    withPhysics: boolean,
    transform: MmdModelTransform,
    preferredId?: string,
  ) {
    const textureMap = buildTextureMap(modelFile, companionFiles);
    const runtimeOptions = withPhysics
      ? {
          physics: "external" as const,
          physicsBackend: await ensurePhysicsBackend(),
        }
      : { physics: "none" as const };

    const loader = new ThreeMmdLoader({
      textureMap,
      runtime: runtimeOptions,
    });
    const model = await loader.loadModel(modelFile);
    if (webGpuMode) {
      // Replace MMD MeshToon+onBeforeCompile with MeshStandard so scene lights work.
      stripWebGlOnlyMaterialShaders(model.root);
    }
    enableModelShadows(model);
    enforceModelCastOnlyShadows(model.root);
    scene.add(model.root);

    const morphNames = extractMorphNames(model);
    const materialNames = extractMaterialNames(model);
    const materialVisible: Record<string, boolean> = {};
    for (const name of materialNames) materialVisible[name] = true;

    const missingTextures = model.diagnostics.textures
      .filter((item) => item.code === "TEXTURE_RESOLVE_FAILED")
      .map((item) => item.path)
      .filter(Boolean);
    const textureWarnings = model.diagnostics.textures
      .map((item) => `${item.code}: ${item.path}`)
      .filter(Boolean);
    const uniqueTextureFiles = new Set(
      Object.keys(textureMap).filter((key) => !key.includes("/") && !key.includes("\\")),
    );

    let id = preferredId && !entries.has(preferredId) ? preferredId : `mmd-model-${nextModelSeq++}`;
    if (preferredId && entries.has(preferredId)) id = `mmd-model-${nextModelSeq++}`;
    const entry: RuntimeEntry = {
      id,
      name: modelFile.name,
      model,
      bodyAnimation: null,
      faceAnimation: null,
      appliedAnimation: null,
      bodyMotionName: null,
      faceMotionName: null,
      bodyMotionFile: null,
      faceMotionFile: null,
      visible: true,
      morphNames,
      materialNames,
      morphWeights: {},
      morphFavorites: [],
      materialVisible,
      materialOverrides: createDefaultMaterialOverrides(materialNames),
      transform: cloneTransform(transform),
      hasCameraTrack: false,
      duration: 0,
      modelFile,
      companionFiles: companionFiles.length ? [...companionFiles] : [modelFile],
    };
    entries.set(id, entry);
    applyModelTransform(entry);
    applyMaterialVisibility(entry);
    applyMaterialOverrides(entry, envIntensity);
    refreshMaterialTextures(entry);

    return {
      entry,
      report: {
        textureCount: uniqueTextureFiles.size || Object.keys(textureMap).length,
        missingTextures: [...new Set(missingTextures)],
        textureWarnings: [...new Set(textureWarnings)],
        modelId: id,
        morphNames,
        materialNames,
      } satisfies MmdLoadReport,
    };
  }

  async function rebuildAllModels(withPhysics: boolean) {
    const snapshots = [...entries.values()].map((entry) => ({
      id: entry.id,
      bodyAnimation: entry.bodyAnimation,
      faceAnimation: entry.faceAnimation,
      bodyMotionName: entry.bodyMotionName,
      faceMotionName: entry.faceMotionName,
      bodyMotionFile: entry.bodyMotionFile,
      faceMotionFile: entry.faceMotionFile,
      visible: entry.visible,
      morphWeights: { ...entry.morphWeights },
      materialVisible: { ...entry.materialVisible },
      materialOverrides: { ...entry.materialOverrides },
      modelFile: entry.modelFile,
      companionFiles: entry.companionFiles,
      transform: cloneTransform(entry.transform),
    }));
    const previousSelected = selectedId;
    for (const id of [...entries.keys()]) removeEntry(id);
    if (!withPhysics) disposePhysicsBackend();
    else await ensurePhysicsBackend();
    for (const snap of snapshots) {
      const { entry } = await createEntry(snap.modelFile, snap.companionFiles, withPhysics, snap.transform, snap.id);
      entry.bodyAnimation = snap.bodyAnimation;
      entry.faceAnimation = snap.faceAnimation;
      entry.bodyMotionName = snap.bodyMotionName;
      entry.faceMotionName = snap.faceMotionName;
      entry.bodyMotionFile = snap.bodyMotionFile;
      entry.faceMotionFile = snap.faceMotionFile;
      entry.visible = snap.visible;
      entry.morphWeights = snap.morphWeights;
      entry.materialVisible = { ...entry.materialVisible, ...snap.materialVisible };
      entry.materialOverrides = { ...entry.materialOverrides, ...snap.materialOverrides };
      recomputeEntryAnimation(entry);
      applyMaterialVisibility(entry);
      applyMaterialOverrides(entry, envIntensity);
      refreshMaterialTextures(entry);
    }
    selectedId = previousSelected && entries.has(previousSelected)
      ? previousSelected
      : entries.keys().next().value ?? null;
    recomputeGlobal();
  }

  return {
    get hasCameraTrack() {
      return hasCameraTrack;
    },
    get duration() {
      return duration;
    },
    get selectedId() {
      return selectedId;
    },
    listModels() {
      return [...entries.values()].map(toSnapshot);
    },
    exportProjectModels() {
      return [...entries.values()].map((entry) => ({
        id: entry.id,
        name: entry.name,
        visible: entry.visible,
        morphWeights: { ...entry.morphWeights },
        morphFavorites: [...entry.morphFavorites],
        materialVisible: { ...entry.materialVisible },
        materialOverrides: { ...entry.materialOverrides },
        modelFile: entry.modelFile,
        companionFiles: [...entry.companionFiles],
        bodyMotionFile: entry.bodyMotionFile,
        faceMotionFile: entry.faceMotionFile,
        transform: cloneTransform(entry.transform),
      }));
    },
    clearAll() {
      for (const id of [...entries.keys()]) removeEntry(id);
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
    },
    async addModel(modelFile, companionFiles = [], options = {}) {
      physicsWanted = Boolean(options.physics ?? physicsWanted);
      if (!physicsWanted) disposePhysicsBackend();
      const base: MmdModelTransform = {
        ...DEFAULT_MODEL_TRANSFORM,
        positionX: options.offsetX ?? entries.size * 1.35,
        ...options.transform,
      };
      const transform = cloneTransform(base);
      const { entry, report } = await createEntry(
        modelFile,
        companionFiles.length ? companionFiles : [modelFile],
        physicsWanted,
        transform,
        options.preferredId,
      );
      selectedId = entry.id;
      recomputeGlobal();
      return report;
    },
    removeModel(id) {
      removeEntry(id);
    },
    selectModel(id) {
      if (id && !entries.has(id)) return;
      selectedId = id;
    },
    setModelVisible(id, visible) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.visible = visible;
      applyMaterialVisibility(entry);
      applyMaterialOverrides(entry, envIntensity);
      refreshMaterialTextures(entry);
    },
    setModelTransform(id, patch) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.transform = {
        ...entry.transform,
        ...patch,
      };
      applyModelTransform(entry);
    },
    setMaterialOverride(modelId, materialName, patch) {
      const entry = entries.get(modelId);
      if (!entry) return;
      entry.materialOverrides[materialName] = mergeMaterialOverride(entry.materialOverrides[materialName], patch);
      applyMaterialOverrides(entry, envIntensity);
      refreshMaterialTextures(entry);
    },
    setLighting(options) {
      envIntensity = Math.max(0, options.envIntensity);
      directionalLight = options.directionalLight;
      for (const entry of entries.values()) {
        const materials = Array.isArray(entry.model.mesh.material) ? entry.model.mesh.material : [entry.model.mesh.material];
        if (directionalLight) syncMmdSpecularDirection(materials, directionalLight);
        applyMaterialOverrides(entry, envIntensity);
      }
    },
    async loadMotion(file, slot = "body", modelId = selectedId) {
      const id = modelId ?? selectedId;
      if (!id) throw new Error("No model selected");
      const entry = entries.get(id);
      if (!entry) throw new Error("Model not found");
      const loader = new ThreeMmdLoader();
      const animation = await loader.loadAnimation(file);
      if (slot === "face") {
        entry.faceAnimation = animation;
        entry.faceMotionName = file.name;
        entry.faceMotionFile = file;
      } else {
        entry.bodyAnimation = animation;
        entry.bodyMotionName = file.name;
        entry.bodyMotionFile = file;
      }
      recomputeEntryAnimation(entry);
      recomputeGlobal();
    },
    setMorphWeight(modelId, morphName, weight) {
      const entry = entries.get(modelId);
      if (!entry) return;
      const next = Math.min(1, Math.max(0, weight));
      if (next <= 0.001) {
        delete entry.morphWeights[morphName];
      } else {
        entry.morphWeights[morphName] = next;
      }
    },
    setMaterialVisible(modelId, materialName, visible) {
      const entry = entries.get(modelId);
      if (!entry) return;
      entry.materialVisible[materialName] = visible;
      applyMaterialVisibility(entry);
    },
    async setPhysicsEnabled(enabled) {
      const already = physicsWanted === enabled;
      const backendOk = !enabled || (physicsBackend != null && !physicsBackend.disposed);
      if (already && backendOk) return;
      physicsWanted = enabled;
      if (!entries.size) {
        if (!enabled) disposePhysicsBackend();
        else await ensurePhysicsBackend();
        return;
      }
      await rebuildAllModels(enabled);
    },
    update(seconds, physics, camera, aspect, useMotionCamera) {
      let cameraApplied = false;
      for (const entry of entries.values()) {
        if (!entry.visible) continue;
        entry.model.update(seconds, { physics: physics && physicsWanted, ik: true });
        // Keep user transform after animation/physics sampling.
        applyModelTransform(entry);
        applyMorphOverrides(entry);
        const materials = Array.isArray(entry.model.mesh.material) ? entry.model.mesh.material : [entry.model.mesh.material];
        if (directionalLight) syncMmdSpecularDirection(materials, directionalLight);
        applyMaterialOverrides(entry, envIntensity);
        // Material hooks may re-enable receive/self-shadow; keep ground-only receive.
        enforceModelCastOnlyShadows(entry.model.root);
        if (useMotionCamera && !cameraApplied && entry.hasCameraTrack) {
          const cameraState = entry.model.runtime.cameraState();
          if (cameraState) {
            applyMmdCameraStateToThreeCamera(camera, cameraState, { aspect });
            cameraApplied = true;
          }
        }
      }
    },
    dispose() {
      for (const id of [...entries.keys()]) removeEntry(id);
      disposePhysicsBackend();
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
      physicsWanted = false;
    },
  };
}
