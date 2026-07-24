import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../downloadStore";
import { useLanguageStore } from "../languageStore";

export function RecorderApp() {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const unmountedRef = useRef(false);
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    if (starting || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("recorderUnavailable"));
      return;
    }

    try {
      setStarting(true);
      setError(null);
      setAudioUrl(null);
      setElapsed(0);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!unmountedRef.current) {
          setAudioUrl(URL.createObjectURL(blob));
          setRecording(false);
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecording(true);
    } catch {
      if (!unmountedRef.current) {
        setError(t("recorderPermissionDenied"));
        setRecording(false);
      }
    } finally {
      if (!unmountedRef.current) setStarting(false);
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function saveRecording() {
    if (!audioUrl) return;
    const filename = `neko-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    const size = chunksRef.current.reduce(
      (total, chunk) => total + (chunk instanceof Blob ? chunk.size : 0),
      0,
    );
    downloadBlob({
      url: audioUrl,
      name: filename,
      source: t("appRecorder"),
      size,
      mimeType: "audio/webm",
    });
  }

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");
  const status = recording ? t("recorderRecording") : audioUrl ? t("recorderComplete") : t("recorderReady");

  return (
    <div className="recorder-app">
      <section className={clsx("recorder-stage", recording && "is-recording")}>
        <div className="recorder-orb">
          <Icon icon="solar:microphone-3-bold-duotone" width={46} height={46} />
        </div>
        <span>{status}</span>
        <strong>{minutes}:{seconds}</strong>
      </section>

      <div className="recorder-actions">
        {recording ? (
          <button className="button-primary" onClick={stopRecording}>{t("recorderStop")}</button>
        ) : (
          <button className="button-primary" onClick={() => void startRecording()} disabled={starting}>{starting ? t("apiSending") : t("recorderStart")}</button>
        )}
        <button type="button" className={clsx("button-ghost", !audioUrl && "is-disabled")} disabled={!audioUrl} onClick={saveRecording}>{t("recorderDownload")}</button>
      </div>

      <div className="recorder-playback">
        {audioUrl ? <audio controls src={audioUrl} /> : <div className="empty-state compact"><p>{error ?? t("recorderNoClip")}</p></div>}
      </div>
    </div>
  );
}
