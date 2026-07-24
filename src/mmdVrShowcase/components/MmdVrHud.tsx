import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createPanelTexture, paintSecondaryButton } from "../../shared/panelTexture";
import { getMmdVrClock } from "../mmdVrClock";
import { useMmdVrStore } from "../mmdVrStore";

/** Match paintProgressBar track insets (px on 640-wide canvas). */
const PROGRESS_PAD = 16;

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function shortName(name: string, max = 8) {
  const base = name.replace(/\.[^.]+$/, "");
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1)}…`;
}

function HudButton({
  position,
  label,
  disabled,
  onPress,
  size = [0.36, 0.11] as [number, number],
}: {
  position: [number, number, number];
  label: string;
  disabled?: boolean;
  onPress: () => void;
  size?: [number, number];
}) {
  const texture = useMemo(
    () =>
      createPanelTexture(
        320,
        88,
        ({ ctx, width, height }) => paintSecondaryButton({ ctx, width, height }, label),
        "en",
      ),
    [label],
  );

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPress();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPress();
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        transparent
        fog={false}
        opacity={disabled ? 0.45 : 1}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

function StatusPlane({ text }: { text: string }) {
  const texture = useMemo(
    () =>
      createPanelTexture(
        720,
        96,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "rgba(12, 16, 24, 0.72)";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#e8eef8";
          ctx.font = "600 26px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text.slice(0, 48), width / 2, height / 2);
        },
        "en",
      ),
    [text],
  );

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh position={[0, 0.42, 0]}>
      <planeGeometry args={[1.05, 0.12]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} depthWrite={false} />
    </mesh>
  );
}

function ProgressBar() {
  const duration = useMmdVrStore((s) => s.duration);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const requestSeek = useMmdVrStore((s) => s.requestSeek);

  const texture = useMemo(
    () =>
      createPanelTexture(
        640,
        72,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "rgba(12, 16, 24, 0.75)";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(PROGRESS_PAD, height / 2 - 6, width - PROGRESS_PAD * 2, 12);
          ctx.fillStyle = "#c8d4e8";
          ctx.font = "600 22px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("0:00 / 0:00", width / 2, height / 2);
        },
        "en",
      ),
    [],
  );

  const lastPaintVersionRef = useRef(-1);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  useFrame(() => {
    if (modelCount === 0) return;
    const clock = getMmdVrClock();
    if (clock.duration <= 0) return;
    if (clock.paintVersion === lastPaintVersionRef.current) return;
    lastPaintVersionRef.current = clock.paintVersion;

    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 640;
    const h = 72;
    const trackW = w - PROGRESS_PAD * 2;
    const ratio = Math.min(1, Math.max(0, clock.time / clock.duration));
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(12, 16, 24, 0.75)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(PROGRESS_PAD, h / 2 - 6, trackW, 12);
    ctx.fillStyle = "#6bb8ea";
    ctx.fillRect(PROGRESS_PAD, h / 2 - 6, trackW * ratio, 12);
    ctx.fillStyle = "#c8d4e8";
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${formatTime(clock.time)} / ${formatTime(clock.duration)}`, w / 2, h / 2);
    texture.needsUpdate = true;
  });

  if (modelCount === 0 || duration <= 0) return null;

  return (
    <mesh
      position={[0, 0.22, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const uv = e.uv;
        if (!uv) return;
        // Map UV through the painted track (not full plane including side padding).
        const trackStart = PROGRESS_PAD / 640;
        const trackEnd = 1 - PROGRESS_PAD / 640;
        const span = trackEnd - trackStart;
        const ratio = Math.min(1, Math.max(0, (uv.x - trackStart) / span));
        const d = useMmdVrStore.getState().duration;
        requestSeek(ratio * d);
      }}
    >
      <planeGeometry args={[1.05, 0.1]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} depthWrite={false} />
    </mesh>
  );
}

