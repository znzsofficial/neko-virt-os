import { Icon } from "@iconify-icon/react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useDownloadStore } from "../../downloadStore";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import { collectFilesFromDataTransfer, pickBodyAndFaceMotions, pickPrimaryAudio, pickPrimaryModel } from "./folderImport";
import { MmdCanvas, type MmdSceneApi } from "./MmdCanvas";
import {
  deleteMmdProject,
  getMmdAutosave,
  listMmdProjects,
  loadMmdProjectAsset,
  saveMmdProject,
  type MmdProjectRecord,
  type MmdProjectSettings,
} from "./mmdProjectDb";
import {
  buildExportFileName,
  formatMmdTime,
  getExportSize,
  getExportVideoBits,
  resolveExportMimeType,
  useMmdStudioStore,
  type MmdExportBitrate,
  type MmdExportCodec,
  type MmdExportResolution,
  type MmdLutLook,
  type MmdMsaaSamples,
  type MmdPostFxPreset,
  type MmdRendererBackend,
  type MmdSmaaQuality,
} from "./mmdStudioStore";
import { isAudioFile } from "./mmdUtils";

function PanelSection({
  title,
  children,
  actions,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useLanguageStore((state) => state.t);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mmd-panel">
      <header className="mmd-panel-head">
        <h3>{title}</h3>
        <div className="mmd-panel-actions">
          {actions}
          {collapsible ? (
            <button type="button" className="button-ghost mmd-mini-btn" onClick={() => setOpen((value) => !value)}>
              {open ? t("mmdCollapse") : t("mmdExpand")}
            </button>
          ) : null}
        </div>
      </header>
      {open ? <div className="mmd-panel-body">{children}</div> : null}
    </section>
  );
}

