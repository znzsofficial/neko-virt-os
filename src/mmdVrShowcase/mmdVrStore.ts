import { create } from "zustand";
import { createLocalPrefsStorage } from "../shared/localPrefs";
import {
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation,
  normalizeImmersiveQuality,
  normalizeImmersiveToggle,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveRenderQuality,
  type ImmersiveTogglePref,
  normalizeXrThemeColor,
  type XrThemeColor,
} from "../xr";
import { endMmdVrAssetSession } from "./mmdVrAssets";
import { resetMmdVrClock } from "./mmdVrClock";
import type { MmdPhysicsQuality } from "../appModules/mmdStudio/mmdPhysics";
import { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale, normalizeMmdVrViewDistance } from "./mmdVrAdjustments";

export { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale } from "./mmdVrAdjustments";

export type MmdVrRenderQuality = ImmersiveRenderQuality;
export type MmdVrDprPref = ImmersiveDprPref;
export type MmdVrFrameRatePref = "auto" | "72" | "80" | "90" | "120";
export type MmdVrAntialiasPref = ImmersiveAntialiasPref;
export type MmdVrTogglePref = ImmersiveTogglePref;
export type MmdVrWalkSpeedPref = "auto" | "slow" | "normal" | "fast";
export type MmdVrLightPreset = "stage" | "soft" | "contrast" | "daylight" | "warm" | "rim";
export type MmdVrShadowResolutionPref = "auto" | "low" | "medium" | "high";
export type MmdVrSnapTurnDegrees = 15 | 30 | 45;

export type MmdVrSessionPhase = "idle" | "entering" | "active" | "error";

export type MmdVrModelEntry = {
  id: string;
  name: string;
  visible: boolean;
  scale: number;
  rotationY: number;
};

export type MmdVrPrefs = {
  renderQuality: MmdVrRenderQuality;
  showFps: boolean;
  loop: boolean;
  dprPref: MmdVrDprPref;
  frameRatePref: MmdVrFrameRatePref;
  antialiasPref: MmdVrAntialiasPref;
  shadowsPref: MmdVrTogglePref;
  gridPref: MmdVrTogglePref;
  walkSpeedPref: MmdVrWalkSpeedPref;
  lightPreset: MmdVrLightPreset;
  framebufferScalePref: ImmersiveFramebufferScalePref;
  foveationPref: ImmersiveFoveationPref;
  shadowResolutionPref: MmdVrShadowResolutionPref;
  heightOffset: number;
  themeColor: XrThemeColor;
  viewDistance: number;
  snapTurnDegrees: MmdVrSnapTurnDegrees;
  exposure: number;
  advancedRenderOverrides: boolean;
  detailedPhysicsDiagnostics: boolean;
};

export const MMD_VR_PREFS_KEY = "neko-virt-os.mmd-vr-showcase.v2";
export const MMD_VR_PREFS_LEGACY_KEY = "neko-virt-os.mmd-vr-showcase.v1";

