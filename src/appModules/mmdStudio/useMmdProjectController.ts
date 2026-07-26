import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useDownloadStore } from "../../system/downloadStore";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import type { MmdSceneApi } from "./MmdCanvas";
import type { MmdRendererBackend } from "./mmdStudioStore";
import {
  deleteMmdProject,
  getMmdAutosave,
  listMmdProjects,
  loadMmdProjectAsset,
  saveMmdProject,
  type MmdProjectRecord,
  type MmdProjectSettings,
} from "./mmdProjectDb";
import { buildMmdProjectPackage, importMmdProjectPackage, triggerPackageDownload } from "./mmdProjectIO";
import {
  ensureMmdProjectFolder,
  getMmdProjectFolderId,
  listFolderCandidates,
  setMmdProjectFolderId,
  writeProjectCatalogEntry,
} from "./mmdProjectPrefs";
import { hydrateMmdModels, type MmdHydrateModelInput } from "./mmdSceneHydrate";
import {
  sanitizeLights,
  useMmdStudioStore,
} from "./mmdStudioStore";

type UseMmdProjectControllerOptions = {
  apiRef: MutableRefObject<MmdSceneApi | null>;
  audioFileRef: MutableRefObject<File | null>;
  hdrFileRef: MutableRefObject<File | null>;
  handleAudio: (file: File) => Promise<void> | void;
  clearAudio: () => void;
  seek: (time: number) => void;
  setTextureInfo: (value: string) => void;
  setSkyHdr: (file: File | null) => void;
  ensureBackend: (backend: MmdRendererBackend, restoreCurrentScene?: boolean) => Promise<MmdSceneApi>;
  /** When false, autosave timer is paused (e.g. project home). Default true. */
  editorActive?: boolean;
};

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
  store.setCameraRotateSpeed(settings.cameraRotateSpeed ?? 1);
  store.setShowGrid(settings.showGrid);
  store.setSkyAsBackground(settings.skyAsBackground);
  store.setSkyAsEnvironment(settings.skyAsEnvironment);
  store.setEnvIntensity(settings.envIntensity);
  store.setLights(sanitizeLights(settings.lights));
  store.setExportResolution(settings.exportResolution);
  if (settings.exportCustomWidth && settings.exportCustomHeight) {
    store.setExportCustomSize(settings.exportCustomWidth, settings.exportCustomHeight, false);
  }
  store.setExportFps(settings.exportFps);
  store.setExportCodec(settings.exportCodec);
  store.setExportBitrate(settings.exportBitrate);
  if (settings.exportCustomVideoMbps != null) store.setExportCustomVideoMbps(settings.exportCustomVideoMbps);
  if (settings.exportAudioBitrate) store.setExportAudioBitrate(settings.exportAudioBitrate);
  if (settings.exportCustomAudioKbps != null) store.setExportCustomAudioKbps(settings.exportCustomAudioKbps);
  if (settings.exportMode) store.setExportMode(settings.exportMode);
  store.setExportIncludeAudio(settings.exportIncludeAudio);
  store.setExportHideGrid(settings.exportHideGrid);
  if (settings.exportForceOneX != null) store.setExportForceOneX(settings.exportForceOneX);
  store.setExportFilePrefix(settings.exportFilePrefix);
  store.setExportIn(settings.exportIn);
  store.setExportOut(settings.exportOut);
  store.setCurrentTime(settings.currentTime);
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
    cameraRotateSpeed: s.cameraRotateSpeed,
    currentTime: s.currentTime,
    showGrid: s.showGrid,
    skyAsBackground: s.skyAsBackground,
    skyAsEnvironment: s.skyAsEnvironment,
    envIntensity: s.envIntensity,
    lights: { ...s.lights },
    exportResolution: s.exportResolution,
    exportCustomWidth: s.exportCustomWidth,
    exportCustomHeight: s.exportCustomHeight,
    exportFps: s.exportFps,
    exportCodec: s.exportCodec,
    exportBitrate: s.exportBitrate,
    exportCustomVideoMbps: s.exportCustomVideoMbps,
    exportAudioBitrate: s.exportAudioBitrate,
    exportCustomAudioKbps: s.exportCustomAudioKbps,
    exportMode: s.exportMode,
    exportIncludeAudio: s.exportIncludeAudio,
    exportHideGrid: s.exportHideGrid,
    exportForceOneX: s.exportForceOneX,
    exportFilePrefix: s.exportFilePrefix,
    exportIn: s.exportIn,
    exportOut: s.exportOut,
  };
}