function ModelList({ hideLabel, showLabel }: { hideLabel: string; showLabel: string }) {
  const models = useMmdVrStore((s) => s.models);
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);

  if (!models.length) return null;

  return (
    <group position={[0.72, 0.05, 0]}>
      {models.slice(0, 3).map((m, i) => {
        const short = shortName(m.name);
        const label = m.visible ? `${hideLabel} ${short}` : `${showLabel} ${short}`;
        return (
          <HudButton
            key={m.id}
            position={[0, 0.14 - i * 0.13, 0]}
            label={label}
            size={[0.42, 0.11]}
            onPress={() => enqueueVisibilityToggle(m.id)}
          />
        );
      })}
    </group>
  );
}

function FpsBadge() {
  const show = useMmdVrStore((s) => s.prefs.showFps);
  const texture = useMemo(
    () =>
      createPanelTexture(
        160,
        64,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#9fe870";
          ctx.font = "700 28px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("—", width / 2, height / 2);
        },
        "en",
      ),
    [],
  );
  const accRef = useRef(0);
  const framesRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  useFrame((_, delta) => {
    if (!show) return;
    framesRef.current += 1;
    accRef.current += delta;
    if (accRef.current < 0.35) return;
    const fps = Math.round(framesRef.current / accRef.current);
    framesRef.current = 0;
    accRef.current = 0;
    if (fps === lastRef.current) return;
    lastRef.current = fps;
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 160, 64);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, 160, 64);
    ctx.fillStyle = "#9fe870";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${fps}`, 80, 32);
    texture.needsUpdate = true;
  });

  if (!show) return null;
  return (
    <mesh position={[-0.72, 0.42, 0]} renderOrder={30}>
      <planeGeometry args={[0.16, 0.07]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

/** World-space control strip in front of the player origin. */
export function MmdVrControlBar({
  playLabel,
  pauseLabel,
  loopOnLabel,
  loopOffLabel,
  resetLabel,
  exitLabel,
  emptyHint,
  hideLabel,
  showLabel,
  lightStageLabel,
  lightSoftLabel,
  lightContrastLabel,
  onExit,
  busy,
}: {
  playLabel: string;
  pauseLabel: string;
  loopOnLabel: string;
  loopOffLabel: string;
  resetLabel: string;
  exitLabel: string;
  emptyHint: string;
  hideLabel: string;
  showLabel: string;
  lightStageLabel: string;
  lightSoftLabel: string;
  lightContrastLabel: string;
  onExit: () => void;
  busy: boolean;
}) {
  const playing = useMmdVrStore((s) => s.playing);
  const loop = useMmdVrStore((s) => s.loop);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const statusLine = useMmdVrStore((s) => s.statusLine);
  const lightPreset = useMmdVrStore((s) => s.prefs.lightPreset);
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setLoop = useMmdVrStore((s) => s.setLoop);
  const resetView = useMmdVrStore((s) => s.resetView);
  const cycleLightPreset = useMmdVrStore((s) => s.cycleLightPreset);

  const status = statusLine ?? (modelCount === 0 ? emptyHint : null);
  const lightLabel =
    lightPreset === "soft"
      ? lightSoftLabel
      : lightPreset === "contrast"
        ? lightContrastLabel
        : lightStageLabel;

  return (
    <group position={[0, 1.12, -1.4]}>
      {status ? <StatusPlane text={status} /> : null}
      <ProgressBar />
      <HudButton
        position={[-0.58, -0.02, 0]}
        label={playing ? pauseLabel : playLabel}
        disabled={busy || modelCount === 0}
        onPress={() => setPlaying(!useMmdVrStore.getState().playing)}
      />
      <HudButton
        position={[-0.18, -0.02, 0]}
        label={loop ? loopOnLabel : loopOffLabel}
        disabled={busy}
        onPress={() => setLoop(!useMmdVrStore.getState().loop)}
      />
      <HudButton
        position={[0.22, -0.02, 0]}
        label={lightLabel}
        disabled={busy}
        size={[0.42, 0.11]}
        onPress={() => cycleLightPreset()}
      />
      <HudButton position={[0.62, -0.02, 0]} label={resetLabel} disabled={busy} onPress={() => resetView()} />
      <HudButton position={[0.98, -0.02, 0]} label={exitLabel} disabled={busy} onPress={onExit} />
      <ModelList hideLabel={hideLabel} showLabel={showLabel} />
      <FpsBadge />
    </group>
  );
}
