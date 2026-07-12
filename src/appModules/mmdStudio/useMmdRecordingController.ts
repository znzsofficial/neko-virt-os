import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { useDownloadStore } from "../../downloadStore";
import { useLanguageStore } from "../../languageStore";
import { useNotificationStore } from "../../notificationStore";
import type { MmdSceneApi } from "./MmdCanvas";
import {
  buildExportFileName,
  getExportSize,
  getExportVideoBits,
  resolveExportMimeType,
  useMmdStudioStore,
} from "./mmdStudioStore";

type UseMmdRecordingControllerOptions = {
  apiRef: MutableRefObject<MmdSceneApi | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  seek: (time: number) => void;
};

export function useMmdRecordingController({
  apiRef,
  audioRef,
  seek,
}: UseMmdRecordingControllerOptions) {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addDownload = useDownloadStore((state) => state.addDownload);
  const recording = useMmdStudioStore((state) => state.recording);
  const setRecording = useMmdStudioStore((state) => state.setRecording);
  const setPlaying = useMmdStudioStore((state) => state.setPlaying);
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const setShowGrid = useMmdStudioStore((state) => state.setShowGrid);
  const backend = useMmdStudioStore((state) => state.backend);
  const models = useMmdStudioStore((state) => state.models);
  const duration = useMmdStudioStore((state) => state.duration);
  const speed = useMmdStudioStore((state) => state.speed);
  const exportResolution = useMmdStudioStore((state) => state.exportResolution);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const exportCodec = useMmdStudioStore((state) => state.exportCodec);
  const exportBitrate = useMmdStudioStore((state) => state.exportBitrate);
  const exportIncludeAudio = useMmdStudioStore((state) => state.exportIncludeAudio);
  const exportHideGrid = useMmdStudioStore((state) => state.exportHideGrid);
  const exportFilePrefix = useMmdStudioStore((state) => state.exportFilePrefix);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const exportRangeSeconds = useMmdStudioStore((state) => state.exportRangeSeconds);

  const exportObjectUrlRef = useRef<string | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const gridRestoreRef = useRef<boolean | null>(null);

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
    apiRef.current?.restoreRecordingCanvasSize();
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

    const size = getExportSize(exportResolution);
    if (apiRef.current) {
      apiRef.current.setRecordingCanvasSize(size.width, size.height);
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
      apiRef.current?.restoreRecordingCanvasSize();
      return;
    }
    setRecording(true);

    const rangeMs = Math.ceil(exportRangeSeconds() * 1000) + 400;
    clearRecordTimer();
    recordTimerRef.current = window.setTimeout(() => {
      if (useMmdStudioStore.getState().recording) void finishRecord();
    }, rangeMs);
  }

  useEffect(() => () => {
    clearRecordTimer();
    if (exportObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(exportObjectUrlRef.current);
      } catch {
        // ignore
      }
      exportObjectUrlRef.current = null;
    }
  }, []);

  return {
    recording,
    toggleRecord,
  };
}
