import { Icon } from "@iconify-icon/react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import { useOsUiStore } from "../../osUiStore";
import {
  collectFilesFromDataTransfer,
  companionsForModel,
  defaultSelectedModels,
  listModelFiles,
  modelRelativePath,
  pickBodyAndFaceMotions,
  pickPrimaryAudio,
  relativeDirOf,
} from "./folderImport";
import { MmdCanvas, type MmdSceneApi } from "./MmdCanvas";
import {
  MMD_SIDE_WIDTH_MAX,
  MMD_SIDE_WIDTH_MIN,
  MMD_TRANSPORT_HEIGHT_MAX,
  MMD_TRANSPORT_HEIGHT_MIN,
} from "./mmdLayoutPrefs";
import { MmdProjectHome } from "./MmdProjectHome";
import { MmdSelect } from "./mmdPanelUi";
import { MmdSidePanel } from "./MmdSidePanel";
import { MmdTimelineBar } from "./MmdTimelineBar";
import type { MmdProjectModelAssets } from "./mmdRuntime";
import { pickSkyPanoramaFile, SKY_FILE_ACCEPT } from "./mmdSkyFormats";
import {
  useMmdStudioStore,
  type MmdRendererBackend,
} from "./mmdStudioStore";
import { isAudioFile } from "./mmdUtils";
import { useMmdLayout } from "./useMmdLayout";
import { useMmdProjectController } from "./useMmdProjectController";
import { useMmdRecordingController } from "./useMmdRecordingController";
import type { MmdProjectRecord } from "./mmdProjectDb";

async function waitForSceneApi(apiRef: { current: MmdSceneApi | null }, timeoutMs = 6000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (apiRef.current) return apiRef.current;
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  return apiRef.current;
}

