import {
  applyMmdCameraStateToThreeCamera,
  createMmdTextureMapFromFiles,
  ThreeMmdLoader,
  type MmdAnimation,
  type ThreeMmdAnimation,
  type ThreeMmdModel,
  type TextureMap,
} from "@yohawing/three-mmd-loader";
import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import * as THREE from "three";
import { createBulletPhysicsBackend } from "./mmdPhysics";
import { getMmdAnimationDurationSeconds, mergeBodyFaceAnimations } from "./mmdUtils";

export type MmdLoadReport = {
  textureCount: number;
  missingTextures: string[];
  textureWarnings: string[];
  modelId: string;
  morphNames: string[];
  materialNames: string[];
};

export type MmdMotionSlot = "body" | "face";

export type RuntimeModelSnapshot = {
  id: string;
  name: string;
  visible: boolean;
  morphNames: string[];
  materialNames: string[];
  bodyMotionName: string | null;
  faceMotionName: string | null;
  morphWeights: Record<string, number>;
  materialVisible: Record<string, boolean>;
  hasCameraTrack: boolean;
  duration: number;
};

type RuntimeEntry = {
  id: string;
  name: string;
  model: ThreeMmdModel;
  bodyAnimation: ThreeMmdAnimation | null;
  faceAnimation: ThreeMmdAnimation | null;
  appliedAnimation: ThreeMmdAnimation | null;
  bodyMotionName: string | null;
  faceMotionName: string | null;
  bodyMotionFile: File | null;
  faceMotionFile: File | null;
  visible: boolean;
  morphNames: string[];
  materialNames: string[];
  morphWeights: Record<string, number>;
  materialVisible: Record<string, boolean>;
  hasCameraTrack: boolean;
  duration: number;
  modelFile: File;
  companionFiles: File[];
  offsetX: number;
};

export type MmdProjectModelAssets = {
  id: string;
  name: string;
  visible: boolean;
  morphWeights: Record<string, number>;
  materialVisible: Record<string, boolean>;
  modelFile: File;
  companionFiles: File[];
  bodyMotionFile: File | null;
  faceMotionFile: File | null;
  offsetX: number;
};

export type MmdRuntimeHandle = {
  hasCameraTrack: boolean;
  duration: number;
  selectedId: string | null;
  listModels: () => RuntimeModelSnapshot[];
  exportProjectModels: () => MmdProjectModelAssets[];
  clearAll: () => void;
  addModel: (modelFile: File, companionFiles?: readonly File[], options?: { physics?: boolean; offsetX?: number; preferredId?: string }) => Promise<MmdLoadReport>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  setModelVisible: (id: string, visible: boolean) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setPhysicsEnabled: (enabled: boolean) => Promise<void>;
  update: (seconds: number, physics: boolean, camera: THREE.PerspectiveCamera, aspect: number, useMotionCamera: boolean) => void;
  dispose: () => void;
};

let nextModelSeq = 1;

function buildTextureMap(modelFile: File, companionFiles: readonly File[] = []): TextureMap {
  const allFiles = companionFiles.length ? companionFiles : [modelFile];
  return createMmdTextureMapFromFiles(allFiles, modelFile);
}

function wrapMergedAnimation(animation: MmdAnimation): ThreeMmdAnimation {
  return {
    source: animation.bytes,
    name: "merged-body-face",
    animation,
  };
}

function extractMorphNames(model: ThreeMmdModel) {
  const dict = model.mesh.morphTargetDictionary ?? {};
  return Object.keys(dict).sort((a, b) => a.localeCompare(b, "zh"));
}

function extractMaterialNames(model: ThreeMmdModel) {
  const materials = Array.isArray(model.mesh.material) ? model.mesh.material : [model.mesh.material];
  const names = materials.map((material, index) => {
    const named = material?.name?.trim();
    return named || `Material ${index + 1}`;
  });
  return names;
}

function disposeModelObject(model: ThreeMmdModel) {
  model.root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
}

function applyMaterialVisibility(entry: RuntimeEntry) {
  const materials = Array.isArray(entry.model.mesh.material) ? entry.model.mesh.material : [entry.model.mesh.material];
  materials.forEach((material, index) => {
    if (!material) return;
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    const visible = entry.materialVisible[name] !== false;
    material.visible = visible && entry.visible;
  });

  // Keep outline / render-order proxies in sync when possible.
  for (const proxy of [...entry.model.outlineMeshes, ...entry.model.renderOrderMeshes]) {
    const mats = Array.isArray(proxy.material) ? proxy.material : [proxy.material];
    mats.forEach((material) => {
      if (!material) return;
      const name = material.name || entry.materialNames[0];
      const visible = !name || entry.materialVisible[name] !== false;
      material.visible = visible && entry.visible;
    });
    proxy.visible = entry.visible;
  }
  entry.model.root.visible = entry.visible;
  entry.model.mesh.visible = entry.visible;
}

