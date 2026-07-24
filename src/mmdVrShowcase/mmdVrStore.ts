import { create } from "zustand";
import { createLocalPrefsStorage } from "../shared/localPrefs";
import {
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFrameRate,
  normalizeImmersiveQuality,
  normalizeImmersiveToggle,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRatePref,
  type ImmersiveRenderQuality,
  type ImmersiveTogglePref,
} from "../xr";
import { endMmdVrAssetSession } from "./mmdVrAssets";
import { resetMmdVrClock } from "./mmdVrClock";

export type MmdVrRenderQuality = ImmersiveRenderQuality;
export type MmdVrDprPref = ImmersiveDprPref;
export type MmdVrFrameRatePref = ImmersiveFrameRatePref;
export type MmdVrAntialiasPref = ImmersiveAntialiasPref;
export type MmdVrTogglePref = ImmersiveTogglePref;
export type MmdVrWalkSpeedPref = "auto" | "slow" | "normal" | "fast";
export type MmdVrLightPreset = "stage" | "soft" | "contrast";

export type MmdVrSessionPhase = "idle" | "entering" | "active" | "error";

export type MmdVrModelEntry = {
  id: string;
  name: string;
  visible: boolean;
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
};

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

const prefsStorage = createLocalPrefsStorage<MmdVrPrefs>({
  key: "neko-virt-os.mmd-vr-showcase.v2",
  legacyKey: "neko-virt-os.mmd-vr-showcase.v1",
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
  }),
  normalize: (parsed) => ({
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
  }),
});

function sessionReset() {
  resetMmdVrClock();
  return {
    playing: false,
    statusLine: null as string | null,
    modelCount: 0,
    models: [] as MmdVrModelEntry[],
    pendingVisibilityToggles: [] as string[],
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
  setModels: (models) => set({ models, modelCount: models.length }),
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