export type MmdProjectLoadProgress = {
  phase: "prepare" | "assets" | "hydrate" | "media" | "done";
  current: number;
  total: number;
  projectName: string;
};

export function useMmdProjectController({
  apiRef,
  audioFileRef,
  hdrFileRef,
  handleAudio,
  clearAudio,
  seek,
  setTextureInfo,
  setSkyHdr,
  ensureBackend,
  editorActive = true,
}: UseMmdProjectControllerOptions) {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const projectName = useMmdStudioStore((state) => state.projectName);
  const setProjectName = useMmdStudioStore((state) => state.setProjectName);
  const lastProjectId = useMmdStudioStore((state) => state.lastProjectId);
  const setLastProjectId = useMmdStudioStore((state) => state.setLastProjectId);
  const recording = useMmdStudioStore((state) => state.recording);
  const exportingOffline = useMmdStudioStore((state) => state.exportingOffline);
  const status = useMmdStudioStore((state) => state.status);
  const models = useMmdStudioStore((state) => state.models);
  const lights = useMmdStudioStore((state) => state.lights);
  const postFx = useMmdStudioStore((state) => state.postFx);
  const postFxTune = useMmdStudioStore((state) => state.postFxTune);
  const skyHdrName = useMmdStudioStore((state) => state.skyHdrName);
  const audioName = useMmdStudioStore((state) => state.audioName);
  const currentTime = useMmdStudioStore((state) => state.currentTime);
  const cameraMode = useMmdStudioStore((state) => state.cameraMode);
  const physicsEnabled = useMmdStudioStore((state) => state.physicsEnabled);
  const speed = useMmdStudioStore((state) => state.speed);
  const loop = useMmdStudioStore((state) => state.loop);
  const cameraMoveSpeed = useMmdStudioStore((state) => state.cameraMoveSpeed);
  const cameraRotateSpeed = useMmdStudioStore((state) => state.cameraRotateSpeed);
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const exportResolution = useMmdStudioStore((state) => state.exportResolution);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const exportCodec = useMmdStudioStore((state) => state.exportCodec);
  const exportBitrate = useMmdStudioStore((state) => state.exportBitrate);
  const exportIncludeAudio = useMmdStudioStore((state) => state.exportIncludeAudio);
  const exportHideGrid = useMmdStudioStore((state) => state.exportHideGrid);
  const exportFilePrefix = useMmdStudioStore((state) => state.exportFilePrefix);

  const autosaveTimerRef = useRef<number | null>(null);
  const [projectList, setProjectList] = useState<MmdProjectRecord[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);
  const [projectFolderId, setProjectFolderIdState] = useState<string | null>(() => getMmdProjectFolderId());
  const [projectFolderLabel, setProjectFolderLabel] = useState("");
  const [folderOptions, setFolderOptions] = useState<{ id: string; name: string }[]>([]);

  async function refreshAutosaveFlag() {
    try {
      const autosave = await getMmdAutosave();
      setHasAutosave(Boolean(autosave && autosave.models.length));
    } catch {
      setHasAutosave(false);
    }
  }

  async function refreshFolderState() {
    try {
      const folders = await listFolderCandidates();
      setFolderOptions(folders.map((folder) => ({ id: folder.id, name: folder.name })));
      const id = getMmdProjectFolderId();
      setProjectFolderIdState(id);
      if (!id) {
        setProjectFolderLabel("");
        return;
      }
      const match = folders.find((folder) => folder.id === id);
      setProjectFolderLabel(match?.name ?? "");
    } catch {
      setFolderOptions([]);
      setProjectFolderLabel("");
    }
  }

  async function refreshProjectList() {
    try {
      setProjectList(await listMmdProjects());
    } catch {
      setProjectList([]);
    }
    await refreshAutosaveFlag();
    await refreshFolderState();
  }

  async function setProjectFolder(id: string | null) {
    setMmdProjectFolderId(id);
    setProjectFolderIdState(id);
    await refreshFolderState();
  }

  async function ensureDefaultFolder() {
    try {
      const folder = await ensureMmdProjectFolder();
      setProjectFolderIdState(folder.id);
      await refreshFolderState();
      return folder;
    } catch {
      return null;
    }
  }

  function startNewProject() {
    apiRef.current?.clearScene();
    setProjectName("Untitled Project");
    setLastProjectId(null);
    clearAudio();
    hdrFileRef.current = null;
    setSkyHdr(null);
    setTextureInfo("");
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
        morphFavorites: model.morphFavorites,
        materialVisible: model.materialVisible,
        materialOverrides: model.materialOverrides,
        transform: model.transform,
        modelFile: model.modelFile,
        companionFiles: model.companionFiles,
        bodyMotionFile: model.bodyMotionFile,
        faceMotionFile: model.faceMotionFile,
        cameraMotionFile: model.cameraMotionFile,
      })),
      audioFile: audioFileRef.current,
      audioName: useMmdStudioStore.getState().audioName,
      hdrFile: hdrFileRef.current,
      hdrName: useMmdStudioStore.getState().skyHdrName,
    });
    if (!isAutosave) {
      setLastProjectId(record.id);
      setProjectName(record.name);
      await writeProjectCatalogEntry({
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt,
        modelCount: record.models.length,
      });
      await refreshProjectList();
    } else {
      setHasAutosave(true);
    }
    return record;
  }

  const [loadProgress, setLoadProgress] = useState<MmdProjectLoadProgress | null>(null);

  async function loadProjectRecord(record: MmdProjectRecord) {
    setProjectBusy(true);
    const displayName = record.isAutosave ? t("mmdProjectContinueAutosave") : record.name;
    let transactionStarted = false;
    const previousApi = apiRef.current;
    const previousModels = previousApi?.exportProjectModels() ?? [];
    const previousSelectedId = useMmdStudioStore.getState().selectedModelId;
    const previousSettings = collectProjectSettings();
    const previousAudio = audioFileRef.current;
    const previousHdr = hdrFileRef.current;
    const setPhase = (
      phase: MmdProjectLoadProgress["phase"],
      current = 0,
      total = 0,
    ) => {
      setLoadProgress({ phase, current, total, projectName: displayName });
    };
    try {
      setPhase("prepare");
      useMmdStudioStore.getState().setStatus("loading", displayName);

      const modelCount = Math.max(1, record.models.length);
      const hydrateModels: MmdHydrateModelInput[] = [];
      const loadReferencedAsset = async (assetId: string | null, label: string) => {
        if (!assetId) return null;
        const file = await loadMmdProjectAsset(assetId);
        if (!file) throw new Error(`Missing project asset: ${label}`);
        return file;
      };
      for (let index = 0; index < record.models.length; index += 1) {
        const model = record.models[index]!;
        setPhase("assets", index + 1, modelCount);
        const modelFile = await loadReferencedAsset(model.modelAssetId, model.name);
        if (!modelFile) throw new Error(`Missing model asset: ${model.name}`);
        const companions: File[] = [];
        for (const cid of model.companionAssetIds) {
          const file = await loadMmdProjectAsset(cid);
          if (file) companions.push(file);
        }
        const bodyMotionFile = await loadReferencedAsset(model.bodyMotionAssetId, `${model.name} body motion`);
        const faceMotionFile = await loadReferencedAsset(model.faceMotionAssetId, `${model.name} face motion`);
        const cameraMotionFile = await loadReferencedAsset(model.cameraMotionAssetId, `${model.name} camera motion`);
        hydrateModels.push({
          id: model.id,
          name: model.name,
          visible: model.visible,
          morphWeights: model.morphWeights,
          morphFavorites: model.morphFavorites ?? [],
          materialVisible: model.materialVisible,
          materialOverrides: model.materialOverrides ?? {},
          transform: model.transform ?? null,
          offsetX: model.offsetX,
          modelFile,
          companionFiles: companions.length ? companions : [modelFile],
          bodyMotionFile,
          faceMotionFile,
          cameraMotionFile,
        });
      }

      const audio = await loadReferencedAsset(record.audioAssetId, "audio");
      const hdr = await loadReferencedAsset(record.hdrAssetId, "HDR");
      transactionStarted = true;
      const api = await ensureBackend(record.settings.backend, false);

      setPhase("hydrate", hydrateModels.length, hydrateModels.length || 1);
      await hydrateMmdModels(api, hydrateModels, {
        physics: record.settings.physicsEnabled,
        clearFirst: true,
      });

      applyProjectSettings(record.settings, { applyBackend: false });

      setPhase("media");
      if (audio) {
        await handleAudio(audio);
      } else {
        clearAudio();
      }

      if (hdr) {
        hdrFileRef.current = hdr;
        setSkyHdr(hdr);
      } else {
        hdrFileRef.current = null;
        setSkyHdr(null);
      }

      setProjectName(record.isAutosave ? useMmdStudioStore.getState().projectName : record.name);
      if (!record.isAutosave) setLastProjectId(record.id);

      setPhase("done");
      seek(record.settings.currentTime);
      setTextureInfo(t("mmdProjectLoaded"));
      useMmdStudioStore.getState().setStatus("ready");
      addNotification({
        title: t("mmdProject"),
        message: record.isAutosave ? t("mmdProjectRestored") : t("mmdProjectLoaded"),
        type: "success",
        category: "media",
        appId: "mmd-studio",
        duration: 3500,
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          const rollbackApi = await ensureBackend(previousSettings.backend, false);
          await rollbackApi.restoreScene(previousModels, {
            physics: previousSettings.physicsEnabled,
            selectedId: previousSelectedId,
          });
          applyProjectSettings(previousSettings, { applyBackend: false });
          if (previousAudio) await handleAudio(previousAudio);
          else clearAudio();
          hdrFileRef.current = previousHdr;
          setSkyHdr(previousHdr);
          seek(previousSettings.currentTime);
        } catch {
          // Keep the original load error; renderer status exposes rollback failures.
        }
      }
      useMmdStudioStore.getState().setStatus(
        "error",
        error instanceof Error ? error.message : t("mmdProjectLoadFailed"),
      );
      addNotification({
        title: t("mmdProject"),
        message: error instanceof Error ? error.message : t("mmdProjectLoadFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
      throw error;
    } finally {
      setLoadProgress(null);
      setProjectBusy(false);
    }
  }

  async function deleteProject(id: string) {
    await deleteMmdProject(id);
    if (lastProjectId === id) setLastProjectId(null);
    await refreshProjectList();
  }

  async function restoreAutosave() {
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
  }

  async function saveProjectWithFeedback(options?: { name?: string; clearLastId?: boolean }) {
    setProjectBusy(true);
    try {
      if (options?.clearLastId) setLastProjectId(null);
      await saveCurrentProject({ name: options?.name });
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
  }

  async function exportProject(id: string) {
    setProjectBusy(true);
    try {
      const { blob, fileName } = await buildMmdProjectPackage(id);
      const url = triggerPackageDownload(blob, fileName);
      useDownloadStore.getState().addDownload({
        name: fileName,
        source: t("appMmdStudio"),
        size: blob.size,
        mimeType: "application/json",
        url,
      });
      addNotification({
        title: t("mmdProject"),
        message: t("mmdProjectExported"),
        type: "success",
        category: "media",
        appId: "mmd-studio",
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        title: t("mmdProject"),
        message: error instanceof Error ? error.message : t("mmdProjectExportFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
    } finally {
      setProjectBusy(false);
    }
  }

  async function importProject(file: File) {
    setProjectBusy(true);
    try {
      const record = await importMmdProjectPackage(file);
      await refreshProjectList();
      addNotification({
        title: t("mmdProject"),
        message: t("mmdProjectImported"),
        type: "success",
        category: "media",
        appId: "mmd-studio",
        duration: 3000,
      });
      return record;
    } catch (error) {
      addNotification({
        title: t("mmdProject"),
        message: error instanceof Error ? error.message : t("mmdProjectImportFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
      return null;
    } finally {
      setProjectBusy(false);
    }
  }

  useEffect(() => {
    void refreshProjectList();
  }, []);

  useEffect(() => {
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    if (!editorActive || recording || exportingOffline || projectBusy || status === "loading") return;
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveCurrentProject({ autosave: true }).catch(() => undefined);
    }, 8000);
    return () => {
      if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [
    editorActive,
    models,
    lights,
    postFx,
    postFxTune,
    skyHdrName,
    audioName,
    projectName,
    recording,
    exportingOffline,
    projectBusy,
    status,
    currentTime,
    cameraMode,
    physicsEnabled,
    speed,
    loop,
    cameraMoveSpeed,
    cameraRotateSpeed,
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

  return {
    projectList,
    projectBusy,
    loadProgress,
    projectName,
    setProjectName,
    lastProjectId,
    hasAutosave,
    projectFolderId,
    projectFolderLabel,
    folderOptions,
    refreshProjectList,
    saveCurrentProject,
    saveProjectWithFeedback,
    loadProjectRecord,
    deleteProject,
    restoreAutosave,
    exportProject,
    importProject,
    setProjectFolder,
    ensureDefaultFolder,
    startNewProject,
  };
}