type MmdVrStore = {
  prefs: MmdVrPrefs;
  setPrefs: (patch: Partial<MmdVrPrefs>) => void;
  setHeightOffsetTransient: (heightOffset: number) => void;
  phase: MmdVrSessionPhase;
  errorMessage: string | null;
  lastError: string | null;
  setLastError: (value: string | null) => void;
  setPhase: (phase: MmdVrSessionPhase, errorMessage?: string | null) => void;
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  failEnter: (errorMessage?: string | null) => void;
  markEntered: () => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  loop: boolean;
  setLoop: (loop: boolean) => void;
  statusLine: string | null;
  setStatusLine: (line: string | null) => void;
  physicsEnabled: boolean;
  setPhysicsEnabled: (enabled: boolean) => void;
  physicsDebugEnabled: boolean;
  setPhysicsDebugEnabled: (enabled: boolean) => void;
  physicsControllerCollisions: boolean;
  setPhysicsControllerCollisions: (enabled: boolean) => void;
  physicsColliderRadius: number;
  cyclePhysicsColliderRadius: () => void;
  physicsQuality: MmdPhysicsQuality;
  cyclePhysicsQuality: () => void;
  physicsHapticsEnabled: boolean;
  setPhysicsHapticsEnabled: (enabled: boolean) => void;
  physicsResetEpoch: number;
  requestPhysicsReset: () => void;
  physicsBusy: boolean;
  setPhysicsBusy: (busy: boolean) => void;
  physicsContactCount: number;
  setPhysicsContactCount: (count: number) => void;
  physicsControllerContactCounts: [number, number];
  setPhysicsControllerContactCounts: (counts: [number, number]) => void;
  physicsDynamicBodyCount: number;
  setPhysicsDynamicBodyCount: (count: number) => void;
  physicsRigidBodyCount: number;
  physicsStepCount: number;
  setPhysicsRuntimeStats: (rigidBodies: number, steps: number) => void;
  modelCount: number;
  models: MmdVrModelEntry[];
  setModels: (models: MmdVrModelEntry[]) => void;
  /** FIFO of model ids for stage to toggle visibility. */
  pendingVisibilityToggles: string[];
  enqueueVisibilityToggle: (id: string) => void;
  takeVisibilityToggles: () => string[];
  pendingModelRemovals: string[];
  enqueueModelRemoval: (id: string) => void;
  takeModelRemovals: () => string[];
  /** Ray-point ground place (M13). */
  placeMode: boolean;
  setPlaceMode: (on: boolean) => void;
  placeModelId: string | null;
  setPlaceModelId: (id: string | null) => void;
  pendingGroundPlace: { x: number; z: number } | null;
  requestGroundPlace: (x: number, z: number) => void;
  takeGroundPlace: () => { x: number; z: number } | null;
  pendingModelTransforms: { id: string; scale?: number; rotationY?: number; reset?: boolean }[];
  requestModelScale: (id: string, scale: number) => void;
  requestModelRotation: (id: string, rotationY: number) => void;
  requestModelReset: (id: string) => void;
  takeModelTransformRequests: () => { id: string; scale?: number; rotationY?: number; reset?: boolean }[];
  duration: number;
  setDuration: (n: number) => void;
  seekEpoch: number;
  seekSeconds: number;
  requestSeek: (seconds: number) => void;
  viewEpoch: number;
  resetView: () => void;
  cycleLightPreset: () => void;
};

const LIGHT_ORDER: MmdVrLightPreset[] = ["stage", "soft", "daylight", "warm", "rim", "contrast"];

function normalizeWalk(value: unknown): MmdVrWalkSpeedPref {
  if (value === "auto" || value === "slow" || value === "normal" || value === "fast") return value;
  return "auto";
}

function normalizeLight(value: unknown): MmdVrLightPreset {
  if (value === "stage" || value === "soft" || value === "contrast"
    || value === "daylight" || value === "warm" || value === "rim") return value;
  return "stage";
}

