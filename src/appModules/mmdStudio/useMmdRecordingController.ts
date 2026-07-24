import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { useDownloadStore } from "../../system/downloadStore";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import type { MmdSceneApi } from "./MmdCanvas";
import {
  buildExportFileName,
  getExportAudioBits,
  getExportSize,
  getExportVideoBits,
  resolveExportMimeType,
  useMmdStudioStore,
} from "./mmdStudioStore";
import { exportWithWebCodecs, isWebCodecsExportSupported } from "./mmdWebCodecsExport";
import { buildZipStore } from "./mmdZipStore";

type UseMmdRecordingControllerOptions = {
  apiRef: MutableRefObject<MmdSceneApi | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  seek: (time: number) => void;
};

/** Soft cap for in-memory PNG ZIP (browser RAM). Above this we warn but still export. */
const PNG_SEQUENCE_SOFT_CAP = 900;
/** Hard cap to avoid OOM on multi-minute 60fps dumps. */
const PNG_SEQUENCE_HARD_CAP = 3600;

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 60_000);
  return url;
}

export function useMmdRecordingController({
  apiRef,
  audioRef,
  seek,
}: UseMmdRecordingControllerOptions) {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addDownload = useDownloadStore((state) => state.addDownload);
  const recording = useMmdStudioStore((state) => state.recording);
  const exportingOffline = useMmdStudioStore((state) => state.exportingOffline);
  const setRecording = useMmdStudioStore((state) => state.setRecording);
  const setExportingOffline = useMmdStudioStore((state) => state.setExportingOffline);
  const setPlaying = useMmdStudioStore((state) => state.setPlaying);
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const setShowGrid = useMmdStudioStore((state) => state.setShowGrid);
  const setSpeed = useMmdStudioStore((state) => state.setSpeed);
  const backend = useMmdStudioStore((state) => state.backend);
  const models = useMmdStudioStore((state) => state.models);
  const duration = useMmdStudioStore((state) => state.duration);
  const speed = useMmdStudioStore((state) => state.speed);
  const exportResolution = useMmdStudioStore((state) => state.exportResolution);
  const exportCustomWidth = useMmdStudioStore((state) => state.exportCustomWidth);
  const exportCustomHeight = useMmdStudioStore((state) => state.exportCustomHeight);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const exportCodec = useMmdStudioStore((state) => state.exportCodec);
  const exportBitrate = useMmdStudioStore((state) => state.exportBitrate);
  const exportCustomVideoMbps = useMmdStudioStore((state) => state.exportCustomVideoMbps);
  const exportAudioBitrate = useMmdStudioStore((state) => state.exportAudioBitrate);
  const exportCustomAudioKbps = useMmdStudioStore((state) => state.exportCustomAudioKbps);
  const exportMode = useMmdStudioStore((state) => state.exportMode);
  const exportIncludeAudio = useMmdStudioStore((state) => state.exportIncludeAudio);
  const exportHideGrid = useMmdStudioStore((state) => state.exportHideGrid);
  const exportForceOneX = useMmdStudioStore((state) => state.exportForceOneX);
  const exportFilePrefix = useMmdStudioStore((state) => state.exportFilePrefix);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const exportRangeSeconds = useMmdStudioStore((state) => state.exportRangeSeconds);
  const setExportProgress = useMmdStudioStore((state) => state.setExportProgress);

  const exportObjectUrlRef = useRef<string | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const gridRestoreRef = useRef<boolean | null>(null);
  const speedRestoreRef = useRef<number | null>(null);
  const sequenceBusyRef = useRef(false);
  const offlineCancelRef = useRef(false);
  const mountedRef = useRef(true);

  function clearRecordTimer() {
    if (recordTimerRef.current != null) {
      window.clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  function restoreExportSideEffects() {
    if (gridRestoreRef.current != null) {
      setShowGrid(gridRestoreRef.current);
      gridRestoreRef.current = null;
    }
    if (speedRestoreRef.current != null) {
      setSpeed(speedRestoreRef.current);
      if (audioRef.current) audioRef.current.playbackRate = speedRestoreRef.current;
      speedRestoreRef.current = null;
    }
    apiRef.current?.restoreRecordingCanvasSize();
  }

  function rememberExportObjectUrl(url: string) {
    if (exportObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(exportObjectUrlRef.current);
      } catch {
        // ignore
      }
    }
    exportObjectUrlRef.current = url;
  }

  async function finishRecord() {
    clearRecordTimer();
    const blob = await apiRef.current?.stopRecording();
    setRecording(false);
    setPlaying(false);
    audioRef.current?.pause();
    restoreExportSideEffects();
    if (!blob || !mountedRef.current) return;
    const name = buildExportFileName(exportFilePrefix, exportResolution, exportFps, blob.type);
    const url = triggerDownload(blob, name);
    rememberExportObjectUrl(url);
    addDownload({ name, source: t("appMmdStudio"), size: blob.size, mimeType: blob.type, url });
    addNotification({ title: t("mmdExport"), message: name, type: "success", category: "media", appId: "mmd-studio" });
  }

  function prepareCanvasSize() {
    const size = getExportSize(exportResolution, exportCustomWidth, exportCustomHeight);
    apiRef.current?.setRecordingCanvasSize(size.width, size.height);
    return size;
  }

  /** Wait for R3F + post-FX to present at the new drawing-buffer size. */
  function waitPresentedFrames(count = 2) {
    return new Promise<void>((resolve) => {
      let left = Math.max(1, count);
      const tick = () => {
        left -= 1;
        if (left <= 0) resolve();
        else window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
  }

  function applyHideGrid() {
    if (exportHideGrid && showGrid) {
      gridRestoreRef.current = true;
      setShowGrid(false);
    } else {
      gridRestoreRef.current = null;
    }
  }

  function applyForceOneX() {
    if (exportForceOneX && speed !== 1) {
      speedRestoreRef.current = speed;
      setSpeed(1);
      if (audioRef.current) audioRef.current.playbackRate = 1;
    } else {
      speedRestoreRef.current = null;
      if (audioRef.current) audioRef.current.playbackRate = exportForceOneX ? 1 : speed;
    }
  }

  function resolveExportRange() {
    const start = exportIn > 0 ? exportIn : 0;
    const end = exportOut > 0 ? Math.min(exportOut, duration || exportOut) : (duration || 1);
    const safeStart = Math.min(start, end || start);
    const safeEnd = Math.max(safeStart + 1 / exportFps, end || safeStart + 1 / exportFps);
    return { safeStart, safeEnd };
  }

  async function exportOfflineWebCodecs() {
    if (sequenceBusyRef.current || recording || exportingOffline) return;
    if (backend !== "webgl") {
      addNotification({
        title: t("mmdExportNeedWebgl"),
        message: t("mmdWebgpuExperimental"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    if (!models.length) {
      addNotification({
        title: t("mmdNoModel"),
        message: t("mmdFolderHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    if (!isWebCodecsExportSupported()) {
      addNotification({
        title: t("mmdExport"),
        message: t("mmdExportWebCodecsUnsupported"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }

    const canvas = apiRef.current?.getCanvas() ?? null;
    if (!canvas) return;

    offlineCancelRef.current = false;
    sequenceBusyRef.current = true;
    setPlaying(false);
    audioRef.current?.pause();
    applyHideGrid();
    // Mark offline first so post-FX can drop MSAA/HalfFloat before the big buffer alloc.
    setExportingOffline(true);
    setExportProgress(0);
    await waitPresentedFrames(1);
    prepareCanvasSize();
    // Let camera aspect + EffectComposer settle at export resolution.
    await waitPresentedFrames(3);

    const { safeStart, safeEnd } = resolveExportRange();

    try {
      const result = await exportWithWebCodecs({
        canvas,
        fps: exportFps,
        startTime: safeStart,
        endTime: safeEnd,
        videoBitrate: getExportVideoBits(
          exportResolution,
          exportBitrate,
          exportCustomWidth,
          exportCustomHeight,
          exportCustomVideoMbps,
        ),
        audioBitrate: getExportAudioBits(exportAudioBitrate, exportCustomAudioKbps),
        preferCodec: exportCodec,
        includeAudio: exportIncludeAudio,
        audioUrl: audioRef.current?.src || null,
        seek,
        waitFrame: () => waitPresentedFrames(2),
        onProgress: (ratio) => {
          if (mountedRef.current) setExportProgress(ratio);
        },
        isCancelled: () => offlineCancelRef.current || !mountedRef.current,
      });
      if (!mountedRef.current) return;
      const name = buildExportFileName(
        exportFilePrefix,
        exportResolution,
        exportFps,
        result.mimeType,
      );
      const url = triggerDownload(result.blob, name);
      rememberExportObjectUrl(url);
      addDownload({
        name,
        source: t("appMmdStudio"),
        size: result.blob.size,
        mimeType: result.mimeType,
        url,
      });
      addNotification({
        title: t("mmdExportOffline"),
        message: `${name} · ${result.videoCodec} · ${result.frameCount}f`,
        type: "success",
        category: "media",
        appId: "mmd-studio",
      });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof Error && error.message === "cancelled") {
        addNotification({
          title: t("mmdExport"),
          message: t("mmdExportCancelled"),
          type: "info",
          category: "media",
          appId: "mmd-studio",
        });
      } else {
        addNotification({
          title: t("mmdExport"),
          message: error instanceof Error ? error.message : t("mmdExportStillFailed"),
          type: "error",
          category: "media",
          appId: "mmd-studio",
        });
      }
    } finally {
      if (mountedRef.current) {
        setExportingOffline(false);
        setExportProgress(null);
        restoreExportSideEffects();
      } else {
        // Still restore GPU buffer if canvas survived longer than the hook.
        try {
          apiRef.current?.restoreRecordingCanvasSize();
        } catch {
          // ignore
        }
      }
      sequenceBusyRef.current = false;
      offlineCancelRef.current = false;
    }
  }

  async function toggleRecord() {
    if (exportingOffline || sequenceBusyRef.current) {
      offlineCancelRef.current = true;
      return;
    }
    if (recording) {
      await finishRecord();
      return;
    }

    const preferOffline = exportMode === "offline" && isWebCodecsExportSupported();
    if (preferOffline) {
      await exportOfflineWebCodecs();
      return;
    }

    if (backend !== "webgl") {
      addNotification({
        title: t("mmdExportNeedWebgl"),
        message: t("mmdWebgpuExperimental"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    if (!models.length) {
      addNotification({
        title: t("mmdNoModel"),
        message: t("mmdFolderHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }

    applyHideGrid();
    applyForceOneX();
    // Realtime also uses export buffer size — drop heavy post-FX MSAA first via recording flag.
    setRecording(true);
    await waitPresentedFrames(1);
    prepareCanvasSize();
    await waitPresentedFrames(2);

    const start = exportIn > 0 ? exportIn : 0;
    const end = exportOut > 0 ? Math.min(exportOut, duration || exportOut) : duration;
    const safeStart = Math.min(start, end || start);
    seek(safeStart);
    setPlaying(true);
    if (audioRef.current?.src) {
      audioRef.current.currentTime = safeStart;
      audioRef.current.playbackRate = exportForceOneX ? 1 : speed;
      if (exportIncludeAudio) void audioRef.current.play().catch(() => undefined);
      else audioRef.current.pause();
    }
    const recorder = apiRef.current?.startRecording({
      fps: exportFps,
      audio: audioRef.current,
      includeAudio: exportIncludeAudio,
      videoBitsPerSecond: getExportVideoBits(
        exportResolution,
        exportBitrate,
        exportCustomWidth,
        exportCustomHeight,
        exportCustomVideoMbps,
      ),
      audioBitsPerSecond: getExportAudioBits(exportAudioBitrate, exportCustomAudioKbps),
      mimeType: resolveExportMimeType(exportCodec),
    });
    if (!recorder) {
      setRecording(false);
      restoreExportSideEffects();
      return;
    }

    const rangeMs = Math.ceil(exportRangeSeconds() * 1000) + 400;
    clearRecordTimer();
    recordTimerRef.current = window.setTimeout(() => {
      if (useMmdStudioStore.getState().recording) void finishRecord();
    }, rangeMs);
  }

  async function captureStill() {
    if (recording || sequenceBusyRef.current || exportingOffline) return;
    if (!models.length) {
      addNotification({
        title: t("mmdNoModel"),
        message: t("mmdFolderHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    applyHideGrid();
    // Reuse offline flag so post-FX uses export-safe buffers during still capture.
    setExportingOffline(true);
    let blob: Blob | null = null;
    try {
      await waitPresentedFrames(1);
      prepareCanvasSize();
      await waitPresentedFrames(3);
      blob = (await apiRef.current?.captureStillPng()) ?? null;
    } finally {
      setExportingOffline(false);
      restoreExportSideEffects();
    }
    if (!blob) {
      addNotification({
        title: t("mmdExport"),
        message: t("mmdExportStillFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    const safe = (exportFilePrefix.trim() || "mmd-export").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
    const name = `${safe}-still-${Date.now()}.png`;
    const url = triggerDownload(blob, name);
    rememberExportObjectUrl(url);
    addDownload({ name, source: t("appMmdStudio"), size: blob.size, mimeType: "image/png", url });
    addNotification({ title: t("mmdExportStill"), message: name, type: "success", category: "media", appId: "mmd-studio" });
  }

  async function exportPngSequence() {
    if (recording || sequenceBusyRef.current || exportingOffline) return;
    if (!models.length) {
      addNotification({
        title: t("mmdNoModel"),
        message: t("mmdFolderHint"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }
    if (duration <= 0) {
      addNotification({
        title: t("mmdExportSequence"),
        message: t("mmdExportSequenceNeedMotion"),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }

    const { safeStart, safeEnd } = resolveExportRange();
    const step = 1 / exportFps;
    let frameCount = Math.floor((safeEnd - safeStart) / step) + 1;
    if (frameCount > PNG_SEQUENCE_HARD_CAP) {
      addNotification({
        title: t("mmdExportSequence"),
        message: t("mmdExportSequenceCapped").replace("{n}", String(PNG_SEQUENCE_HARD_CAP)),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
      frameCount = PNG_SEQUENCE_HARD_CAP;
    } else if (frameCount > PNG_SEQUENCE_SOFT_CAP) {
      addNotification({
        title: t("mmdExportSequence"),
        message: t("mmdExportSequenceLarge").replace("{n}", String(frameCount)),
        type: "warning",
        category: "media",
        appId: "mmd-studio",
      });
    }

    offlineCancelRef.current = false;
    sequenceBusyRef.current = true;
    setPlaying(false);
    audioRef.current?.pause();
    applyHideGrid();
    setExportingOffline(true);
    setExportProgress(0);
    await waitPresentedFrames(1);
    prepareCanvasSize();
    await waitPresentedFrames(3);

    const frames: { name: string; data: Blob }[] = [];
    let cancelled = false;
    try {
      for (let i = 0; i < frameCount; i += 1) {
        if (offlineCancelRef.current || !mountedRef.current) {
          cancelled = true;
          break;
        }
        const time = Math.min(safeEnd, safeStart + i * step);
        seek(time);
        await waitPresentedFrames(2);
        const blob = await apiRef.current?.captureStillPng();
        if (!blob) continue;
        frames.push({
          name: `frame_${String(i + 1).padStart(5, "0")}.png`,
          data: blob,
        });
        if (mountedRef.current) setExportProgress((i + 1) / frameCount);
      }
    } finally {
      if (mountedRef.current) {
        setExportingOffline(false);
        setExportProgress(null);
        restoreExportSideEffects();
      } else {
        try {
          apiRef.current?.restoreRecordingCanvasSize();
        } catch {
          // ignore
        }
      }
      sequenceBusyRef.current = false;
      offlineCancelRef.current = false;
    }

    if (!mountedRef.current) return;

    if (cancelled) {
      addNotification({
        title: t("mmdExportSequence"),
        message: t("mmdExportCancelled"),
        type: "info",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }

    if (!frames.length) {
      addNotification({
        title: t("mmdExportSequence"),
        message: t("mmdExportStillFailed"),
        type: "error",
        category: "media",
        appId: "mmd-studio",
      });
      return;
    }

    const zip = await buildZipStore(frames);
    const safe = (exportFilePrefix.trim() || "mmd-export").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
    const name = `${safe}-png-seq-${exportFps}fps-${Date.now()}.zip`;
    const url = triggerDownload(zip, name);
    rememberExportObjectUrl(url);
    addDownload({ name, source: t("appMmdStudio"), size: zip.size, mimeType: "application/zip", url });
    addNotification({
      title: t("mmdExportSequence"),
      message: `${name} (${frames.length})`,
      type: "success",
      category: "media",
      appId: "mmd-studio",
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      offlineCancelRef.current = true;
      clearRecordTimer();
      if (exportObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(exportObjectUrlRef.current);
        } catch {
          // ignore
        }
        exportObjectUrlRef.current = null;
      }
    };
  }, []);

  return {
    recording,
    exportingOffline,
    /** Busy for either realtime or offline export (UI disable / stop). */
    exportBusy: recording || exportingOffline,
    toggleRecord,
    captureStill,
    exportPngSequence,
  };
}