function applyMorphOverrides(entry: RuntimeEntry) {
  const influences = entry.model.mesh.morphTargetInfluences;
  const dict = entry.model.mesh.morphTargetDictionary;
  if (!influences || !dict) return;
  for (const [name, weight] of Object.entries(entry.morphWeights)) {
    const index = dict[name];
    if (index == null) continue;
    // Manual override wins over VMD-sampled weight for that morph.
    influences[index] = Math.min(1, Math.max(0, weight));
  }
  // Propagate to morph-split body meshes if present.
  const bodies = (entry.model.mesh.userData as { mmdMorphSplitBodyMeshes?: THREE.SkinnedMesh[] }).mmdMorphSplitBodyMeshes;
  if (!Array.isArray(bodies)) return;
  for (const body of bodies) {
    const target = body.morphTargetInfluences;
    const map = body.userData?.mmdMorphSplit?.morphTargetIndices as Uint16Array | Uint32Array | undefined;
    if (!target || !map) continue;
    for (let i = 0; i < map.length; i += 1) {
      const sourceIndex = map[i];
      if (sourceIndex != null && sourceIndex < influences.length) target[i] = influences[sourceIndex] ?? 0;
    }
  }
}

function recomputeEntryAnimation(entry: RuntimeEntry) {
  if (!entry.bodyAnimation && !entry.faceAnimation) {
    entry.appliedAnimation = null;
    entry.hasCameraTrack = false;
    entry.duration = 0;
    return;
  }
  if (entry.bodyAnimation && entry.faceAnimation) {
    entry.appliedAnimation = wrapMergedAnimation(
      mergeBodyFaceAnimations(entry.bodyAnimation.animation, entry.faceAnimation.animation),
    );
  } else {
    entry.appliedAnimation = entry.bodyAnimation ?? entry.faceAnimation;
  }
  entry.hasCameraTrack = Boolean(entry.appliedAnimation?.animation.cameraFrames.length);
  entry.duration = entry.appliedAnimation
    ? getMmdAnimationDurationSeconds(entry.appliedAnimation.animation)
    : 0;
  if (entry.appliedAnimation) entry.model.setAnimation(entry.appliedAnimation);
}

function toSnapshot(entry: RuntimeEntry): RuntimeModelSnapshot {
  return {
    id: entry.id,
    name: entry.name,
    visible: entry.visible,
    morphNames: entry.morphNames,
    materialNames: entry.materialNames,
    bodyMotionName: entry.bodyMotionName,
    faceMotionName: entry.faceMotionName,
    morphWeights: { ...entry.morphWeights },
    materialVisible: { ...entry.materialVisible },
    hasCameraTrack: entry.hasCameraTrack,
    duration: entry.duration,
  };
}

export function createMmdRuntimeHandle(scene: THREE.Scene): MmdRuntimeHandle {
  const entries = new Map<string, RuntimeEntry>();
  let selectedId: string | null = null;
  let physicsBackend: MmdPhysicsBackend | null = null;
  let physicsWanted = false;
  let duration = 0;
  let hasCameraTrack = false;

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
    disposeModelObject(entry.model);
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
    offsetX: number,
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
    model.root.position.x = offsetX;
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
      materialVisible,
      hasCameraTrack: false,
      duration: 0,
      modelFile,
      companionFiles: companionFiles.length ? [...companionFiles] : [modelFile],
      offsetX,
    };
    entries.set(id, entry);
    applyMaterialVisibility(entry);

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
      modelFile: entry.modelFile,
      companionFiles: entry.companionFiles,
      offsetX: entry.offsetX,
    }));
    const previousSelected = selectedId;
    for (const id of [...entries.keys()]) removeEntry(id);
    if (!withPhysics) disposePhysicsBackend();
    else await ensurePhysicsBackend();
    for (const snap of snapshots) {
      const { entry } = await createEntry(snap.modelFile, snap.companionFiles, withPhysics, snap.offsetX, snap.id);
      entry.bodyAnimation = snap.bodyAnimation;
      entry.faceAnimation = snap.faceAnimation;
      entry.bodyMotionName = snap.bodyMotionName;
      entry.faceMotionName = snap.faceMotionName;
      entry.bodyMotionFile = snap.bodyMotionFile;
      entry.faceMotionFile = snap.faceMotionFile;
      entry.visible = snap.visible;
      entry.morphWeights = snap.morphWeights;
      entry.materialVisible = { ...entry.materialVisible, ...snap.materialVisible };
      recomputeEntryAnimation(entry);
      applyMaterialVisibility(entry);
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
        materialVisible: { ...entry.materialVisible },
        modelFile: entry.modelFile,
        companionFiles: [...entry.companionFiles],
        bodyMotionFile: entry.bodyMotionFile,
        faceMotionFile: entry.faceMotionFile,
        offsetX: entry.offsetX,
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
      const offsetX = options.offsetX ?? entries.size * 1.35;
      const { entry, report } = await createEntry(
        modelFile,
        companionFiles.length ? companionFiles : [modelFile],
        physicsWanted,
        offsetX,
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
        applyMorphOverrides(entry);
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