function AssetRow({
  label,
  value,
  onPick,
  pickLabel,
}: {
  label: string;
  value: string | null;
  onPick: () => void;
  pickLabel: string;
}) {
  return (
    <div className="mmd-asset-row">
      <div className="mmd-asset-meta">
        <span className="mmd-asset-label">{label}</span>
        <strong className={value ? undefined : "is-empty"} title={value ?? undefined}>{value ?? "—"}</strong>
      </div>
      <button type="button" className="button-ghost mmd-mini-btn" onClick={onPick}>{pickLabel}</button>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={disabled ? "mmd-slider is-disabled" : "mmd-slider"}>
      <span className="mmd-slider-top">
        <span>{label}</span>
        <span className="mmd-slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function MmdStudioApp() {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addDownload = useDownloadStore((state) => state.addDownload);
  const backend = useMmdStudioStore((state) => state.backend);
  const setBackend = useMmdStudioStore((state) => state.setBackend);
  const postFx = useMmdStudioStore((state) => state.postFx);
  const setPostFx = useMmdStudioStore((state) => state.setPostFx);
  const postFxTune = useMmdStudioStore((state) => state.postFxTune);
  const setPostFxTune = useMmdStudioStore((state) => state.setPostFxTune);
  const resetPostFxTune = useMmdStudioStore((state) => state.resetPostFxTune);
  const cameraMode = useMmdStudioStore((state) => state.cameraMode);
  const setCameraMode = useMmdStudioStore((state) => state.setCameraMode);
  const physicsEnabled = useMmdStudioStore((state) => state.physicsEnabled);
  const setPhysicsEnabled = useMmdStudioStore((state) => state.setPhysicsEnabled);
  const physicsReady = useMmdStudioStore((state) => state.physicsReady);
  const loop = useMmdStudioStore((state) => state.loop);
  const setLoop = useMmdStudioStore((state) => state.setLoop);
  const speed = useMmdStudioStore((state) => state.speed);
  const setSpeed = useMmdStudioStore((state) => state.setSpeed);
  const cameraMoveSpeed = useMmdStudioStore((state) => state.cameraMoveSpeed);
  const setCameraMoveSpeed = useMmdStudioStore((state) => state.setCameraMoveSpeed);
  const playing = useMmdStudioStore((state) => state.playing);
  const setPlaying = useMmdStudioStore((state) => state.setPlaying);
  const currentTime = useMmdStudioStore((state) => state.currentTime);
  const setCurrentTime = useMmdStudioStore((state) => state.setCurrentTime);
  const duration = useMmdStudioStore((state) => state.duration);
  const models = useMmdStudioStore((state) => state.models);
  const selectedModelId = useMmdStudioStore((state) => state.selectedModelId);
  const setSelectedModelId = useMmdStudioStore((state) => state.setSelectedModelId);
  const patchModel = useMmdStudioStore((state) => state.patchModel);
  const audioName = useMmdStudioStore((state) => state.audioName);
  const setAudioName = useMmdStudioStore((state) => state.setAudioName);
  const skyHdrName = useMmdStudioStore((state) => state.skyHdrName);
  const setSkyHdr = useMmdStudioStore((state) => state.setSkyHdr);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const setSkyAsBackground = useMmdStudioStore((state) => state.setSkyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const setSkyAsEnvironment = useMmdStudioStore((state) => state.setSkyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
  const setEnvIntensity = useMmdStudioStore((state) => state.setEnvIntensity);
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const setShowGrid = useMmdStudioStore((state) => state.setShowGrid);
  const lights = useMmdStudioStore((state) => state.lights);
  const setLights = useMmdStudioStore((state) => state.setLights);
  const resetLights = useMmdStudioStore((state) => state.resetLights);
  const projectName = useMmdStudioStore((state) => state.projectName);
  const setProjectName = useMmdStudioStore((state) => state.setProjectName);
  const lastProjectId = useMmdStudioStore((state) => state.lastProjectId);
  const setLastProjectId = useMmdStudioStore((state) => state.setLastProjectId);
  const selectedModel = models.find((item) => item.id === selectedModelId) ?? null;
  const status = useMmdStudioStore((state) => state.status);
  const statusMessage = useMmdStudioStore((state) => state.statusMessage);
  const webgpuAvailable = useMmdStudioStore((state) => state.webgpuAvailable);
  const recording = useMmdStudioStore((state) => state.recording);
  const setRecording = useMmdStudioStore((state) => state.setRecording);
  const exportResolution = useMmdStudioStore((state) => state.exportResolution);
  const setExportResolution = useMmdStudioStore((state) => state.setExportResolution);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const setExportFps = useMmdStudioStore((state) => state.setExportFps);
  const exportCodec = useMmdStudioStore((state) => state.exportCodec);
  const setExportCodec = useMmdStudioStore((state) => state.setExportCodec);
  const exportBitrate = useMmdStudioStore((state) => state.exportBitrate);
  const setExportBitrate = useMmdStudioStore((state) => state.setExportBitrate);
  const exportIncludeAudio = useMmdStudioStore((state) => state.exportIncludeAudio);
  const setExportIncludeAudio = useMmdStudioStore((state) => state.setExportIncludeAudio);
  const exportHideGrid = useMmdStudioStore((state) => state.exportHideGrid);
  const setExportHideGrid = useMmdStudioStore((state) => state.setExportHideGrid);
  const exportFilePrefix = useMmdStudioStore((state) => state.exportFilePrefix);
  const setExportFilePrefix = useMmdStudioStore((state) => state.setExportFilePrefix);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const setExportIn = useMmdStudioStore((state) => state.setExportIn);
  const setExportOut = useMmdStudioStore((state) => state.setExportOut);
  const exportRangeSeconds = useMmdStudioStore((state) => state.exportRangeSeconds);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const apiRef = useRef<MmdSceneApi | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const bodyMotionInputRef = useRef<HTMLInputElement | null>(null);
  const faceMotionInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const hdrInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const exportObjectUrlRef = useRef<string | null>(null);
  const hdrFileRef = useRef<File | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const gridRestoreRef = useRef<boolean | null>(null);
  const canvasSizeRestoreRef = useRef<{ width: number; height: number } | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const restoreTriedRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [textureInfo, setTextureInfo] = useState("");
  const [fxOpen, setFxOpen] = useState(true);
  const [projectList, setProjectList] = useState<MmdProjectRecord[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);

  async function loadModelBundle(modelFile: File, companionFiles: File[]) {
    const report = await apiRef.current?.addModel(modelFile, companionFiles, {
      physics: useMmdStudioStore.getState().physicsEnabled,
    });
    if (!report) return;
    if (report.textureCount === 0) {
      setTextureInfo(t("mmdTextureNone"));
      addNotification({
        title: t("mmdTextureMissingTitle"),
        message: t("mmdTextureFolderHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
        duration: 6000,
      });
      return;
    }
    if (report.missingTextures.length) {
      const preview = report.missingTextures.slice(0, 3).join(", ");
      setTextureInfo(`${t("mmdTexturePartial")}: ${preview}${report.missingTextures.length > 3 ? "…" : ""}`);
      addNotification({
        title: t("mmdTextureMissingTitle"),
        message: `${report.missingTextures.length} ${t("mmdTextureMissingCount")}`,
        type: "warning",
        category: "media",
        appId: "mmd-studio",
        duration: 6000,
      });
      return;
    }
    setTextureInfo(`${t("mmdTextureOk")}: ${report.textureCount}`);
  }

  async function handleBodyMotion(file: File) {
    await apiRef.current?.loadMotion(file, "body", selectedModelId);
  }

  async function handleFaceMotion(file: File) {
    await apiRef.current?.loadMotion(file, "face", selectedModelId);
  }

  async function handleAudio(file: File) {
    audioFileRef.current = file;
    setAudioName(file.name);
    if (audioObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      } catch {
        // ignore
      }
      audioObjectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    audioObjectUrlRef.current = url;
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
  }

  function clearAudio() {
    audioFileRef.current = null;
    setAudioName(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (audioObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      } catch {
        // ignore
      }
      audioObjectUrlRef.current = null;
    }
  }

  function applyProjectSettings(settings: MmdProjectSettings, options?: { applyBackend?: boolean }) {
    const store = useMmdStudioStore.getState();
    if (options?.applyBackend !== false) store.setBackend(settings.backend);
    store.setPostFx(settings.postFx);
    if (settings.postFx === "custom") store.setPostFxTune(settings.postFxTune);
    store.setCameraMode(settings.cameraMode);
    store.setPhysicsEnabled(settings.physicsEnabled);
    store.setLoop(settings.loop);
    store.setSpeed(settings.speed);
    store.setCameraMoveSpeed(settings.cameraMoveSpeed);
    store.setShowGrid(settings.showGrid);
    store.setSkyAsBackground(settings.skyAsBackground);
    store.setSkyAsEnvironment(settings.skyAsEnvironment);
    store.setEnvIntensity(settings.envIntensity);
    store.setLights(settings.lights);
    store.setExportResolution(settings.exportResolution);
    store.setExportFps(settings.exportFps);
    store.setExportCodec(settings.exportCodec);
    store.setExportBitrate(settings.exportBitrate);
    store.setExportIncludeAudio(settings.exportIncludeAudio);
    store.setExportHideGrid(settings.exportHideGrid);
    store.setExportFilePrefix(settings.exportFilePrefix);
    store.setExportIn(settings.exportIn);
    store.setExportOut(settings.exportOut);
    store.setCurrentTime(settings.currentTime);
  }

  async function waitForSceneApi(timeoutMs = 4000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (apiRef.current) return apiRef.current;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return apiRef.current;
  }

  function collectProjectSettings(): MmdProjectSettings {
    const s = useMmdStudioStore.getState();
    return {
      backend: s.backend,
      postFx: s.postFx,
      postFxTune: { ...s.postFxTune },
      cameraMode: s.cameraMode,
      physicsEnabled: s.physicsEnabled,
      loop: s.loop,
      speed: s.speed,
      cameraMoveSpeed: s.cameraMoveSpeed,
      currentTime: s.currentTime,
      showGrid: s.showGrid,
      skyAsBackground: s.skyAsBackground,
      skyAsEnvironment: s.skyAsEnvironment,
      envIntensity: s.envIntensity,
      lights: { ...s.lights },
      exportResolution: s.exportResolution,
      exportFps: s.exportFps,
      exportCodec: s.exportCodec,
      exportBitrate: s.exportBitrate,
      exportIncludeAudio: s.exportIncludeAudio,
      exportHideGrid: s.exportHideGrid,
      exportFilePrefix: s.exportFilePrefix,
      exportIn: s.exportIn,
      exportOut: s.exportOut,
    };
  }

  async function refreshProjectList() {
    try {
      setProjectList(await listMmdProjects());
    } catch {
      setProjectList([]);
    }
  }

  async function saveCurrentProject(options?: { autosave?: boolean; name?: string }) {
    const api = apiRef.current;
    if (!api) return null;
    const modelsAssets = api.exportProjectModels();
    const name = options?.name ?? useMmdStudioStore.getState().projectName;
    const isAutosave = Boolean(options?.autosave);
    const id = isAutosave
      ? undefined
      : (useMmdStudioStore.getState().lastProjectId ?? undefined);
    const record = await saveMmdProject({
      id: isAutosave ? undefined : id,
      name: isAutosave ? "Autosave" : name,
      isAutosave,
      settings: collectProjectSettings(),
      models: modelsAssets.map((model) => ({
        id: model.id,
        name: model.name,
        visible: model.visible,
        morphWeights: model.morphWeights,
        materialVisible: model.materialVisible,
        offsetX: model.offsetX,
        modelFile: model.modelFile,
        companionFiles: model.companionFiles,
        bodyMotionFile: model.bodyMotionFile,
        faceMotionFile: model.faceMotionFile,
      })),
      audioFile: audioFileRef.current,
      audioName: useMmdStudioStore.getState().audioName,
      hdrFile: hdrFileRef.current,
      hdrName: useMmdStudioStore.getState().skyHdrName,
    });
    if (!isAutosave) {
      setLastProjectId(record.id);
      setProjectName(record.name);
      await refreshProjectList();
    }
    return record;
  }

  async function loadProjectRecord(record: MmdProjectRecord) {
    setProjectBusy(true);
    try {
      const targetBackend = record.settings.backend;
      const currentBackend = useMmdStudioStore.getState().backend;
      if (targetBackend !== currentBackend) {
        useMmdStudioStore.getState().setBackend(targetBackend);
      }
      const api = await waitForSceneApi();
      if (!api) throw new Error("Scene API unavailable");

      api.clearScene();
      applyProjectSettings(record.settings, { applyBackend: false });
      setProjectName(record.isAutosave ? useMmdStudioStore.getState().projectName : record.name);
      if (!record.isAutosave) setLastProjectId(record.id);

      for (const model of record.models) {
        const modelFile = await loadMmdProjectAsset(model.modelAssetId);
        if (!modelFile) continue;
        const companions: File[] = [];
        for (const cid of model.companionAssetIds) {
          const file = await loadMmdProjectAsset(cid);
          if (file) companions.push(file);
        }
        const report = await api.addModel(modelFile, companions.length ? companions : [modelFile], {
          physics: record.settings.physicsEnabled,
          offsetX: model.offsetX,
          preferredId: model.id,
        });
        const modelId = report.modelId;
        api.setModelVisible(modelId, model.visible);
        if (model.bodyMotionAssetId) {
          const body = await loadMmdProjectAsset(model.bodyMotionAssetId);
          if (body) await api.loadMotion(body, "body", modelId);
        }
        if (model.faceMotionAssetId) {
          const face = await loadMmdProjectAsset(model.faceMotionAssetId);
          if (face) await api.loadMotion(face, "face", modelId);
        }
        for (const [name, weight] of Object.entries(model.morphWeights)) {
          api.setMorphWeight(modelId, name, weight);
        }
        for (const [name, visible] of Object.entries(model.materialVisible)) {
          api.setMaterialVisible(modelId, name, visible);
        }
      }

      if (record.audioAssetId) {
        const audio = await loadMmdProjectAsset(record.audioAssetId);
        if (audio) await handleAudio(audio);
      } else {
        clearAudio();
      }

      if (record.hdrAssetId) {
        const hdr = await loadMmdProjectAsset(record.hdrAssetId);
        if (hdr) {
          hdrFileRef.current = hdr;
          setSkyHdr(hdr);
        }
      } else {
        hdrFileRef.current = null;
        setSkyHdr(null);
      }

      seek(record.settings.currentTime);
      setTextureInfo(t("mmdProjectLoaded"));
      addNotification({
        title: t("mmdProject"),
        message: record.isAutosave ? t("mmdProjectRestored") : t("mmdProjectLoaded"),
        type: "success",
        category: "media",
        appId: "mmd-studio",
        duration: 3500,
      });
    } finally {
      setProjectBusy(false);
    }
  }

  useEffect(() => {
    void refreshProjectList();
  }, []);

  useEffect(() => {
    if (restoreTriedRef.current) return;
    restoreTriedRef.current = true;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled || !apiRef.current) return;
        try {
          const autosave = await getMmdAutosave();
          if (!autosave || !autosave.models.length) return;
          if (useMmdStudioStore.getState().models.length) return;
          await loadProjectRecord(autosave);
        } catch {
          // ignore restore failures
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    if (recording || projectBusy || status === "loading") return;
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveCurrentProject({ autosave: true }).catch(() => undefined);
    }, 8000);
    return () => {
      if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [
    models,
    lights,
    postFx,
    postFxTune,
    skyHdrName,
    audioName,
    projectName,
    recording,
    projectBusy,
    status,
    currentTime,
    cameraMode,
    physicsEnabled,
    speed,
    loop,
    cameraMoveSpeed,
    showGrid,
    skyAsBackground,
    skyAsEnvironment,
    envIntensity,
    exportIn,
    exportOut,
    exportResolution,
    exportFps,
    exportCodec,
    exportBitrate,
    exportIncludeAudio,
    exportHideGrid,
    exportFilePrefix,
  ]);

  useEffect(() => () => {
    if (audioObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      } catch {
        // ignore
      }
    }
    if (exportObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(exportObjectUrlRef.current);
      } catch {
        // ignore
      }
    }
  }, []);

  async function ingestFiles(files: File[]) {
    if (!files.length) return;
    const model = pickPrimaryModel(files);
    const { body, face } = pickBodyAndFaceMotions(files);
    const audio = pickPrimaryAudio(files) ?? files.find(isAudioFile) ?? null;
    const hdr = files.find((file) => /\.hdr$/i.test(file.name)) ?? null;

    if (model) await loadModelBundle(model, files);
    if (body) await handleBodyMotion(body);
    if (face) await handleFaceMotion(face);
    if (audio) await handleAudio(audio);
    if (hdr) {
      hdrFileRef.current = hdr;
      setSkyHdr(hdr);
    }

    if (!model && !body && !face && !audio && !hdr) {
      addNotification({
        title: t("mmdError"),
        message: t("mmdDropHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
    }
  }

  async function onPhysicsToggle(enabled: boolean) {
    setPhysicsEnabled(enabled);
    try {
      await apiRef.current?.setPhysicsEnabled(enabled);
      if (enabled) {
        addNotification({
          title: t("mmdPhysics"),
          message: t("mmdPhysicsReady"),
          type: "success",
          category: "media",
          appId: "mmd-studio",
          duration: 3500,
        });
      }
    } catch (error) {
      setPhysicsEnabled(false);
      addNotification({
        title: t("mmdPhysics"),
        message: error instanceof Error ? error.message : t("mmdPhysicsFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
    }
  }

  function togglePlay() {
    if (!models.length) {
      addNotification({ title: t("mmdNoModel"), message: t("mmdFolderHint"), type: "warning", category: "media", appId: "mmd-studio" });
      return;
    }
    const next = !playing;
    setPlaying(next);
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (next) {
      audio.playbackRate = speed;
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  function seek(value: number) {
    setCurrentTime(value);
    if (audioRef.current) audioRef.current.currentTime = value;
  }

  function clearRecordTimer() {
    if (recordTimerRef.current != null) {
      window.clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function finishRecord() {
    clearRecordTimer();
    const blob = await apiRef.current?.stopRecording();
    setRecording(false);
    setPlaying(false);
    audioRef.current?.pause();
    if (gridRestoreRef.current != null) {
      setShowGrid(gridRestoreRef.current);
      gridRestoreRef.current = null;
    }
    const canvas = apiRef.current?.getCanvas();
    if (canvas && canvasSizeRestoreRef.current) {
      canvas.width = canvasSizeRestoreRef.current.width;
      canvas.height = canvasSizeRestoreRef.current.height;
      canvasSizeRestoreRef.current = null;
    }
    if (!blob) return;
    if (exportObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(exportObjectUrlRef.current);
      } catch {
        // ignore
      }
    }
    const url = URL.createObjectURL(blob);
    exportObjectUrlRef.current = url;
    const name = buildExportFileName(exportFilePrefix, exportResolution, exportFps);
    addDownload({ name, source: t("appMmdStudio"), size: blob.size, mimeType: blob.type, url });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => {
      if (exportObjectUrlRef.current === url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
        exportObjectUrlRef.current = null;
      }
    }, 60_000);
    addNotification({ title: t("mmdExport"), message: name, type: "success", category: "media", appId: "mmd-studio" });
  }

  async function toggleRecord() {
    if (recording) {
      await finishRecord();
      return;
    }

    if (backend !== "webgl") {
      addNotification({ title: t("mmdExportNeedWebgl"), message: t("mmdWebgpuExperimental"), type: "warning", category: "media", appId: "mmd-studio" });
      return;
    }
    if (!models.length) {
      addNotification({ title: t("mmdNoModel"), message: t("mmdFolderHint"), type: "warning", category: "media", appId: "mmd-studio" });
      return;
    }

    const size = getExportSize(exportResolution);
    const canvas = apiRef.current?.getCanvas();
    if (canvas) {
      canvasSizeRestoreRef.current = { width: canvas.width, height: canvas.height };
      canvas.width = size.width;
      canvas.height = size.height;
    }

    if (exportHideGrid && showGrid) {
      gridRestoreRef.current = true;
      setShowGrid(false);
    } else {
      gridRestoreRef.current = null;
    }

    const start = exportIn > 0 ? exportIn : 0;
    const end = exportOut > 0 ? exportOut : duration;
    const safeStart = Math.min(start, end || start);
    seek(safeStart);
    setPlaying(true);
    if (audioRef.current?.src) {
      audioRef.current.currentTime = safeStart;
      audioRef.current.playbackRate = speed;
      if (exportIncludeAudio) void audioRef.current.play().catch(() => undefined);
      else audioRef.current.pause();
    }
    const recorder = apiRef.current?.startRecording({
      fps: exportFps,
      audio: audioRef.current,
      includeAudio: exportIncludeAudio,
      videoBitsPerSecond: getExportVideoBits(exportResolution, exportBitrate),
      mimeType: resolveExportMimeType(exportCodec),
    });
    if (!recorder) {
      if (gridRestoreRef.current != null) {
        setShowGrid(gridRestoreRef.current);
        gridRestoreRef.current = null;
      }
      if (canvas && canvasSizeRestoreRef.current) {
        canvas.width = canvasSizeRestoreRef.current.width;
        canvas.height = canvasSizeRestoreRef.current.height;
        canvasSizeRestoreRef.current = null;
      }
      return;
    }
    setRecording(true);

    const rangeMs = Math.ceil(exportRangeSeconds() * 1000) + 400;
    clearRecordTimer();
    recordTimerRef.current = window.setTimeout(() => {
      if (useMmdStudioStore.getState().recording) void finishRecord();
    }, rangeMs);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = await collectFilesFromDataTransfer(event.dataTransfer);
    await ingestFiles(files);
  }

  const postFxOptions: MmdPostFxPreset[] = ["off", "clean", "soft", "cinema", "dreamy", "film", "anime", "custom"];
  const backendDisabledPostFx = backend === "webgpu";
  const fxDisabled = backendDisabledPostFx || postFx === "off" || recording;
  const rangeEnd = exportOut > 0 ? exportOut : duration;
  const rangeLabel = duration > 0
    ? `${formatMmdTime(exportIn)} – ${formatMmdTime(rangeEnd || duration)}`
    : "—";
  const statusTone = status === "error" ? "is-error" : status === "loading" ? "is-busy" : status === "ready" ? "is-ready" : "";
  const statusText = status === "loading"
    ? t("mmdLoading")
    : status === "error"
      ? `${t("mmdError")}: ${statusMessage}`
      : status === "ready"
        ? t("mmdReady")
        : t("mmdIdle");

  function postFxLabel(option: MmdPostFxPreset) {
    if (option === "off") return t("mmdPostFxOff");
    if (option === "clean") return t("mmdPostFxClean");
    if (option === "soft") return t("mmdPostFxSoft");
    if (option === "cinema") return t("mmdPostFxCinema");
    if (option === "dreamy") return t("mmdPostFxDreamy");
    if (option === "film") return t("mmdPostFxFilm");
    if (option === "anime") return t("mmdPostFxAnime");
    return t("mmdPostFxCustom");
  }

  function lutLabel(look: MmdLutLook) {
    if (look === "warm") return t("mmdLutWarm");
    if (look === "cool") return t("mmdLutCool");
    if (look === "film") return t("mmdLutFilm");
    return t("mmdLutNone");
  }

  function bitrateLabel(value: MmdExportBitrate) {
    if (value === "low") return t("mmdBitrateLow");
    if (value === "medium") return t("mmdBitrateMedium");
    if (value === "ultra") return t("mmdBitrateUltra");
    return t("mmdBitrateHigh");
  }

  function codecLabel(value: MmdExportCodec) {
    if (value === "vp8") return "VP8";
    if (value === "vp9") return "VP9";
    return t("mmdCodecAuto");
  }

  const exportBitsMbps = (getExportVideoBits(exportResolution, exportBitrate) / 1_000_000).toFixed(1);
  const exportSize = getExportSize(exportResolution);

  return (
    <div
      className={dragOver ? "mmd-studio-app is-dragover" : "mmd-studio-app"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => void onDrop(event)}
    >
      <header className="mmd-toolbar">
        <div className="mmd-toolbar-group">
          <button type="button" className="button-primary" onClick={() => folderInputRef.current?.click()}>
            <Icon icon="solar:folder-with-files-bold-duotone" width={16} height={16} />
            {t("mmdLoadFolder")}
          </button>
          <div className="mmd-seg">
            <button type="button" className="button-ghost" onClick={() => modelInputRef.current?.click()}>{t("mmdLoadModel")}</button>
            <button type="button" className="button-ghost" onClick={() => bodyMotionInputRef.current?.click()}>{t("mmdLoadBodyMotion")}</button>
            <button type="button" className="button-ghost" onClick={() => faceMotionInputRef.current?.click()}>{t("mmdLoadFaceMotion")}</button>
            <button type="button" className="button-ghost" onClick={() => audioInputRef.current?.click()}>{t("mmdLoadAudio")}</button>
          </div>
        </div>
        <div className="mmd-toolbar-group mmd-toolbar-meta">
          <label className="mmd-inline-field">
            <span>{t("mmdBackend")}</span>
            <select value={backend} onChange={(event) => setBackend(event.target.value as MmdRendererBackend)}>
              <option value="webgl">{t("mmdBackendWebgl")}</option>
              <option value="webgpu" disabled={!webgpuAvailable}>{t("mmdBackendWebgpu")}</option>
            </select>
          </label>
          <span className={`mmd-status-chip ${statusTone}`}>{statusText}</span>
          {recording ? <span className="mmd-status-chip is-rec">{t("mmdExporting")}</span> : null}
        </div>
      </header>

      <p className="mmd-tip" title={`${t("mmdFolderHint")} ${t("mmdDisclaimer")}`}>
        {backend === "webgpu" ? `${t("mmdWebgpuExperimental")} · ` : null}
        {t("mmdFolderHint")} · {t("mmdDisclaimer")}
      </p>

      <div className="mmd-main">
        <div className="mmd-viewport">
          <MmdCanvas backend={backend} audioRef={audioRef} apiRef={apiRef} />
          {!models.length ? (
            <div className="mmd-empty">
              <Icon icon="solar:box-minimalistic-bold-duotone" width={28} height={28} />
              <strong>{t("mmdDropHint")}</strong>
              <span>{t("mmdFolderHint")}</span>
            </div>
          ) : null}
          {recording ? <div className="mmd-rec-badge">{t("mmdExporting")}</div> : null}
        </div>

        <aside className="mmd-side">
          <PanelSection title={t("mmdSectionScene")}>
            <div className="mmd-model-list">
              {models.length ? models.map((model) => (
                <div
                  key={model.id}
                  className={model.id === selectedModelId ? "mmd-model-item is-selected" : "mmd-model-item"}
                  onClick={() => {
                    setSelectedModelId(model.id);
                    apiRef.current?.selectModel(model.id);
                  }}
                >
                  <span className="mmd-model-item-name" title={model.name}>{model.name}</span>
                  <span className="mmd-model-item-actions">
                    <button
                      type="button"
                      className="button-ghost mmd-mini-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        apiRef.current?.setModelVisible(model.id, !model.visible);
                      }}
                    >
                      {model.visible ? t("mmdHide") : t("mmdShow")}
                    </button>
                    <button
                      type="button"
                      className="button-ghost mmd-mini-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        apiRef.current?.removeModel(model.id);
                      }}
                    >
                      {t("mmdRemoveModel")}
                    </button>
                  </span>
                </div>
              )) : <p className="mmd-note">{t("mmdNoModels")}</p>}
            </div>
            <div className="mmd-range-actions">
              <button type="button" className="button-primary mmd-mini-btn" onClick={() => folderInputRef.current?.click()}>{t("mmdAddModel")}</button>
              <button type="button" className="button-ghost mmd-mini-btn" onClick={() => modelInputRef.current?.click()}>{t("mmdLoadModel")}</button>
            </div>
            <AssetRow label={t("mmdBodyMotion")} value={selectedModel?.bodyMotionName ?? null} onPick={() => bodyMotionInputRef.current?.click()} pickLabel={t("mmdLoadBodyMotion")} />
            <AssetRow label={t("mmdFaceMotion")} value={selectedModel?.faceMotionName ?? null} onPick={() => faceMotionInputRef.current?.click()} pickLabel={t("mmdLoadFaceMotion")} />
            <AssetRow label={t("mmdAudio")} value={audioName} onPick={() => audioInputRef.current?.click()} pickLabel={t("mmdLoadAudio")} />
            <div className="mmd-meta-line">
              <span>{t("mmdTextures")}</span>
              <span>{textureInfo || "—"}</span>
            </div>
          </PanelSection>

          <PanelSection title={t("mmdSectionMorph")} collapsible defaultOpen={false}>
            {selectedModel?.morphNames.length ? (
              <div className="mmd-fx-grid">
                {selectedModel.morphNames.slice(0, 24).map((name) => (
                  <SliderField
                    key={name}
                    label={name}
                    value={selectedModel.morphWeights[name] ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    display={(selectedModel.morphWeights[name] ?? 0).toFixed(2)}
                    onChange={(weight) => apiRef.current?.setMorphWeight(selectedModel.id, name, weight)}
                  />
                ))}
                {selectedModel.morphNames.length > 24 ? <p className="mmd-note">{t("mmdMorphTruncated")}</p> : null}
              </div>
            ) : <p className="mmd-note">{t("mmdMorphEmpty")}</p>}
          </PanelSection>

          <PanelSection title={t("mmdSectionParts")} collapsible defaultOpen={false}>
            {selectedModel?.materialNames.length ? (
              <div className="mmd-toggle-grid">
                {selectedModel.materialNames.map((name) => (
                  <label key={name} className="mmd-check">
                    <input
                      type="checkbox"
                      checked={selectedModel.materialVisible[name] !== false}
                      onChange={(event) => apiRef.current?.setMaterialVisible(selectedModel.id, name, event.target.checked)}
                    />
                    <span title={name}>{name}</span>
                  </label>
                ))}
              </div>
            ) : <p className="mmd-note">{t("mmdPartsEmpty")}</p>}
          </PanelSection>

          <PanelSection title={t("mmdSectionPlayback")}>
            <div className="mmd-toggle-grid">
              <label className="mmd-check">
                <input
                  type="checkbox"
                  checked={physicsEnabled}
                  disabled={status === "loading" || recording}
                  onChange={(event) => void onPhysicsToggle(event.target.checked)}
                />
                <span>{t("mmdPhysics")}</span>
                {physicsEnabled && physicsReady ? <span className="mmd-pill">{t("mmdPhysicsOn")}</span> : null}
              </label>
              <label className="mmd-check">
                <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
                <span>{t("mmdLoop")}</span>
              </label>
            </div>
            <label className="mmd-field">
              <span>{t("mmdCamera")}</span>
              <select value={cameraMode} onChange={(event) => setCameraMode(event.target.value as "free" | "motion")}>
                <option value="free">{t("mmdCameraFree")}</option>
                <option value="motion">{t("mmdCameraMotion")}</option>
              </select>
            </label>
            {cameraMode === "free" ? <p className="mmd-note">{t("mmdCameraKeys")}</p> : null}
            {cameraMode === "free" ? (
              <SliderField
                label={t("mmdCameraMoveSpeed")}
                value={cameraMoveSpeed}
                min={1}
                max={40}
                step={0.5}
                display={cameraMoveSpeed.toFixed(1)}
                onChange={(next) => setCameraMoveSpeed(next)}
              />
            ) : null}
            <SliderField
              label={t("mmdSpeed")}
              value={speed}
              min={0.5}
              max={1.5}
              step={0.05}
              display={`${speed.toFixed(2)}x`}
              onChange={(next) => {
                setSpeed(next);
                if (audioRef.current) audioRef.current.playbackRate = next;
              }}
            />
          </PanelSection>

          <PanelSection
            title={t("mmdSectionLook")}
            actions={(
              <button type="button" className="button-ghost mmd-mini-btn" onClick={() => setFxOpen((open) => !open)}>
                {fxOpen ? t("mmdCollapse") : t("mmdExpand")}
              </button>
            )}
          >
            <AssetRow
              label={t("mmdSkyHdr")}
              value={skyHdrName}
              onPick={() => hdrInputRef.current?.click()}
              pickLabel={skyHdrName ? t("mmdSkyReplace") : t("mmdSkyLoad")}
            />
            {skyHdrName ? (
              <div className="mmd-range-actions">
                <button type="button" className="button-ghost mmd-mini-btn" onClick={() => setSkyHdr(null)}>
                  {t("mmdSkyClear")}
                </button>
              </div>
            ) : (
              <p className="mmd-note">{t("mmdSkyHint")}</p>
            )}
            <label className="mmd-check">
              <input type="checkbox" checked={skyAsBackground} disabled={!skyHdrName} onChange={(event) => setSkyAsBackground(event.target.checked)} />
              <span>{t("mmdSkyAsBackground")}</span>
            </label>
            <label className="mmd-check">
              <input type="checkbox" checked={skyAsEnvironment} disabled={!skyHdrName} onChange={(event) => setSkyAsEnvironment(event.target.checked)} />
              <span>{t("mmdSkyAsEnvironment")}</span>
            </label>
            <SliderField
              label={t("mmdEnvIntensity")}
              value={envIntensity}
              min={0}
              max={3}
              step={0.05}
              display={envIntensity.toFixed(2)}
              disabled={!skyHdrName || !skyAsEnvironment}
              onChange={(next) => setEnvIntensity(next)}
            />
            <label className="mmd-check">
              <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
              <span>{t("mmdShowGrid")}</span>
            </label>
            <SliderField
              label={t("mmdAmbientIntensity")}
              value={lights.ambientIntensity}
              min={0}
              max={2}
              step={0.01}
              display={lights.ambientIntensity.toFixed(2)}
              onChange={(ambientIntensity) => setLights({ ambientIntensity })}
            />
            <SliderField
              label={t("mmdSunIntensity")}
              value={lights.sunIntensity}
              min={0}
              max={4}
              step={0.01}
              display={lights.sunIntensity.toFixed(2)}
              onChange={(sunIntensity) => setLights({ sunIntensity })}
            />
            <SliderField
              label={t("mmdSunAzimuth")}
              value={lights.sunAzimuth}
              min={-180}
              max={180}
              step={1}
              display={`${lights.sunAzimuth.toFixed(0)}°`}
              onChange={(sunAzimuth) => setLights({ sunAzimuth })}
            />
            <SliderField
              label={t("mmdSunElevation")}
              value={lights.sunElevation}
              min={5}
              max={89}
              step={1}
              display={`${lights.sunElevation.toFixed(0)}°`}
              onChange={(sunElevation) => setLights({ sunElevation })}
            />
            <label className="mmd-check">
              <input
                type="checkbox"
                checked={lights.sunCastShadow}
                onChange={(event) => setLights({ sunCastShadow: event.target.checked })}
              />
              <span>{t("mmdSunCastShadow")}</span>
            </label>
            <button type="button" className="button-ghost mmd-reset-fx" onClick={() => resetLights()}>
              {t("mmdLightsReset")}
            </button>
            <label className="mmd-field">
              <span>{t("mmdPostFx")}</span>
              <select
                value={backendDisabledPostFx ? "off" : postFx}
                disabled={backendDisabledPostFx || recording}
                onChange={(event) => setPostFx(event.target.value as MmdPostFxPreset)}
              >
                {postFxOptions.map((option) => (
                  <option key={option} value={option}>{postFxLabel(option)}</option>
                ))}
              </select>
            </label>
            {backendDisabledPostFx ? <p className="mmd-note">{t("mmdPostFxWebgpuDisabled")}</p> : null}
            {fxOpen && !backendDisabledPostFx && postFx !== "off" ? (
              <div className="mmd-fx-grid">
                <div className="mmd-field-row">
                  <label className="mmd-field">
                    <span>SMAA</span>
                    <select
                      value={postFxTune.smaa}
                      disabled={fxDisabled}
                      onChange={(event) => setPostFxTune({ smaa: event.target.value as MmdSmaaQuality })}
                    >
                      <option value="low">{t("mmdSmaaLow")}</option>
                      <option value="medium">{t("mmdSmaaMedium")}</option>
                      <option value="high">{t("mmdSmaaHigh")}</option>
                      <option value="ultra">{t("mmdSmaaUltra")}</option>
                    </select>
                  </label>
                  <label className="mmd-field">
                    <span>MSAA</span>
                    <select
                      value={postFxTune.msaa}
                      disabled={fxDisabled}
                      onChange={(event) => setPostFxTune({ msaa: Number(event.target.value) as MmdMsaaSamples })}
                    >
                      <option value={0}>{t("mmdMsaaOff")}</option>
                      <option value={2}>2x</option>
                      <option value={4}>4x</option>
                      <option value={8}>8x</option>
                    </select>
                  </label>
                </div>
                <SliderField label={t("mmdFxBloom")} value={postFxTune.bloom} min={0} max={1} step={0.01} display={postFxTune.bloom.toFixed(2)} disabled={fxDisabled} onChange={(bloom) => setPostFxTune({ bloom })} />
                <SliderField label={t("mmdFxBloomThreshold")} value={postFxTune.bloomThreshold} min={0.4} max={1} step={0.01} display={postFxTune.bloomThreshold.toFixed(2)} disabled={fxDisabled} onChange={(bloomThreshold) => setPostFxTune({ bloomThreshold })} />
                <SliderField label={t("mmdFxVignette")} value={postFxTune.vignette} min={0} max={0.8} step={0.01} display={postFxTune.vignette.toFixed(2)} disabled={fxDisabled} onChange={(vignette) => setPostFxTune({ vignette })} />
                <SliderField label={t("mmdFxBrightness")} value={postFxTune.brightness} min={-0.3} max={0.3} step={0.01} display={postFxTune.brightness.toFixed(2)} disabled={fxDisabled} onChange={(brightness) => setPostFxTune({ brightness })} />
                <SliderField label={t("mmdFxContrast")} value={postFxTune.contrast} min={-0.4} max={0.4} step={0.01} display={postFxTune.contrast.toFixed(2)} disabled={fxDisabled} onChange={(contrast) => setPostFxTune({ contrast })} />
                <SliderField label={t("mmdFxSaturation")} value={postFxTune.saturation} min={-0.5} max={0.5} step={0.01} display={postFxTune.saturation.toFixed(2)} disabled={fxDisabled} onChange={(saturation) => setPostFxTune({ saturation })} />
                <SliderField label={t("mmdFxChroma")} value={postFxTune.chroma} min={0} max={1} step={0.01} display={postFxTune.chroma.toFixed(2)} disabled={fxDisabled} onChange={(chroma) => setPostFxTune({ chroma })} />
                <SliderField label={t("mmdFxDof")} value={postFxTune.dof} min={0} max={1} step={0.01} display={postFxTune.dof.toFixed(2)} disabled={fxDisabled} onChange={(dof) => setPostFxTune({ dof })} />
                <SliderField label={t("mmdFxDofFocus")} value={postFxTune.dofFocus} min={4} max={40} step={0.5} display={postFxTune.dofFocus.toFixed(1)} disabled={fxDisabled || postFxTune.dof < 0.001} onChange={(dofFocus) => setPostFxTune({ dofFocus })} />
                <SliderField label={t("mmdFxDofRange")} value={postFxTune.dofRange} min={2} max={30} step={0.5} display={postFxTune.dofRange.toFixed(1)} disabled={fxDisabled || postFxTune.dof < 0.001} onChange={(dofRange) => setPostFxTune({ dofRange })} />
                <SliderField label={t("mmdFxGrain")} value={postFxTune.grain} min={0} max={1} step={0.01} display={postFxTune.grain.toFixed(2)} disabled={fxDisabled} onChange={(grain) => setPostFxTune({ grain })} />
                <SliderField label={t("mmdFxSsao")} value={postFxTune.ssao} min={0} max={1} step={0.01} display={postFxTune.ssao.toFixed(2)} disabled={fxDisabled} onChange={(ssao) => setPostFxTune({ ssao })} />
                <SliderField label={t("mmdFxOutline")} value={postFxTune.outline} min={0} max={1} step={0.01} display={postFxTune.outline.toFixed(2)} disabled={fxDisabled} onChange={(outline) => setPostFxTune({ outline })} />
                <label className="mmd-field">
                  <span>{t("mmdFxLut")}</span>
                  <select
                    value={postFxTune.lut}
                    disabled={fxDisabled}
                    onChange={(event) => setPostFxTune({ lut: event.target.value as MmdLutLook })}
                  >
                    {(["none", "warm", "cool", "film"] as MmdLutLook[]).map((look) => (
                      <option key={look} value={look}>{lutLabel(look)}</option>
                    ))}
                  </select>
                </label>
                <label className="mmd-check">
                  <input
                    type="checkbox"
                    checked={postFxTune.toneMapping}
                    disabled={fxDisabled}
                    onChange={(event) => setPostFxTune({ toneMapping: event.target.checked })}
                  />
                  <span>{t("mmdFxToneMapping")}</span>
                </label>
                <p className="mmd-note">{t("mmdFxAdvancedNote")}</p>
                <button type="button" className="button-ghost mmd-reset-fx" disabled={fxDisabled} onClick={() => resetPostFxTune()}>
                  {t("mmdFxReset")}
                </button>
              </div>
            ) : null}
          </PanelSection>

          <PanelSection title={t("mmdSectionExport")}>
            <div className="mmd-field-row">
              <label className="mmd-field">
                <span>{t("mmdResolution")}</span>
                <select value={exportResolution} disabled={recording} onChange={(event) => setExportResolution(event.target.value as MmdExportResolution)}>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                  <option value="1440p">1440p</option>
                  <option value="2160p">2160p</option>
                </select>
              </label>
              <label className="mmd-field">
                <span>{t("mmdFps")}</span>
                <select value={exportFps} disabled={recording} onChange={(event) => setExportFps(Number(event.target.value) as 24 | 30 | 60 | 120)}>
                  <option value={24}>24</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={120}>120</option>
                </select>
              </label>
            </div>
            <div className="mmd-field-row">
              <label className="mmd-field">
                <span>{t("mmdExportCodec")}</span>
                <select value={exportCodec} disabled={recording} onChange={(event) => setExportCodec(event.target.value as MmdExportCodec)}>
                  {(["auto", "vp9", "vp8"] as MmdExportCodec[]).map((codec) => (
                    <option key={codec} value={codec}>{codecLabel(codec)}</option>
                  ))}
                </select>
              </label>
              <label className="mmd-field">
                <span>{t("mmdExportBitrate")}</span>
                <select value={exportBitrate} disabled={recording} onChange={(event) => setExportBitrate(event.target.value as MmdExportBitrate)}>
                  {(["low", "medium", "high", "ultra"] as MmdExportBitrate[]).map((rate) => (
                    <option key={rate} value={rate}>{bitrateLabel(rate)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mmd-field">
              <span>{t("mmdExportFilePrefix")}</span>
              <input
                type="text"
                value={exportFilePrefix}
                disabled={recording}
                maxLength={48}
                onChange={(event) => setExportFilePrefix(event.target.value)}
                onBlur={(event) => setExportFilePrefix(event.target.value)}
              />
            </label>
            <label className="mmd-check">
              <input type="checkbox" checked={exportIncludeAudio} disabled={recording} onChange={(event) => setExportIncludeAudio(event.target.checked)} />
              <span>{t("mmdExportIncludeAudio")}</span>
            </label>
            <label className="mmd-check">
              <input type="checkbox" checked={exportHideGrid} disabled={recording} onChange={(event) => setExportHideGrid(event.target.checked)} />
              <span>{t("mmdExportHideGrid")}</span>
            </label>
            <p className="mmd-note">
              {exportSize.width}×{exportSize.height} · {exportBitsMbps} Mbps · {resolveExportMimeType(exportCodec)}
              {exportFps >= 120 ? ` · ${t("mmdExportFpsNote")}` : ""}
            </p>
            <div className="mmd-range-row">
              <div className="mmd-meta-line">
                <span>{t("mmdExportRange")}</span>
                <span className="mmd-mono">{rangeLabel}</span>
              </div>
              <div className="mmd-range-actions">
                <button type="button" className="button-ghost mmd-mini-btn" disabled={recording} onClick={() => setExportIn(currentTime)}>{t("mmdMarkIn")}</button>
                <button type="button" className="button-ghost mmd-mini-btn" disabled={recording} onClick={() => setExportOut(currentTime)}>{t("mmdMarkOut")}</button>
                <button
                  type="button"
                  className="button-ghost mmd-mini-btn"
                  disabled={recording || duration <= 0}
                  onClick={() => {
                    setExportIn(0);
                    setExportOut(duration);
                  }}
                >
                  {t("mmdClearRange")}
                </button>
              </div>
            </div>
          </PanelSection>

          <PanelSection title={t("mmdSectionProject")} collapsible defaultOpen={false}>
            <label className="mmd-field">
              <span>{t("mmdProjectName")}</span>
              <input
                type="text"
                value={projectName}
                disabled={recording || projectBusy}
                maxLength={64}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>
            <div className="mmd-range-actions">
              <button
                type="button"
                className="button-primary mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={() => {
                  void (async () => {
                    setProjectBusy(true);
                    try {
                      await saveCurrentProject();
                      addNotification({
                        title: t("mmdProject"),
                        message: t("mmdProjectSaved"),
                        type: "success",
                        category: "media",
                        appId: "mmd-studio",
                        duration: 3000,
                      });
                    } catch (error) {
                      addNotification({
                        title: t("mmdProject"),
                        message: error instanceof Error ? error.message : t("mmdProjectSaveFailed"),
                        type: "error",
                        category: "media",
                        appId: "mmd-studio",
                      });
                    } finally {
                      setProjectBusy(false);
                    }
                  })();
                }}
              >
                {t("mmdProjectSave")}
              </button>
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={() => {
                  void (async () => {
                    setProjectBusy(true);
                    try {
                      setLastProjectId(null);
                      await saveCurrentProject({ name: `${projectName} copy` });
                      addNotification({
                        title: t("mmdProject"),
                        message: t("mmdProjectSaved"),
                        type: "success",
                        category: "media",
                        appId: "mmd-studio",
                        duration: 3000,
                      });
                    } catch {
                      // ignore
                    } finally {
                      setProjectBusy(false);
                    }
                  })();
                }}
              >
                {t("mmdProjectSaveAs")}
              </button>
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={() => void refreshProjectList()}
              >
                {t("mmdProjectRefresh")}
              </button>
            </div>
            <p className="mmd-note">{t("mmdProjectHint")}</p>
            <div className="mmd-model-list">
              {projectList.length ? projectList.map((project) => (
                <div key={project.id} className={project.id === lastProjectId ? "mmd-model-item is-selected" : "mmd-model-item"}>
                  <span className="mmd-model-item-name" title={project.name}>
                    {project.name}
                    <br />
                    <small className="mmd-note">{new Date(project.updatedAt).toLocaleString()}</small>
                  </span>
                  <span className="mmd-model-item-actions">
                    <button
                      type="button"
                      className="button-ghost mmd-mini-btn"
                      disabled={recording || projectBusy}
                      onClick={() => void loadProjectRecord(project)}
                    >
                      {t("mmdProjectLoad")}
                    </button>
                    <button
                      type="button"
                      className="button-ghost mmd-mini-btn"
                      disabled={recording || projectBusy}
                      onClick={() => {
                        void (async () => {
                          await deleteMmdProject(project.id);
                          if (lastProjectId === project.id) setLastProjectId(null);
                          await refreshProjectList();
                        })();
                      }}
                    >
                      {t("mmdProjectDelete")}
                    </button>
                  </span>
                </div>
              )) : <p className="mmd-note">{t("mmdProjectEmpty")}</p>}
            </div>
            <button
              type="button"
              className="button-ghost mmd-mini-btn"
              disabled={recording || projectBusy}
              onClick={() => {
                void (async () => {
                  const autosave = await getMmdAutosave();
                  if (!autosave) {
                    addNotification({
                      title: t("mmdProject"),
                      message: t("mmdProjectNoAutosave"),
                      type: "warning",
                      category: "media",
                      appId: "mmd-studio",
                    });
                    return;
                  }
                  await loadProjectRecord(autosave);
                })();
              }}
            >
              {t("mmdProjectRestoreAutosave")}
            </button>
          </PanelSection>
        </aside>
      </div>

      <footer className="mmd-transport">
        <div className="mmd-transport-actions">
          <button type="button" className="button-primary" onClick={togglePlay}>
            <Icon icon={playing ? "solar:pause-bold" : "solar:play-bold"} width={14} height={14} />
            {playing ? t("pause") : t("start")}
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              seek(0);
              setPlaying(false);
              audioRef.current?.pause();
            }}
          >
            {t("reset")}
          </button>
        </div>
        <div className="mmd-scrub">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.01}
            value={Math.min(currentTime, Math.max(duration, 0.01))}
            onChange={(event) => seek(Number(event.target.value))}
          />
          {duration > 0 ? (
            <div
              className="mmd-range-marks"
              style={{
                left: `${(exportIn / duration) * 100}%`,
                width: `${(Math.max(0, (rangeEnd || duration) - exportIn) / duration) * 100}%`,
              }}
            />
          ) : null}
        </div>
        <span className="mmd-mono">{formatMmdTime(currentTime)} / {formatMmdTime(duration)}</span>
        <button type="button" className={recording ? "button-primary" : "button-ghost"} onClick={() => void toggleRecord()}>
          <Icon icon={recording ? "solar:stop-bold" : "solar:videocamera-record-bold"} width={14} height={14} />
          {recording ? t("mmdStopExport") : t("mmdExport")}
        </button>
      </footer>

      <audio ref={audioRef} preload="auto" />
      <input
        ref={(node) => {
          folderInputRef.current = node;
          if (node) {
            node.setAttribute("webkitdirectory", "");
            node.setAttribute("directory", "");
          }
        }}
        hidden
        type="file"
        multiple
        onChange={(event) => event.target.files && void ingestFiles(Array.from(event.target.files))}
      />
      <input
        ref={modelInputRef}
        hidden
        type="file"
        accept=".pmx,.pmd"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void loadModelBundle(file, [file]);
        }}
      />
      <input ref={bodyMotionInputRef} hidden type="file" accept=".vmd,.vpd" onChange={(event) => event.target.files?.[0] && void handleBodyMotion(event.target.files[0])} />
      <input ref={faceMotionInputRef} hidden type="file" accept=".vmd,.vpd" onChange={(event) => event.target.files?.[0] && void handleFaceMotion(event.target.files[0])} />
      <input ref={audioInputRef} hidden type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && void handleAudio(event.target.files[0])} />
      <input
        ref={hdrInputRef}
        hidden
        type="file"
        accept=".hdr,image/vnd.radiance"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            hdrFileRef.current = file;
            setSkyHdr(file);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
