import { create } from "zustand";
import { createLocalPrefsStorage } from "../shared/localPrefs";
import {
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFrameRate,
  normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation,
  normalizeImmersiveQuality,
  normalizeImmersiveToggle,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveRenderQuality,
  type ImmersiveTogglePref,
  normalizeXrThemeColor,
  type XrThemeColor,
} from "../xr";
import { endMmdVrAssetSession } from "./mmdVrAssets";
import { resetMmdVrClock } from "./mmdVrClock";
import { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale } from "./mmdVrAdjustments";

export { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale } from "./mmdVrAdjustments";

export type MmdVrRenderQuality = ImmersiveRenderQuality;
export type MmdVrDprPref = ImmersiveDprPref;
export type MmdVrFrameRatePref = ImmersiveFrameRatePref;
export type MmdVrAntialiasPref = ImmersiveAntialiasPref;
export type MmdVrTogglePref = ImmersiveTogglePref;
export type MmdVrWalkSpeedPref = "auto" | "slow" | "normal" | "fast";
export type MmdVrLightPreset = "stage" | "soft" | "contrast";
export type MmdVrShadowResolutionPref = "auto" | "low" | "medium" | "high";

export type MmdVrSessionPhase = "idle" | "entering" | "active" | "error";

export type MmdVrModelEntry = {
  id: string;
  name: string;
  visible: boolean;
  scale: number;
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
};

export const MMD_VR_PREFS_KEY = "neko-virt-os.mmd-vr-showcase.v2";
export const MMD_VR_PREFS_LEGACY_KEY = "neko-virt-os.mmd-vr-showcase.v1";

type MmdVrStore = {
  prefs: MmdVrPrefs;
  setPrefs: (patch: Partial<MmdVrPrefs>) => void;
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
  modelCount: number;
  models: MmdVrModelEntry[];
  setModels: (models: MmdVrModelEntry[]) => void;
  /** FIFO of model ids for stage to toggle visibility. */
  pendingVisibilityToggles: string[];
  enqueueVisibilityToggle: (id: string) => void;
  takeVisibilityToggles: () => string[];
  /** Ray-point ground place (M13). */
  placeMode: boolean;
  setPlaceMode: (on: boolean) => void;
  placeModelId: string | null;
  setPlaceModelId: (id: string | null) => void;
  pendingGroundPlace: { x: number; z: number } | null;
  requestGroundPlace: (x: number, z: number) => void;
  takeGroundPlace: () => { x: number; z: number } | null;
  pendingModelScales: { id: string; scale: number }[];
  requestModelScale: (id: string, scale: number) => void;
  takeModelScaleRequests: () => { id: string; scale: number }[];
  duration: number;
  setDuration: (n: number) => void;
  seekEpoch: number;
  seekSeconds: number;
  requestSeek: (seconds: number) => void;
  viewEpoch: number;
  resetView: () => void;
  cycleLightPreset: () => void;
};

const LIGHT_ORDER: MmdVrLightPreset[] = ["stage", "soft", "contrast"];

function normalizeWalk(value: unknown): MmdVrWalkSpeedPref {
  if (value === "auto" || value === "slow" || value === "normal" || value === "fast") return value;
  return "auto";
}

function normalizeLight(value: unknown): MmdVrLightPreset {
  if (value === "stage" || value === "soft" || value === "contrast") return value;
  return "stage";
}

function normalizeShadowResolution(value: unknown): MmdVrShadowResolutionPref {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

export function normalizeMmdVrPrefs(parsed: Partial<MmdVrPrefs> = {}): MmdVrPrefs {
  return {
    renderQuality: normalizeImmersiveQuality(parsed.renderQuality),
    showFps: Boolean(parsed.showFps),
    loop: parsed.loop !== false,
    dprPref: normalizeImmersiveDpr(parsed.dprPref),
    frameRatePref: normalizeImmersiveFrameRate(parsed.frameRatePref),
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
  }),
  normalize: normalizeMmdVrPrefs,
});

function sessionReset() {
  resetMmdVrClock();
  return {
    playing: false,
    statusLine: null as string | null,
    modelCount: 0,
    models: [] as MmdVrModelEntry[],
    pendingVisibilityToggles: [] as string[],
    placeMode: false,
    placeModelId: null as string | null,
    pendingGroundPlace: null as { x: number; z: number } | null,
    pendingModelScales: [] as { id: string; scale: number }[],
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
    if (patch.frameRatePref != null) prefs.frameRatePref = normalizeImmersiveFrameRate(patch.frameRatePref);
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
    prefsStorage.write(prefs);
    set({ prefs, loop: prefs.loop });
  },
  phase: "idle",
  errorMessage: null,
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  setPhase: (phase, errorMessage = null) => set({ phase, errorMessage }),
  overlayOpen: false,
  openOverlay: () => set({ overlayOpen: true, errorMessage: null, lastError: null }),
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
  pendingModelScales: [],
  requestModelScale: (id, scale) => {
    const normalized = normalizeMmdVrModelScale(scale);
    set((s) => ({
      models: s.models.map((model) => model.id === id ? { ...model, scale: normalized } : model),
      pendingModelScales: [
        ...s.pendingModelScales.filter((request) => request.id !== id),
        { id, scale: normalized },
      ],
    }));
  },
  takeModelScaleRequests: () => {
    const requests = get().pendingModelScales;
    if (!requests.length) return [];
    set({ pendingModelScales: [] });
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
