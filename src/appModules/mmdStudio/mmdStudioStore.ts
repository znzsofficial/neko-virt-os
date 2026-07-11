import { create } from "zustand";

export type MmdRendererBackend = "webgl" | "webgpu";
export type MmdPostFxPreset = "off" | "clean" | "soft" | "cinema" | "dreamy" | "film" | "anime" | "custom";
export type MmdCameraMode = "free" | "motion";
export type MmdExportResolution = "480p" | "720p" | "1080p" | "1440p" | "2160p";
export type MmdExportCodec = "auto" | "vp9" | "vp8";
export type MmdExportBitrate = "low" | "medium" | "high" | "ultra";
export type MmdSmaaQuality = "low" | "medium" | "high" | "ultra";
export type MmdMsaaSamples = 0 | 2 | 4 | 8;
export type MmdLutLook = "none" | "warm" | "cool" | "film";

export type MmdLightSettings = {
  ambientIntensity: number;
  sunIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
  sunCastShadow: boolean;
};

export type MmdSceneModel = {
  id: string;
  name: string;
  visible: boolean;
  morphNames: string[];
  materialNames: string[];
  bodyMotionName: string | null;
  faceMotionName: string | null;
  morphWeights: Record<string, number>;
  materialVisible: Record<string, boolean>;
};

export type MmdPostFxTune = {
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  brightness: number;
  contrast: number;
  saturation: number;
  chroma: number;
  toneMapping: boolean;
  smaa: MmdSmaaQuality;
  msaa: MmdMsaaSamples;
  dof: number;
  dofFocus: number;
  dofRange: number;
  grain: number;
  ssao: number;
  outline: number;
  lut: MmdLutLook;
};

const ADVANCED_ZERO = {
  dof: 0,
  dofFocus: 18,
  dofRange: 12,
  grain: 0,
  ssao: 0,
  outline: 0,
  lut: "none" as const,
};

export const DEFAULT_POSTFX_TUNE: MmdPostFxTune = Object.freeze({
  bloom: 0.28,
  bloomThreshold: 0.82,
  vignette: 0.28,
  brightness: 0.02,
  contrast: 0.06,
  saturation: 0,
  chroma: 0,
  toneMapping: false,
  smaa: "medium",
  msaa: 4,
  ...ADVANCED_ZERO,
});

/** Stable empty look — never clone in selectors (React useSyncExternalStore). */
export const OFF_POSTFX_TUNE: MmdPostFxTune = Object.freeze({
  bloom: 0,
  bloomThreshold: 0.85,
  vignette: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  chroma: 0,
  toneMapping: false,
  smaa: "medium" as const,
  msaa: 0 as const,
  ...ADVANCED_ZERO,
});

export const PRESET_TUNES: Record<Exclude<MmdPostFxPreset, "off" | "custom">, MmdPostFxTune> = {
  clean: Object.freeze({
    bloom: 0,
    bloomThreshold: 0.85,
    vignette: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    chroma: 0,
    toneMapping: false,
    smaa: "high",
    msaa: 4,
    ...ADVANCED_ZERO,
  }),
  soft: Object.freeze({
    bloom: 0.28,
    bloomThreshold: 0.82,
    vignette: 0.28,
    brightness: 0.02,
    contrast: 0.06,
    saturation: 0,
    chroma: 0,
    toneMapping: false,
    smaa: "medium",
    msaa: 4,
    dof: 0,
    dofFocus: 18,
    dofRange: 12,
    grain: 0.08,
    ssao: 0.15,
    outline: 0,
    lut: "none",
  }),
  cinema: Object.freeze({
    bloom: 0.48,
    bloomThreshold: 0.78,
    vignette: 0.48,
    brightness: 0.01,
    contrast: 0.1,
    saturation: 0.08,
    chroma: 0.55,
    toneMapping: true,
    smaa: "high",
    msaa: 4,
    dof: 0.45,
    dofFocus: 20,
    dofRange: 14,
    grain: 0.22,
    ssao: 0.35,
    outline: 0,
    lut: "film",
  }),
  dreamy: Object.freeze({
    bloom: 0.62,
    bloomThreshold: 0.72,
    vignette: 0.22,
    brightness: 0.04,
    contrast: -0.02,
    saturation: 0.12,
    chroma: 0.2,
    toneMapping: true,
    smaa: "medium",
    msaa: 4,
    dof: 0.7,
    dofFocus: 16,
    dofRange: 10,
    grain: 0.1,
    ssao: 0.12,
    outline: 0,
    lut: "warm",
  }),
  film: Object.freeze({
    bloom: 0.32,
    bloomThreshold: 0.8,
    vignette: 0.42,
    brightness: -0.02,
    contrast: 0.14,
    saturation: -0.04,
    chroma: 0.35,
    toneMapping: true,
    smaa: "high",
    msaa: 4,
    dof: 0.25,
    dofFocus: 22,
    dofRange: 16,
    grain: 0.42,
    ssao: 0.4,
    outline: 0,
    lut: "film",
  }),
  anime: Object.freeze({
    bloom: 0.18,
    bloomThreshold: 0.86,
    vignette: 0.12,
    brightness: 0.03,
    contrast: 0.08,
    saturation: 0.16,
    chroma: 0,
    toneMapping: false,
    smaa: "ultra",
    msaa: 4,
    dof: 0,
    dofFocus: 18,
    dofRange: 12,
    grain: 0,
    ssao: 0.2,
    outline: 0.55,
    lut: "cool",
  }),
};

