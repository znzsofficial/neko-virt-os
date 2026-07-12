import { Icon } from "@iconify-icon/react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import { collectFilesFromDataTransfer, pickBodyAndFaceMotions, pickPrimaryAudio, pickPrimaryModel } from "./folderImport";
import { MmdCanvas, type MmdSceneApi } from "./MmdCanvas";
import { MmdProjectHome } from "./MmdProjectHome";
import { MmdSidePanel } from "./MmdSidePanel";
import { MmdTimelineBar } from "./MmdTimelineBar";
import type { MmdProjectModelAssets } from "./mmdRuntime";
import {
  useMmdStudioStore,
  type MmdRendererBackend,
} from "./mmdStudioStore";
import { isAudioFile } from "./mmdUtils";
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

export function MmdStudioApp() {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
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
    await apiRef.current?.loadMotion(file, "body", useMmdStudioStore.getState().selectedModelId);
  }

  async function handleFaceMotion(file: File) {
    await apiRef.current?.loadMotion(file, "face", useMmdStudioStore.getState().selectedModelId);
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
    setCurrentTime(value);
    if (audioRef.current) audioRef.current.currentTime = value;
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

  const { recording, toggleRecord } = useMmdRecordingController({
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

  function openEditorThen(load: () => Promise<void> | void) {
    setView("editor");
    window.setTimeout(() => {
      void Promise.resolve(load()).catch(() => undefined);
    }, 0);
  }

  function handleNewProject() {
    startNewProject();
    setView("editor");
  }

  function handleOpenProject(record: MmdProjectRecord) {
    openEditorThen(() => loadProjectRecord(record));
  }

  function handleRestoreAutosave() {
    openEditorThen(() => restoreAutosave());
  }

  async function handleImportFile(file: File) {
    const record = await importProject(file);
    if (record) openEditorThen(() => loadProjectRecord(record));
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
          <button type="button" className="button-ghost" onClick={() => setView("home")}>
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
            <button type="button" className="button-ghost" onClick={() => audioInputRef.current?.click()}>{t("mmdLoadAudio")}</button>
          </div>
        </div>
        <div className="mmd-toolbar-group mmd-toolbar-meta">
          <label className="mmd-inline-field">
            <span>{t("mmdBackend")}</span>
            <select
              value={backend}
              disabled={backendSwitching || recording}
              onChange={(event) => void handleBackendChange(event.target.value as MmdRendererBackend)}
            >
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
          {recording ? <div className="mmd-rec-badge">{t("mmdExporting")}</div> : null}
        </div>

        <MmdSidePanel
          apiRef={apiRef}
          audioRef={audioRef}
          modelInputRef={modelInputRef}
          folderInputRef={folderInputRef}
          bodyMotionInputRef={bodyMotionInputRef}
          faceMotionInputRef={faceMotionInputRef}
          audioInputRef={audioInputRef}
          hdrInputRef={hdrInputRef}
          textureInfo={textureInfo}
          recording={recording}
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
        />
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
        <MmdTimelineBar
          currentTime={currentTime}
          duration={duration}
          exportIn={exportIn}
          exportOut={exportOut}
          exportFps={exportFps}
          onSeek={seek}
          onSetExportIn={setExportIn}
          onSetExportOut={setExportOut}
        />
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