export function MmdStudioApp({ windowId }: { windowId?: string } = {}) {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const immersiveWindowId = useOsUiStore((state) => state.immersiveWindowId);
  const toggleImmersive = useOsUiStore((state) => state.toggleImmersive);
  const exitImmersive = useOsUiStore((state) => state.exitImmersive);
  const isImmersive = Boolean(windowId && immersiveWindowId === windowId);
  const backend = useMmdStudioStore((state) => state.backend);
  const setBackend = useMmdStudioStore((state) => state.setBackend);
  const playing = useMmdStudioStore((state) => state.playing);
  const setPlaying = useMmdStudioStore((state) => state.setPlaying);
  const currentTime = useMmdStudioStore((state) => state.currentTime);
  const setCurrentTime = useMmdStudioStore((state) => state.setCurrentTime);
  const duration = useMmdStudioStore((state) => state.duration);
  const models = useMmdStudioStore((state) => state.models);
  const setAudioName = useMmdStudioStore((state) => state.setAudioName);
  const setSkyHdr = useMmdStudioStore((state) => state.setSkyHdr);
  const status = useMmdStudioStore((state) => state.status);
  const statusMessage = useMmdStudioStore((state) => state.statusMessage);
  const webgpuAvailable = useMmdStudioStore((state) => state.webgpuAvailable);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const setExportIn = useMmdStudioStore((state) => state.setExportIn);
  const setExportOut = useMmdStudioStore((state) => state.setExportOut);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const apiRef = useRef<MmdSceneApi | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const bodyMotionInputRef = useRef<HTMLInputElement | null>(null);
  const faceMotionInputRef = useRef<HTMLInputElement | null>(null);
  const cameraMotionInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const hdrInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const hdrFileRef = useRef<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [textureInfo, setTextureInfo] = useState("");
  const [view, setView] = useState<"home" | "editor">("home");
  const [backendSwitching, setBackendSwitching] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(true);
  const backendSwitchTokenRef = useRef(0);
  const [modelPick, setModelPick] = useState<{
    models: File[];
    pack: File[];
    selected: Record<string, boolean>;
    query: string;
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const {
    layoutPrefs,
    rootRef,
    mainRef,
    beginSideResize,
    beginTransportResize,
    onSideKeyDown,
    onTransportKeyDown,
    resetSideWidth,
    resetTransportHeight,
    setSideCollapsed,
  } = useMmdLayout();

  async function loadModelBundle(
    modelFile: File,
    companionFiles: File[],
    options?: { offsetX?: number; quietTextureToast?: boolean },
  ) {
    const report = await apiRef.current?.addModel(modelFile, companionFiles, {
      physics: useMmdStudioStore.getState().physicsEnabled,
      offsetX: options?.offsetX,
    });
    if (!report) return false;
    if (report.textureCount === 0) {
      setTextureInfo(t("mmdTextureNone"));
      if (!options?.quietTextureToast) {
        addNotification({
          title: t("mmdTextureMissingTitle"),
          message: t("mmdTextureFolderHint"),
          type: "warning",
          category: "media",
          appId: "mmd-studio",
          duration: 6000,
        });
      }
      return true;
    }
    if (report.missingTextures.length) {
      const preview = report.missingTextures.slice(0, 3).join(", ");
      setTextureInfo(`${t("mmdTexturePartial")}: ${preview}${report.missingTextures.length > 3 ? "…" : ""}`);
      if (!options?.quietTextureToast) {
        addNotification({
          title: t("mmdTextureMissingTitle"),
          message: `${report.missingTextures.length} ${t("mmdTextureMissingCount")}`,
          type: "warning",
          category: "media",
          appId: "mmd-studio",
          duration: 6000,
        });
      }
      return true;
    }
    setTextureInfo(`${t("mmdTextureOk")}: ${report.textureCount}`);
    return true;
  }

  async function loadSelectedModels(models: File[], pack: File[]) {
    let ok = 0;
    let fail = 0;
    const baseCount = useMmdStudioStore.getState().models.length;
    const total = models.length;
    setImportProgress({ current: 0, total });
    try {
      for (let i = 0; i < models.length; i += 1) {
        const model = models[i]!;
        setImportProgress({ current: i + 1, total });
        try {
          const companions = companionsForModel(model, pack);
          // Spread multi-import along X so models do not stack.
          const offsetX = (baseCount + i) * 1.35;
          const success = await loadModelBundle(model, companions, {
            offsetX,
            quietTextureToast: total > 1,
          });
          if (success) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }
    } finally {
      setImportProgress(null);
    }
    if (ok + fail > 1 || fail) {
      addNotification({
        title: t("mmdAddModel"),
        message: fail
          ? t("mmdModelsImportPartial").replace("{ok}", String(ok)).replace("{fail}", String(fail))
          : t("mmdModelsImported").replace("{n}", String(ok)),
        type: fail && !ok ? "error" : fail ? "warning" : "success",
        category: "media",
        appId: "mmd-studio",
        duration: 4500,
      });
    }
  }

  function openModelPicker(models: File[], pack: File[]) {
    setModelPick({
      models,
      pack,
      selected: defaultSelectedModels(models),
      query: "",
    });
  }

  async function confirmModelPicker() {
    if (!modelPick || importProgress) return;
    const chosen = modelPick.models.filter((file) => modelPick.selected[modelRelativePath(file)]);
    const pack = modelPick.pack;
    setModelPick(null);
    if (!chosen.length) return;
    await loadSelectedModels(chosen, pack);
  }

  useEffect(() => {
    if (!modelPick) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !importProgress) setModelPick(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importProgress, modelPick]);

  async function handleBodyMotion(file: File) {
    await apiRef.current?.loadMotion(file, "body", useMmdStudioStore.getState().selectedModelId);
  }

  async function handleFaceMotion(file: File) {
    await apiRef.current?.loadMotion(file, "face", useMmdStudioStore.getState().selectedModelId);
  }

  async function handleCameraMotion(file: File) {
    await apiRef.current?.loadMotion(file, "camera", useMmdStudioStore.getState().selectedModelId);
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

  function seek(value: number) {
    const t = Number.isFinite(value) ? Math.max(0, value) : 0;
    // Prefer canvas seekTime so the next rAF reads the correct frame (export).
    if (apiRef.current) apiRef.current.seekTime(t);
    else setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  }

  async function handleBackendChange(next: MmdRendererBackend) {
    if (next === backend || backendSwitching) return;
    if (next === "webgpu" && !webgpuAvailable) return;
    const token = ++backendSwitchTokenRef.current;
    const prevApi = apiRef.current;
    const snapshot: MmdProjectModelAssets[] = prevApi?.exportProjectModels() ?? [];
    const selectedId = useMmdStudioStore.getState().selectedModelId;
    const physics = useMmdStudioStore.getState().physicsEnabled;
    const time = useMmdStudioStore.getState().currentTime;

    setBackendSwitching(true);
    setPlaying(false);
    try {
      // Fully tear down previous renderer before requesting a new GPU device.
      apiRef.current = null;
      setCanvasMounted(false);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      if (token !== backendSwitchTokenRef.current) return;

      setBackend(next);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      if (token !== backendSwitchTokenRef.current) return;

      setCanvasMounted(true);
      const api = await waitForSceneApi(apiRef, 10_000);
      if (token !== backendSwitchTokenRef.current) return;
      if (!api) throw new Error("Scene API unavailable after backend switch");
      if (snapshot.length) {
        await api.restoreScene(snapshot, { physics, selectedId });
        if (token !== backendSwitchTokenRef.current) return;
        seek(time);
      }
    } catch (error) {
      addNotification({
        title: t("mmdError"),
        message: error instanceof Error ? error.message : String(error),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
      // Prefer recovering to WebGL if WebGPU path failed.
      if (next === "webgpu") {
        setBackend("webgl");
        setCanvasMounted(true);
      }
    } finally {
      if (token === backendSwitchTokenRef.current) setBackendSwitching(false);
    }
  }

  const {
    projectList,
    projectBusy,
    projectName,
    setProjectName,
    lastProjectId,
    hasAutosave,
    projectFolderId,
    projectFolderLabel,
    folderOptions,
    refreshProjectList,
    saveProjectWithFeedback,
    loadProjectRecord,
    loadProgress,
    deleteProject,
    restoreAutosave,
    exportProject,
    importProject,
    setProjectFolder,
    ensureDefaultFolder,
    startNewProject,
  } = useMmdProjectController({
    apiRef,
    audioFileRef,
    hdrFileRef,
    handleAudio,
    clearAudio,
    seek,
    setTextureInfo,
    setSkyHdr,
    editorActive: view === "editor",
  });

  const { recording, exportingOffline, exportBusy, toggleRecord, captureStill, exportPngSequence } = useMmdRecordingController({
    apiRef,
    audioRef,
    seek,
  });

  useEffect(() => () => {
    if (audioObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      } catch {
        // ignore
      }
    }
  }, []);

  async function ingestFiles(files: File[]) {
    if (!files.length) return;
    const models = listModelFiles(files);
    const { body, face, camera } = pickBodyAndFaceMotions(files);
    const audio = pickPrimaryAudio(files) ?? files.find(isAudioFile) ?? null;
    // Never auto-promote model pack PNG/JPG to sky (was setting character tex as equirect env).
    const sky = pickSkyPanoramaFile(files, { hasModels: models.length > 0 });

    if (models.length === 1) {
      await loadModelBundle(models[0]!, companionsForModel(models[0]!, files));
    } else if (models.length > 1) {
      // Multi-PMX pack: let the user choose which models enter the scene.
      openModelPicker(models, files);
    }

    if (body) await handleBodyMotion(body);
    if (face) await handleFaceMotion(face);
    if (camera) await handleCameraMotion(camera);
    if (audio) await handleAudio(audio);
    if (sky) {
      hdrFileRef.current = sky;
      setSkyHdr(sky);
    }

    if (!models.length && !body && !face && !camera && !audio && !sky) {
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
    useMmdStudioStore.getState().setPhysicsEnabled(enabled);
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
      useMmdStudioStore.getState().setPhysicsEnabled(false);
      addNotification({
        title: t("mmdPhysics"),
        message: error instanceof Error ? error.message : t("mmdPhysicsFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
    }
  }

  function onPhysicsReset() {
    if (!useMmdStudioStore.getState().physicsEnabled) return;
    apiRef.current?.resetPhysics(useMmdStudioStore.getState().currentTime);
    addNotification({
      title: t("mmdPhysics"),
      message: t("mmdPhysicsResetDone"),
      type: "success",
      category: "media",
      appId: "mmd-studio",
      duration: 2500,
    });
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
      audio.playbackRate = useMmdStudioStore.getState().speed;
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (view !== "editor") return;
    const files = await collectFilesFromDataTransfer(event.dataTransfer);
    await ingestFiles(files);
  }

  async function openEditorThen(load: () => Promise<void>) {
    setView("editor");
    // Wait two frames so MmdCanvas mounts and registers scene API before hydrate.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    try {
      await load();
    } catch {
      // Errors are reported inside loadProjectRecord; stay in editor for retry/back.
    }
  }

  function handleNewProject() {
    startNewProject();
    setView("editor");
  }

  function handleOpenProject(record: MmdProjectRecord) {
    void openEditorThen(() => loadProjectRecord(record));
  }

  function handleRestoreAutosave() {
    void openEditorThen(() => restoreAutosave());
  }

  async function handleImportFile(file: File) {
    const record = await importProject(file);
    if (record) void openEditorThen(() => loadProjectRecord(record));
  }

  const statusTone = status === "error" ? "is-error" : status === "loading" ? "is-busy" : status === "ready" ? "is-ready" : "";
  const statusText = status === "loading"
    ? t("mmdLoading")
    : status === "error"
      ? `${t("mmdError")}: ${statusMessage}`
      : status === "ready"
        ? t("mmdReady")
        : t("mmdIdle");

  if (view === "home") {
    return (
      <div className="mmd-studio-app mmd-studio-app-home">
        <MmdProjectHome
          projectList={projectList}
          projectBusy={projectBusy}
          loadProgress={loadProgress}
          lastProjectId={lastProjectId}
          hasAutosave={hasAutosave}
          projectFolderLabel={projectFolderLabel}
          projectFolderId={projectFolderId}
          folderOptions={folderOptions}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onDelete={(id) => void deleteProject(id)}
          onExport={(id) => void exportProject(id)}
          onImportFile={(file) => void handleImportFile(file)}
          onRestoreAutosave={handleRestoreAutosave}
          onChooseFolder={(id) => void setProjectFolder(id)}
          onEnsureDefaultFolder={() => void ensureDefaultFolder()}
          onRefresh={() => void refreshProjectList()}
        />
        <audio ref={audioRef} preload="auto" />
      </div>
    );
  }

  // Keep load overlay available if user is already in editor (re-open / autosave).
  const editorLoadOverlay = loadProgress ? (
    <div className="mmd-modal-backdrop mmd-modal-backdrop-busy" role="status" aria-live="polite">
      <div className="mmd-modal mmd-modal-compact">
        <strong>{t("mmdProjectOpenLoading").replace("{name}", loadProgress.projectName)}</strong>
        <p className="mmd-note">
          {loadProgress.phase === "prepare"
            ? t("mmdProjectLoadStagePrepare")
            : loadProgress.phase === "assets"
              ? t("mmdProjectLoadStageAssets")
                  .replace("{current}", String(loadProgress.current))
                  .replace("{total}", String(Math.max(1, loadProgress.total)))
              : loadProgress.phase === "hydrate"
                ? t("mmdProjectLoadStageHydrate")
                : loadProgress.phase === "media"
                  ? t("mmdProjectLoadStageMedia")
                  : t("mmdProjectLoadStageDone")}
        </p>
        <div className="mmd-import-progress-track">
          <div
            className="mmd-import-progress-fill"
            style={{
              width: `${Math.round(
                (loadProgress.phase === "prepare"
                  ? 0.08
                  : loadProgress.phase === "assets"
                    ? 0.1 + 0.55 * (loadProgress.current / Math.max(1, loadProgress.total))
                    : loadProgress.phase === "hydrate"
                      ? 0.78
                      : loadProgress.phase === "media"
                        ? 0.9
                        : 0.98) * 100,
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={dragOver ? `mmd-studio-app is-dragover${isImmersive ? " is-immersive" : ""}` : `mmd-studio-app${isImmersive ? " is-immersive" : ""}`}
      style={{
        ["--mmd-side-width" as string]: `${layoutPrefs.sideWidth}px`,
        ["--mmd-transport-height" as string]: `${layoutPrefs.transportHeight}px`,
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => void onDrop(event)}
    >
      <header className="mmd-toolbar">
        <div className="mmd-toolbar-group">
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              if (isImmersive) exitImmersive();
              setView("home");
            }}
          >
            <Icon icon="solar:folder-with-files-bold-duotone" width={16} height={16} />
            {t("mmdProjectBack")}
          </button>
          <button type="button" className="button-primary" onClick={() => folderInputRef.current?.click()}>
            <Icon icon="solar:folder-with-files-bold-duotone" width={16} height={16} />
            {t("mmdLoadFolder")}
          </button>
          <div className="mmd-seg">
            <button type="button" className="button-ghost" onClick={() => modelInputRef.current?.click()}>{t("mmdLoadModel")}</button>
            <button type="button" className="button-ghost" onClick={() => bodyMotionInputRef.current?.click()}>{t("mmdLoadBodyMotion")}</button>
            <button type="button" className="button-ghost" onClick={() => faceMotionInputRef.current?.click()}>{t("mmdLoadFaceMotion")}</button>
            <button type="button" className="button-ghost" onClick={() => cameraMotionInputRef.current?.click()}>{t("mmdLoadCameraMotion")}</button>
            <button type="button" className="button-ghost" onClick={() => audioInputRef.current?.click()}>{t("mmdLoadAudio")}</button>
          </div>
        </div>
        <div className="mmd-toolbar-group mmd-toolbar-meta">
          <label className="mmd-inline-field">
            <span>{t("mmdBackend")}</span>
            <MmdSelect
              value={backend}
              disabled={backendSwitching || exportBusy}
              ariaLabel={t("mmdBackend")}
              onChange={(next) => void handleBackendChange(next as MmdRendererBackend)}
              options={[
                { value: "webgl", label: t("mmdBackendWebgl") },
                { value: "webgpu", label: t("mmdBackendWebgpu"), disabled: !webgpuAvailable },
              ]}
            />
          </label>
          {windowId ? (
            <button
              type="button"
              className="button-ghost mmd-fullscreen-btn"
              title={isImmersive ? t("mmdExitFullscreen") : t("mmdFullscreen")}
              aria-label={isImmersive ? t("mmdExitFullscreen") : t("mmdFullscreen")}
              onClick={() => toggleImmersive(windowId)}
            >
              <Icon
                icon={isImmersive ? "solar:quit-full-screen-bold-duotone" : "solar:full-screen-bold-duotone"}
                width={16}
                height={16}
              />
              {isImmersive ? t("mmdExitFullscreen") : t("mmdFullscreen")}
            </button>
          ) : null}
          <span className={`mmd-status-chip ${statusTone}`}>{statusText}</span>
          {exportBusy ? <span className="mmd-status-chip is-rec">{exportingOffline ? t("mmdExportOffline") : t("mmdExporting")}</span> : null}
        </div>
      </header>

      <p className="mmd-tip" title={`${t("mmdFolderHint")} ${t("mmdDisclaimer")}`}>
        {backend === "webgpu" ? `${t("mmdWebgpuExperimental")} · ` : null}
        {t("mmdFolderHint")} · {t("mmdDisclaimer")}
      </p>

      <div
        ref={mainRef}
        className={`mmd-main${layoutPrefs.sideCollapsed ? " is-side-collapsed" : ""}`}
      >
        <div className="mmd-viewport">
          {canvasMounted ? (
            <MmdCanvas
              backend={backend}
              audioRef={audioRef}
              apiRef={apiRef}
              preserveModelsOnUnmount={backendSwitching}
            />
          ) : (
            <div className="mmd-canvas-fallback">{t("mmdLoading")}</div>
          )}
          {backendSwitching ? (
            <div className="mmd-empty">
              <Icon icon="solar:refresh-circle-bold-duotone" width={28} height={28} />
              <strong>{t("mmdLoading")}</strong>
            </div>
          ) : !models.length ? (
            <div className="mmd-empty">
              <Icon icon="solar:box-minimalistic-bold-duotone" width={28} height={28} />
              <strong>{t("mmdDropHint")}</strong>
              <span>{t("mmdFolderHint")}</span>
            </div>
          ) : null}
          {exportBusy ? <div className="mmd-rec-badge">{exportingOffline ? t("mmdExportOffline") : t("mmdExporting")}</div> : null}
          {layoutPrefs.sideCollapsed ? (
            <button
              type="button"
              className="mmd-side-expand-fab"
              title={t("mmdExpandSidePanel")}
              aria-label={t("mmdExpandSidePanel")}
              onClick={() => setSideCollapsed(false)}
            >
              <Icon icon="solar:sidebar-minimalistic-bold-duotone" width={16} height={16} />
            </button>
          ) : null}
        </div>

        {/* Keep mounted while collapsed so side-tab / scroll state survives. */}
        <div
          className="mmd-split-handle mmd-split-handle-side"
          role="separator"
          tabIndex={layoutPrefs.sideCollapsed ? -1 : 0}
          aria-orientation="vertical"
          aria-hidden={layoutPrefs.sideCollapsed || undefined}
          aria-label={t("mmdResizeSidePanel")}
          aria-valuemin={MMD_SIDE_WIDTH_MIN}
          aria-valuemax={MMD_SIDE_WIDTH_MAX}
          aria-valuenow={layoutPrefs.sideWidth}
          title={t("mmdResizeSidePanel")}
          onPointerDown={layoutPrefs.sideCollapsed ? undefined : beginSideResize}
          onKeyDown={layoutPrefs.sideCollapsed ? undefined : onSideKeyDown}
          onDoubleClick={resetSideWidth}
        />
        <div className="mmd-side-shell" aria-hidden={layoutPrefs.sideCollapsed || undefined}>
          <div className="mmd-side-shell-bar">
            <button
              type="button"
              className="button-ghost mmd-side-collapse-btn"
              title={t("mmdCollapseSidePanel")}
              aria-label={t("mmdCollapseSidePanel")}
              onClick={() => setSideCollapsed(true)}
            >
              <Icon icon="solar:sidebar-minimalistic-bold-duotone" width={15} height={15} />
              {t("mmdCollapseSidePanel")}
            </button>
          </div>
          <MmdSidePanel
            apiRef={apiRef}
            audioRef={audioRef}
            modelInputRef={modelInputRef}
            folderInputRef={folderInputRef}
            bodyMotionInputRef={bodyMotionInputRef}
            faceMotionInputRef={faceMotionInputRef}
            cameraMotionInputRef={cameraMotionInputRef}
            audioInputRef={audioInputRef}
            hdrInputRef={hdrInputRef}
            textureInfo={textureInfo}
            recording={exportBusy}
            onCaptureStill={captureStill}
            onExportSequence={exportPngSequence}
            projectList={projectList}
            projectBusy={projectBusy}
            projectName={projectName}
            setProjectName={setProjectName}
            lastProjectId={lastProjectId}
            refreshProjectList={refreshProjectList}
            saveProjectWithFeedback={saveProjectWithFeedback}
            loadProjectRecord={loadProjectRecord}
            deleteProject={deleteProject}
            restoreAutosave={restoreAutosave}
            exportProject={exportProject}
            importProject={importProject}
            onBackToProjects={() => setView("home")}
            onPhysicsToggle={onPhysicsToggle}
            onPhysicsReset={onPhysicsReset}
          />
        </div>
      </div>

      <div
        className="mmd-split-handle mmd-split-handle-transport"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("mmdResizeTransport")}
        aria-valuemin={MMD_TRANSPORT_HEIGHT_MIN}
        aria-valuemax={MMD_TRANSPORT_HEIGHT_MAX}
        aria-valuenow={layoutPrefs.transportHeight}
        title={t("mmdResizeTransport")}
        onPointerDown={beginTransportResize}
        onKeyDown={onTransportKeyDown}
        onDoubleClick={resetTransportHeight}
      />

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
        <MmdTimelineBar
          currentTime={currentTime}
          duration={duration}
          exportIn={exportIn}
          exportOut={exportOut}
          exportFps={exportFps}
          playing={playing}
          onSeek={seek}
          onSetExportIn={setExportIn}
          onSetExportOut={setExportOut}
          onClearRange={() => {
            setExportIn(0);
            setExportOut(0);
          }}
        />
        <button type="button" className={exportBusy ? "button-primary" : "button-ghost"} onClick={() => void toggleRecord()}>
          <Icon icon={exportBusy ? "solar:stop-bold" : "solar:videocamera-record-bold"} width={14} height={14} />
          {exportBusy ? t("mmdStopExport") : t("mmdExport")}
        </button>
      </footer>

      {editorLoadOverlay}

      {importProgress ? (
        <div className="mmd-modal-backdrop mmd-modal-backdrop-busy" role="status" aria-live="polite">
          <div className="mmd-modal mmd-modal-compact">
            <p className="mmd-modal-hint">
              {t("mmdPickModelsImporting")
                .replace("{current}", String(importProgress.current))
                .replace("{total}", String(importProgress.total))}
            </p>
            <div className="mmd-import-progress-track">
              <div
                className="mmd-import-progress-fill"
                style={{ width: `${Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {modelPick && !importProgress ? (
        <div className="mmd-modal-backdrop" role="presentation" onClick={() => setModelPick(null)}>
          <div
            className="mmd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mmd-pick-models-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="mmd-pick-models-title">{t("mmdPickModelsTitle")}</h3>
            <p className="mmd-modal-hint">{t("mmdPickModelsHint")}</p>
            <label className="mmd-modal-search">
              <Icon icon="solar:magnifer-bold-duotone" width={15} height={15} />
              <input
                value={modelPick.query}
                placeholder={t("mmdPickModelsSearch")}
                spellCheck={false}
                onChange={(event) => {
                  const query = event.target.value;
                  setModelPick((current) => (current ? { ...current, query } : current));
                }}
              />
            </label>
            <div className="mmd-modal-list">
              {(() => {
                const needle = modelPick.query.trim().toLowerCase();
                const filtered = needle
                  ? modelPick.models.filter((file) => {
                      const path = modelRelativePath(file).toLowerCase();
                      return path.includes(needle) || file.name.toLowerCase().includes(needle);
                    })
                  : modelPick.models;
                if (!filtered.length) {
                  return <p className="mmd-note mmd-modal-empty">{t("mmdPickModelsEmpty")}</p>;
                }
                return filtered.map((file) => {
                  const key = modelRelativePath(file);
                  const dir = relativeDirOf(file);
                  return (
                    <label key={key} className="mmd-modal-row">
                      <input
                        type="checkbox"
                        checked={Boolean(modelPick.selected[key])}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setModelPick((current) => {
                            if (!current) return current;
                            return {
                              ...current,
                              selected: { ...current.selected, [key]: checked },
                            };
                          });
                        }}
                      />
                      <span className="mmd-modal-row-main">
                        <strong>{file.name}</strong>
                        {dir ? <small>{dir}</small> : null}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>
            <div className="mmd-modal-meta">
              {t("mmdPickModelsCount")
                .replace("{n}", String(Object.values(modelPick.selected).filter(Boolean).length))
                .replace("{total}", String(modelPick.models.length))}
            </div>
            <div className="mmd-modal-actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setModelPick((current) => {
                    if (!current) return current;
                    const selected: Record<string, boolean> = {};
                    for (const model of current.models) selected[modelRelativePath(model)] = true;
                    return { ...current, selected };
                  });
                }}
              >
                {t("mmdPickModelsAll")}
              </button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setModelPick((current) => {
                    if (!current) return current;
                    const selected: Record<string, boolean> = {};
                    for (const model of current.models) selected[modelRelativePath(model)] = false;
                    return { ...current, selected };
                  });
                }}
              >
                {t("mmdPickModelsNone")}
              </button>
              <span className="mmd-modal-actions-spacer" />
              <button type="button" className="button-ghost" onClick={() => setModelPick(null)}>
                {t("mmdPickModelsCancel")}
              </button>
              <button
                type="button"
                className="button-primary"
                disabled={!Object.values(modelPick.selected).some(Boolean)}
                onClick={() => void confirmModelPicker()}
              >
                {t("mmdPickModelsImport")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        onChange={(event) => {
          if (event.target.files) void ingestFiles(Array.from(event.target.files));
          event.target.value = "";
        }}
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
      <input ref={cameraMotionInputRef} hidden type="file" accept=".vmd" onChange={(event) => event.target.files?.[0] && void handleCameraMotion(event.target.files[0])} />
      <input ref={audioInputRef} hidden type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && void handleAudio(event.target.files[0])} />
      <input
        ref={hdrInputRef}
        hidden
        type="file"
        accept={SKY_FILE_ACCEPT}
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