function normalizeShadowResolution(value: unknown): MmdVrShadowResolutionPref {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

export function normalizeMmdVrFrameRate(value: unknown): MmdVrFrameRatePref {
  if (value === "auto" || value === "72" || value === "80" || value === "90" || value === "120") return value;
  if (value === "low") return "72";
  if (value === "mid") return "90";
  if (value === "high") return "120";
  return "auto";
}

export function normalizeMmdVrSnapTurnDegrees(value: unknown): MmdVrSnapTurnDegrees {
  return value === 15 || value === 45 ? value : 30;
}

export function normalizeMmdVrExposure(value: unknown): number {
  const exposure = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.round(Math.min(1.3, Math.max(0.7, exposure)) * 10) / 10;
}

export function normalizeMmdVrPrefs(parsed: Partial<MmdVrPrefs> = {}): MmdVrPrefs {
  return {
    renderQuality: normalizeImmersiveQuality(parsed.renderQuality),
    showFps: Boolean(parsed.showFps),
    loop: parsed.loop !== false,
    dprPref: normalizeImmersiveDpr(parsed.dprPref),
    frameRatePref: normalizeMmdVrFrameRate(parsed.frameRatePref),
    antialiasPref: normalizeImmersiveAntialias(parsed.antialiasPref),
    shadowsPref: normalizeImmersiveToggle(parsed.shadowsPref),
    gridPref: normalizeImmersiveToggle(parsed.gridPref),
    walkSpeedPref: normalizeWalk(parsed.walkSpeedPref),
    lightPreset: normalizeLight(parsed.lightPreset),
    framebufferScalePref: normalizeImmersiveFramebufferScale(parsed.framebufferScalePref),
    foveationPref: normalizeImmersiveFoveation(parsed.foveationPref),
    shadowResolutionPref: normalizeShadowResolution(parsed.shadowResolutionPref),
    heightOffset: normalizeMmdVrHeightOffset(parsed.heightOffset),
    themeColor: normalizeXrThemeColor(parsed.themeColor),
    viewDistance: normalizeMmdVrViewDistance(parsed.viewDistance),
    snapTurnDegrees: normalizeMmdVrSnapTurnDegrees(parsed.snapTurnDegrees),
    exposure: normalizeMmdVrExposure(parsed.exposure),
    advancedRenderOverrides: Boolean(parsed.advancedRenderOverrides),
    detailedPhysicsDiagnostics: Boolean(parsed.detailedPhysicsDiagnostics),
  };
}

const prefsStorage = createLocalPrefsStorage<MmdVrPrefs>({
  key: MMD_VR_PREFS_KEY,
  legacyKey: MMD_VR_PREFS_LEGACY_KEY,
  defaults: () => ({
    renderQuality: "balanced",
    showFps: false,
    loop: true,
    dprPref: "auto",
    frameRatePref: "auto",
    antialiasPref: "auto",
    shadowsPref: "auto",
    gridPref: "auto",
    walkSpeedPref: "auto",
    lightPreset: "stage",
    framebufferScalePref: "auto",
    foveationPref: "auto",
    shadowResolutionPref: "auto",
    heightOffset: 0,
    themeColor: "blue",
    viewDistance: 40,
    snapTurnDegrees: 30,
    exposure: 1,
    advancedRenderOverrides: false,
    detailedPhysicsDiagnostics: false,
  }),
  normalize: normalizeMmdVrPrefs,
});

function sessionReset() {
  resetMmdVrClock();
  return {
    playing: false,
    statusLine: null as string | null,
    physicsEnabled: false,
    physicsDebugEnabled: false,
    physicsControllerCollisions: true,
    physicsColliderRadius: 0.08,
    physicsQuality: "medium" as MmdPhysicsQuality,
    physicsHapticsEnabled: false,
    physicsResetEpoch: 0,
    physicsBusy: false,
    physicsContactCount: 0,
    physicsControllerContactCounts: [0, 0] as [number, number],
    physicsDynamicBodyCount: 0,
    physicsRigidBodyCount: 0,
    physicsStepCount: 0,
    modelCount: 0,
    models: [] as MmdVrModelEntry[],
    pendingVisibilityToggles: [] as string[],
    pendingModelRemovals: [] as string[],
    placeMode: false,
    placeModelId: null as string | null,
    pendingGroundPlace: null as { x: number; z: number } | null,
    pendingModelTransforms: [] as { id: string; scale?: number; rotationY?: number; reset?: boolean }[],
    duration: 0,
    seekEpoch: 0,
    seekSeconds: 0,
  };
}

const initialPrefs = prefsStorage.read();

export const useMmdVrStore = create<MmdVrStore>((set, get) => ({
  prefs: initialPrefs,
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    if (patch.renderQuality != null) prefs.renderQuality = normalizeImmersiveQuality(patch.renderQuality);
    if (patch.dprPref != null) prefs.dprPref = normalizeImmersiveDpr(patch.dprPref);
    if (patch.frameRatePref != null) prefs.frameRatePref = normalizeMmdVrFrameRate(patch.frameRatePref);
    if (patch.antialiasPref != null) prefs.antialiasPref = normalizeImmersiveAntialias(patch.antialiasPref);
    if (patch.shadowsPref != null) prefs.shadowsPref = normalizeImmersiveToggle(patch.shadowsPref);
    if (patch.gridPref != null) prefs.gridPref = normalizeImmersiveToggle(patch.gridPref);
    if (patch.walkSpeedPref != null) prefs.walkSpeedPref = normalizeWalk(patch.walkSpeedPref);
    if (patch.lightPreset != null) prefs.lightPreset = normalizeLight(patch.lightPreset);
    if (patch.framebufferScalePref != null) prefs.framebufferScalePref = normalizeImmersiveFramebufferScale(patch.framebufferScalePref);
    if (patch.foveationPref != null) prefs.foveationPref = normalizeImmersiveFoveation(patch.foveationPref);
    if (patch.shadowResolutionPref != null) prefs.shadowResolutionPref = normalizeShadowResolution(patch.shadowResolutionPref);
    if (patch.heightOffset != null) prefs.heightOffset = normalizeMmdVrHeightOffset(patch.heightOffset);
    if (patch.themeColor != null) prefs.themeColor = normalizeXrThemeColor(patch.themeColor);
    if (patch.viewDistance != null) prefs.viewDistance = normalizeMmdVrViewDistance(patch.viewDistance);
    if (patch.snapTurnDegrees != null) prefs.snapTurnDegrees = normalizeMmdVrSnapTurnDegrees(patch.snapTurnDegrees);
    if (patch.exposure != null) prefs.exposure = normalizeMmdVrExposure(patch.exposure);
    if (patch.advancedRenderOverrides != null) prefs.advancedRenderOverrides = Boolean(patch.advancedRenderOverrides);
    if (patch.detailedPhysicsDiagnostics != null) prefs.detailedPhysicsDiagnostics = Boolean(patch.detailedPhysicsDiagnostics);
    prefsStorage.write(prefs);
    set({ prefs, loop: prefs.loop });
  },
  setHeightOffsetTransient: (heightOffset) =>
    set((state) => ({
      prefs: { ...state.prefs, heightOffset: normalizeMmdVrHeightOffset(heightOffset) },
    })),
  phase: "idle",
  errorMessage: null,
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  setPhase: (phase, errorMessage = null) => set({ phase, errorMessage }),
  overlayOpen: false,
  openOverlay: () => set((state) => ({
    overlayOpen: true,
    errorMessage: null,
    lastError: null,
    physicsDebugEnabled: state.prefs.detailedPhysicsDiagnostics,
  })),
  closeOverlay: () => {
    endMmdVrAssetSession();
    set({
      overlayOpen: false,
      phase: "idle",
      errorMessage: null,
      ...sessionReset(),
    });
  },
  failEnter: (errorMessage = "enter_failed") => {
    endMmdVrAssetSession();
    set({
      overlayOpen: false,
      phase: "error",
      errorMessage,
      lastError: errorMessage,
      ...sessionReset(),
    });
  },
  markEntered: () =>
    set({
      lastError: null,
      overlayOpen: true,
      errorMessage: null,
      phase: "entering",
    }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  loop: initialPrefs.loop,
  setLoop: (loop) => {
    const prefs = { ...get().prefs, loop };
    prefsStorage.write(prefs);
    set({ loop, prefs });
  },
  statusLine: null,
  setStatusLine: (statusLine) => set({ statusLine }),
  physicsEnabled: false,
  setPhysicsEnabled: (physicsEnabled) => set({ physicsEnabled }),
  physicsDebugEnabled: false,
  setPhysicsDebugEnabled: (physicsDebugEnabled) => set(physicsDebugEnabled
    ? { physicsDebugEnabled }
    : {
        physicsDebugEnabled,
        physicsContactCount: 0,
        physicsControllerContactCounts: [0, 0],
        physicsDynamicBodyCount: 0,
        physicsRigidBodyCount: 0,
        physicsStepCount: 0,
      }),
  physicsControllerCollisions: true,
  setPhysicsControllerCollisions: (physicsControllerCollisions) => set({ physicsControllerCollisions }),
  physicsColliderRadius: 0.08,
  cyclePhysicsColliderRadius: () => set((state) => {
    const radii = [0.04, 0.08, 0.12, 0.16];
    const index = radii.indexOf(state.physicsColliderRadius);
    return { physicsColliderRadius: radii[(index + 1) % radii.length] };
  }),
  physicsQuality: "medium",
  cyclePhysicsQuality: () => set((state) => ({
    physicsQuality: state.physicsQuality === "low" ? "medium" : state.physicsQuality === "medium" ? "high" : "low",
  })),
  physicsHapticsEnabled: false,
  setPhysicsHapticsEnabled: (physicsHapticsEnabled) => set(physicsHapticsEnabled
    ? { physicsHapticsEnabled }
    : { physicsHapticsEnabled, physicsControllerContactCounts: [0, 0] }),
  physicsResetEpoch: 0,
  requestPhysicsReset: () => set((state) => ({ physicsResetEpoch: state.physicsResetEpoch + 1 })),
  physicsBusy: false,
  setPhysicsBusy: (physicsBusy) => set({ physicsBusy }),
  physicsContactCount: 0,
  setPhysicsContactCount: (physicsContactCount) => set({ physicsContactCount }),
  physicsControllerContactCounts: [0, 0],
  setPhysicsControllerContactCounts: (physicsControllerContactCounts) => set({ physicsControllerContactCounts }),
  physicsDynamicBodyCount: 0,
  setPhysicsDynamicBodyCount: (physicsDynamicBodyCount) => set({ physicsDynamicBodyCount }),
  physicsRigidBodyCount: 0,
  physicsStepCount: 0,
  setPhysicsRuntimeStats: (physicsRigidBodyCount, physicsStepCount) => set({ physicsRigidBodyCount, physicsStepCount }),
  modelCount: 0,
  models: [],
  setModels: (models) =>
    set((s) => ({
      models,
      modelCount: models.length,
      placeModelId:
        s.placeModelId && models.some((m) => m.id === s.placeModelId)
          ? s.placeModelId
          : models[0]?.id ?? null,
    })),
  pendingVisibilityToggles: [],
  enqueueVisibilityToggle: (id) =>
    set((s) => ({
      pendingVisibilityToggles: [...s.pendingVisibilityToggles, id],
    })),
  takeVisibilityToggles: () => {
    const list = get().pendingVisibilityToggles;
    if (!list.length) return [];
    set({ pendingVisibilityToggles: [] });
    return list;
  },
  pendingModelRemovals: [],
  enqueueModelRemoval: (id) => set((state) => ({
    pendingModelRemovals: state.models.some((model) => model.id === id)
      ? [...new Set([...state.pendingModelRemovals, id])]
      : state.pendingModelRemovals,
  })),
  takeModelRemovals: () => {
    const list = get().pendingModelRemovals;
    if (!list.length) return [];
    set({ pendingModelRemovals: [] });
    return list;
  },
  placeMode: false,
  setPlaceMode: (placeMode) => {
    const models = get().models;
    const nextId =
      get().placeModelId && models.some((m) => m.id === get().placeModelId)
        ? get().placeModelId
        : models[0]?.id ?? null;
    set({ placeMode, placeModelId: placeMode ? nextId : get().placeModelId });
  },
  placeModelId: null,
  setPlaceModelId: (placeModelId) => set({ placeModelId }),
  pendingGroundPlace: null,
  requestGroundPlace: (x, z) => {
    if (!get().placeMode) return;
    const clampedX = Math.min(5.5, Math.max(-5.5, x));
    const clampedZ = Math.min(5.5, Math.max(-5.5, z));
    set({ pendingGroundPlace: { x: clampedX, z: clampedZ } });
  },
  takeGroundPlace: () => {
    const p = get().pendingGroundPlace;
    if (!p) return null;
    set({ pendingGroundPlace: null });
    return p;
  },
  pendingModelTransforms: [],
  requestModelScale: (id, scale) => {
    const normalized = normalizeMmdVrModelScale(scale);
    set((s) => {
      const previous = s.pendingModelTransforms.find((request) => request.id === id);
      return {
        models: s.models.map((model) => model.id === id ? { ...model, scale: normalized } : model),
        pendingModelTransforms: [
          ...s.pendingModelTransforms.filter((request) => request.id !== id),
          { ...previous, id, scale: normalized },
        ],
      };
    });
  },
  requestModelRotation: (id, rotationY) => {
    const normalized = ((rotationY % 360) + 360) % 360;
    set((s) => {
      const previous = s.pendingModelTransforms.find((request) => request.id === id);
      return {
        models: s.models.map((model) => model.id === id ? { ...model, rotationY: normalized } : model),
        pendingModelTransforms: [
          ...s.pendingModelTransforms.filter((request) => request.id !== id),
          { ...previous, id, rotationY: normalized },
        ],
      };
    });
  },
  requestModelReset: (id) => {
    set((s) => ({
      models: s.models.map((model) => model.id === id ? { ...model, scale: 1, rotationY: 0 } : model),
      pendingModelTransforms: [
        ...s.pendingModelTransforms.filter((request) => request.id !== id),
        { id, reset: true },
      ],
    }));
  },
  takeModelTransformRequests: () => {
    const requests = get().pendingModelTransforms;
    if (!requests.length) return [];
    set({ pendingModelTransforms: [] });
    return requests;
  },
  duration: 0,
  setDuration: (duration) => set({ duration }),
  seekEpoch: 0,
  seekSeconds: 0,
  requestSeek: (seconds) =>
    set((s) => ({
      seekEpoch: s.seekEpoch + 1,
      seekSeconds: Math.max(0, seconds),
    })),
  viewEpoch: 0,
  resetView: () => set((s) => ({ viewEpoch: s.viewEpoch + 1 })),
  cycleLightPreset: () => {
    const cur = get().prefs.lightPreset;
    const idx = LIGHT_ORDER.indexOf(cur);
    const next = LIGHT_ORDER[(idx + 1) % LIGHT_ORDER.length];
    get().setPrefs({ lightPreset: next });
  },
}));