type MmdStudioStore = {
  backend: MmdRendererBackend;
  postFx: MmdPostFxPreset;
  postFxTune: MmdPostFxTune;
  cameraMode: MmdCameraMode;
  physicsEnabled: boolean;
  physicsReady: boolean;
  loop: boolean;
  speed: number;
  cameraMoveSpeed: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  models: MmdSceneModel[];
  selectedModelId: string | null;
  audioName: string | null;
  skyMode: "solid" | "hdr";
  skyHdrName: string | null;
  skyHdrUrl: string | null;
  skyAsBackground: boolean;
  skyAsEnvironment: boolean;
  envIntensity: number;
  showGrid: boolean;
  lights: MmdLightSettings;
  status: "idle" | "loading" | "ready" | "error";
  statusMessage: string;
  webgpuAvailable: boolean;
  recording: boolean;
  exportResolution: MmdExportResolution;
  exportFps: 24 | 30 | 60 | 120;
  exportCodec: MmdExportCodec;
  exportBitrate: MmdExportBitrate;
  exportIncludeAudio: boolean;
  exportHideGrid: boolean;
  exportFilePrefix: string;
  exportIn: number;
  exportOut: number;
  projectName: string;
  lastProjectId: string | null;
  setBackend: (backend: MmdRendererBackend) => void;
  setPostFx: (postFx: MmdPostFxPreset) => void;
  setPostFxTune: (partial: Partial<MmdPostFxTune>) => void;
  resetPostFxTune: () => void;
  setCameraMode: (mode: MmdCameraMode) => void;
  setPhysicsEnabled: (enabled: boolean) => void;
  setPhysicsReady: (ready: boolean) => void;
  setLoop: (loop: boolean) => void;
  setSpeed: (speed: number) => void;
  setCameraMoveSpeed: (speed: number) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setModels: (models: MmdSceneModel[], selectedModelId?: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  patchModel: (id: string, patch: Partial<MmdSceneModel>) => void;
  setAudioName: (name: string | null) => void;
  setSkyHdr: (file: File | null) => void;
  setSkyAsBackground: (enabled: boolean) => void;
  setSkyAsEnvironment: (enabled: boolean) => void;
  setEnvIntensity: (value: number) => void;
  setShowGrid: (show: boolean) => void;
  setLights: (partial: Partial<MmdLightSettings>) => void;
  resetLights: () => void;
  setStatus: (status: MmdStudioStore["status"], message?: string) => void;
  setWebgpuAvailable: (available: boolean) => void;
  setRecording: (recording: boolean) => void;
  setExportResolution: (resolution: MmdExportResolution) => void;
  setExportFps: (fps: 24 | 30 | 60 | 120) => void;
  setExportCodec: (codec: MmdExportCodec) => void;
  setExportBitrate: (bitrate: MmdExportBitrate) => void;
  setExportIncludeAudio: (enabled: boolean) => void;
  setExportHideGrid: (enabled: boolean) => void;
  setExportFilePrefix: (prefix: string) => void;
  setExportIn: (time: number) => void;
  setExportOut: (time: number) => void;
  setProjectName: (name: string) => void;
  setLastProjectId: (id: string | null) => void;
  clampExportRange: () => void;
  selectedModel: () => MmdSceneModel | null;
  effectivePostFx: () => MmdPostFxPreset;
  resolveTune: () => MmdPostFxTune;
  exportRangeSeconds: () => number;
};

const BACKEND_KEY = "neko-virt-os.mmd-backend.v1";
const POSTFX_KEY = "neko-virt-os.mmd-postfx.v1";
const POSTFX_TUNE_KEY = "neko-virt-os.mmd-postfx-tune.v1";
const EXPORT_KEY = "neko-virt-os.mmd-export.v1";
const LIGHTS_KEY = "neko-virt-os.mmd-lights.v1";

const POSTFX_PRESETS: MmdPostFxPreset[] = ["off", "clean", "soft", "cinema", "dreamy", "film", "anime", "custom"];

export const DEFAULT_LIGHTS: MmdLightSettings = Object.freeze({
  ambientIntensity: 0.55,
  sunIntensity: 1.15,
  sunAzimuth: 35,
  sunElevation: 48,
  sunCastShadow: true,
});

type ExportSettingsPersist = {
  resolution?: MmdExportResolution;
  fps?: 24 | 30 | 60 | 120;
  codec?: MmdExportCodec;
  bitrate?: MmdExportBitrate;
  includeAudio?: boolean;
  hideGrid?: boolean;
  filePrefix?: string;
};

function loadExportSettings(): Required<ExportSettingsPersist> {
  const defaults: Required<ExportSettingsPersist> = {
    resolution: "1080p",
    fps: 30,
    codec: "auto",
    bitrate: "high",
    includeAudio: true,
    hideGrid: true,
    filePrefix: "mmd-export",
  };
  try {
    const raw = localStorage.getItem(EXPORT_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as ExportSettingsPersist;
    const resolution = parsed.resolution && ["480p", "720p", "1080p", "1440p", "2160p"].includes(parsed.resolution)
      ? parsed.resolution
      : defaults.resolution;
    const fps = parsed.fps === 24 || parsed.fps === 30 || parsed.fps === 60 || parsed.fps === 120 ? parsed.fps : defaults.fps;
    const codec = parsed.codec === "vp8" || parsed.codec === "vp9" || parsed.codec === "auto" ? parsed.codec : defaults.codec;
    const bitrate = parsed.bitrate && ["low", "medium", "high", "ultra"].includes(parsed.bitrate)
      ? parsed.bitrate
      : defaults.bitrate;
    return {
      resolution,
      fps,
      codec,
      bitrate,
      includeAudio: parsed.includeAudio !== false,
      hideGrid: parsed.hideGrid !== false,
      filePrefix: typeof parsed.filePrefix === "string" && parsed.filePrefix.trim()
        ? parsed.filePrefix.trim().slice(0, 48)
        : defaults.filePrefix,
    };
  } catch {
    return defaults;
  }
}

function persistExportSettings(partial: Partial<ExportSettingsPersist>) {
  try {
    const current = loadExportSettings();
    localStorage.setItem(EXPORT_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    // ignore
  }
}

function loadBackend(): MmdRendererBackend {
  try {
    return localStorage.getItem(BACKEND_KEY) === "webgpu" ? "webgpu" : "webgl";
  } catch {
    return "webgl";
  }
}

function loadPostFx(): MmdPostFxPreset {
  try {
    const value = localStorage.getItem(POSTFX_KEY);
    if (value && POSTFX_PRESETS.includes(value as MmdPostFxPreset)) return value as MmdPostFxPreset;
    return "soft";
  } catch {
    return "soft";
  }
}

function sanitizeLut(value: unknown): MmdLutLook {
  if (value === "warm" || value === "cool" || value === "film" || value === "none") return value;
  return "none";
}

function loadPostFxTune(): MmdPostFxTune {
  try {
    const raw = localStorage.getItem(POSTFX_TUNE_KEY);
    if (!raw) return { ...DEFAULT_POSTFX_TUNE };
    const parsed = JSON.parse(raw) as Partial<MmdPostFxTune>;
    return {
      ...DEFAULT_POSTFX_TUNE,
      ...parsed,
      lut: sanitizeLut(parsed.lut),
    };
  } catch {
    return { ...DEFAULT_POSTFX_TUNE };
  }
}

function loadLights(): MmdLightSettings {
  try {
    const raw = localStorage.getItem(LIGHTS_KEY);
    if (!raw) return { ...DEFAULT_LIGHTS };
    const parsed = JSON.parse(raw) as Partial<MmdLightSettings>;
    return {
      ambientIntensity: clampNum(parsed.ambientIntensity, 0, 3, DEFAULT_LIGHTS.ambientIntensity),
      sunIntensity: clampNum(parsed.sunIntensity, 0, 5, DEFAULT_LIGHTS.sunIntensity),
      sunAzimuth: clampNum(parsed.sunAzimuth, -180, 180, DEFAULT_LIGHTS.sunAzimuth),
      sunElevation: clampNum(parsed.sunElevation, 5, 89, DEFAULT_LIGHTS.sunElevation),
      sunCastShadow: parsed.sunCastShadow !== false,
    };
  } catch {
    return { ...DEFAULT_LIGHTS };
  }
}

function clampNum(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function persistLights(lights: MmdLightSettings) {
  try {
    localStorage.setItem(LIGHTS_KEY, JSON.stringify(lights));
  } catch {
    // ignore
  }
}

function clampTime(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.min(Math.max(0, value), max);
}

/** Stable references for presets / off; only custom returns the store object. */
export function resolvePostFxTune(
  backend: MmdRendererBackend,
  postFx: MmdPostFxPreset,
  postFxTune: MmdPostFxTune,
): MmdPostFxTune {
  if (backend !== "webgl" || postFx === "off") return OFF_POSTFX_TUNE;
  if (postFx === "custom") return postFxTune;
  return PRESET_TUNES[postFx];
}

export const useMmdStudioStore = create<MmdStudioStore>((set, get) => {
  const exportDefaults = loadExportSettings();
  return {
  backend: loadBackend(),
  postFx: loadPostFx(),
  postFxTune: loadPostFxTune(),
  cameraMode: "free",
  physicsEnabled: false,
  physicsReady: false,
  loop: true,
  speed: 1,
  cameraMoveSpeed: 8,
  playing: false,
  currentTime: 0,
  duration: 0,
  models: [],
  selectedModelId: null,
  audioName: null,
  skyMode: "solid",
  skyHdrName: null,
  skyHdrUrl: null,
  skyAsBackground: true,
  skyAsEnvironment: true,
  envIntensity: 1,
  showGrid: true,
  lights: loadLights(),
  status: "idle",
  statusMessage: "",
  webgpuAvailable: typeof navigator !== "undefined" && Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
  recording: false,
  exportResolution: exportDefaults.resolution,
  exportFps: exportDefaults.fps,
  exportCodec: exportDefaults.codec,
  exportBitrate: exportDefaults.bitrate,
  exportIncludeAudio: exportDefaults.includeAudio,
  exportHideGrid: exportDefaults.hideGrid,
  exportFilePrefix: exportDefaults.filePrefix,
  exportIn: 0,
  exportOut: 0,
  projectName: "Untitled Project",
  lastProjectId: null,

  setBackend: (backend) => {
    if (get().backend === backend) return;
    try {
      localStorage.setItem(BACKEND_KEY, backend);
    } catch {
      // ignore
    }
    set({ backend, playing: false, recording: false });
  },
  setPostFx: (postFx) => {
    try {
      localStorage.setItem(POSTFX_KEY, postFx);
    } catch {
      // ignore
    }
    if (postFx === "custom" || postFx === "off") {
      set({ postFx });
      return;
    }
    const tune = { ...PRESET_TUNES[postFx] };
    try {
      localStorage.setItem(POSTFX_TUNE_KEY, JSON.stringify(tune));
    } catch {
      // ignore
    }
    set({ postFx, postFxTune: tune });
  },
  setPostFxTune: (partial) => {
    const postFxTune = {
      ...get().postFxTune,
      ...partial,
      lut: partial.lut !== undefined ? sanitizeLut(partial.lut) : get().postFxTune.lut,
    };
    try {
      localStorage.setItem(POSTFX_TUNE_KEY, JSON.stringify(postFxTune));
      localStorage.setItem(POSTFX_KEY, "custom");
    } catch {
      // ignore
    }
    set({ postFxTune, postFx: "custom" });
  },
  resetPostFxTune: () => {
    const base = get().postFx;
    const nextPreset = base === "custom" || base === "off" ? "soft" : base;
    const tune = { ...PRESET_TUNES[nextPreset] };
    try {
      localStorage.setItem(POSTFX_TUNE_KEY, JSON.stringify(tune));
      localStorage.setItem(POSTFX_KEY, nextPreset);
    } catch {
      // ignore
    }
    set({ postFxTune: tune, postFx: nextPreset });
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setPhysicsEnabled: (physicsEnabled) => set({ physicsEnabled }),
  setPhysicsReady: (physicsReady) => set({ physicsReady }),
  setLoop: (loop) => set({ loop }),
  setSpeed: (speed) => set({ speed }),
  setCameraMoveSpeed: (cameraMoveSpeed) => set({ cameraMoveSpeed: Math.min(40, Math.max(1, cameraMoveSpeed)) }),
  setPlaying: (playing) => set({ playing }),
  setCurrentTime: (currentTime) => {
    if (get().currentTime === currentTime) return;
    set({ currentTime });
  },
  setDuration: (duration) => {
    if (get().duration === duration) {
      get().clampExportRange();
      return;
    }
    set({ duration });
    get().clampExportRange();
  },
  setModels: (models, selectedModelId) => {
    const nextSelected = selectedModelId !== undefined
      ? selectedModelId
      : get().selectedModelId && models.some((item) => item.id === get().selectedModelId)
        ? get().selectedModelId
        : models[0]?.id ?? null;
    set({ models, selectedModelId: nextSelected });
  },
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
  patchModel: (id, patch) => {
    set({
      models: get().models.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  },
  setAudioName: (audioName) => set({ audioName }),
  setSkyHdr: (file) => {
    const prev = get().skyHdrUrl;
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // ignore
      }
    }
    if (!file) {
      set({ skyMode: "solid", skyHdrName: null, skyHdrUrl: null });
      return;
    }
    const url = URL.createObjectURL(file);
    set({
      skyMode: "hdr",
      skyHdrName: file.name,
      skyHdrUrl: url,
      skyAsBackground: true,
      skyAsEnvironment: true,
    });
  },
  setSkyAsBackground: (skyAsBackground) => set({ skyAsBackground }),
  setSkyAsEnvironment: (skyAsEnvironment) => set({ skyAsEnvironment }),
  setEnvIntensity: (envIntensity) => set({ envIntensity: Math.min(3, Math.max(0, envIntensity)) }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setLights: (partial) => {
    const lights: MmdLightSettings = {
      ...get().lights,
      ...partial,
      ambientIntensity: clampNum(partial.ambientIntensity ?? get().lights.ambientIntensity, 0, 3, DEFAULT_LIGHTS.ambientIntensity),
      sunIntensity: clampNum(partial.sunIntensity ?? get().lights.sunIntensity, 0, 5, DEFAULT_LIGHTS.sunIntensity),
      sunAzimuth: clampNum(partial.sunAzimuth ?? get().lights.sunAzimuth, -180, 180, DEFAULT_LIGHTS.sunAzimuth),
      sunElevation: clampNum(partial.sunElevation ?? get().lights.sunElevation, 5, 89, DEFAULT_LIGHTS.sunElevation),
      sunCastShadow: partial.sunCastShadow ?? get().lights.sunCastShadow,
    };
    persistLights(lights);
    set({ lights });
  },
  resetLights: () => {
    const lights = { ...DEFAULT_LIGHTS };
    persistLights(lights);
    set({ lights });
  },
  setStatus: (status, statusMessage = "") => {
    const state = get();
    if (state.status === status && state.statusMessage === statusMessage) return;
    set({ status, statusMessage });
  },
  setWebgpuAvailable: (webgpuAvailable) => {
    if (get().webgpuAvailable === webgpuAvailable) return;
    set({ webgpuAvailable });
  },
  setRecording: (recording) => set({ recording, playing: recording ? true : get().playing }),
  setExportResolution: (exportResolution) => {
    persistExportSettings({ resolution: exportResolution });
    set({ exportResolution });
  },
  setExportFps: (exportFps) => {
    persistExportSettings({ fps: exportFps });
    set({ exportFps });
  },
  setExportCodec: (exportCodec) => {
    persistExportSettings({ codec: exportCodec });
    set({ exportCodec });
  },
  setExportBitrate: (exportBitrate) => {
    persistExportSettings({ bitrate: exportBitrate });
    set({ exportBitrate });
  },
  setExportIncludeAudio: (exportIncludeAudio) => {
    persistExportSettings({ includeAudio: exportIncludeAudio });
    set({ exportIncludeAudio });
  },
  setExportHideGrid: (exportHideGrid) => {
    persistExportSettings({ hideGrid: exportHideGrid });
    set({ exportHideGrid });
  },
  setExportFilePrefix: (exportFilePrefix) => {
    const next = exportFilePrefix.trim().slice(0, 48) || "mmd-export";
    persistExportSettings({ filePrefix: next });
    set({ exportFilePrefix: next });
  },
  setExportIn: (time) => {
    const { duration, exportOut } = get();
    const nextIn = clampTime(time, duration);
    const end = exportOut > 0 ? exportOut : duration;
    set({
      exportIn: nextIn,
      exportOut: end > 0 && end < nextIn ? nextIn : exportOut,
    });
  },
  setExportOut: (time) => {
    const { duration, exportIn } = get();
    const nextOut = clampTime(time, duration);
    set({
      exportOut: nextOut,
      exportIn: nextOut > 0 && nextOut < exportIn ? nextOut : exportIn,
    });
  },
  setProjectName: (projectName) => set({ projectName: projectName.trim().slice(0, 64) || "Untitled Project" }),
  setLastProjectId: (lastProjectId) => set({ lastProjectId }),
  clampExportRange: () => {
    const { duration, exportIn, exportOut } = get();
    if (duration <= 0) {
      if (exportIn !== 0 || exportOut !== 0) set({ exportIn: 0, exportOut: 0 });
      return;
    }
    const nextIn = clampTime(exportIn, duration);
    let nextOut = exportOut > 0 ? clampTime(exportOut, duration) : duration;
    if (nextOut < nextIn) nextOut = duration;
    const finalOut = nextOut >= duration ? duration : nextOut;
    if (nextIn === exportIn && finalOut === exportOut) return;
    set({ exportIn: nextIn, exportOut: finalOut });
  },
  selectedModel: () => {
    const { models, selectedModelId } = get();
    return models.find((item) => item.id === selectedModelId) ?? null;
  },
  effectivePostFx: () => {
    const state = get();
    return state.backend === "webgl" ? state.postFx : "off";
  },
  resolveTune: () => {
    const state = get();
    return resolvePostFxTune(state.backend, state.postFx, state.postFxTune);
  },
  exportRangeSeconds: () => {
    const { duration, exportIn, exportOut, speed } = get();
    if (duration <= 0) return 0;
    const end = exportOut > 0 ? Math.min(exportOut, duration) : duration;
    const start = Math.min(exportIn, end);
    return Math.max(0.05, (end - start) / Math.max(0.05, speed));
  },
};
});


export function formatMmdTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 30);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
}

export function getExportSize(resolution: MmdExportResolution) {
  if (resolution === "480p") return { width: 854, height: 480 };
  if (resolution === "720p") return { width: 1280, height: 720 };
  if (resolution === "1440p") return { width: 2560, height: 1440 };
  if (resolution === "2160p") return { width: 3840, height: 2160 };
  return { width: 1920, height: 1080 };
}

export function getExportVideoBits(resolution: MmdExportResolution, bitrate: MmdExportBitrate) {
  const base = {
    "480p": 2_500_000,
    "720p": 5_000_000,
    "1080p": 10_000_000,
    "1440p": 18_000_000,
    "2160p": 35_000_000,
  }[resolution];
  const scale = { low: 0.55, medium: 0.8, high: 1, ultra: 1.45 }[bitrate];
  return Math.round(base * scale);
}

export function resolveExportMimeType(codec: MmdExportCodec) {
  const candidates =
    codec === "vp8"
      ? ["video/webm;codecs=vp8", "video/webm"]
      : codec === "vp9"
        ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export function buildExportFileName(prefix: string, resolution: MmdExportResolution, fps: number) {
  const safe = (prefix.trim() || "mmd-export").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
  return `${safe}-${resolution}-${fps}fps-${Date.now()}.webm`;
}
