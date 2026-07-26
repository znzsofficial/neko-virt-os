import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createPanelTexture, paintSecondaryButton, roundRectPath } from "../../shared/panelTexture";
import { getMmdVrClock } from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore } from "../mmdVrStore";
import {
  formatMmdVrModelScale,
  MMD_VR_HEIGHT_OFFSET_STEP,
  nextMmdVrModelScale,
  previousMmdVrModelScale,
} from "../mmdVrAdjustments";
import { getXrAccentTokens, hexToRgba } from "../../xr";

/** Match paintProgressBar track insets (px on 640-wide canvas). */
const PROGRESS_PAD = 16;
const PANEL_DEFAULT_POSITION: [number, number, number] = [0, 1.2, -1.55];

export function clampMmdVrHudPosition(position: THREE.Vector3): [number, number, number] {
  return [
    Math.min(1.8, Math.max(-1.8, position.x)),
    Math.min(2.25, Math.max(0.65, position.y)),
    Math.min(-0.75, Math.max(-2.4, position.z)),
  ];
}

type HudDragState = {
  pointerId: number;
  offset: THREE.Vector3;
  plane: THREE.Plane;
};

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
  active = false,
  danger = false,
}: {
  position: [number, number, number];
  label: string;
  disabled?: boolean;
  onPress: () => void;
  size?: [number, number];
  active?: boolean;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const themeColor = useMmdVrStore((s) => s.prefs.themeColor);
  const accent = getXrAccentTokens(themeColor);
  const texture = useMemo(
    () =>
      createPanelTexture(
        320,
        88,
        ({ ctx, width, height }) => {
          paintSecondaryButton({ ctx, width, height }, label);
          if (active || danger) {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = active ? hexToRgba(accent.primary, 0.42) : "rgba(126, 32, 42, 0.34)";
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = "source-over";
          }
        },
        "en",
      ),
    [accent.primary, active, danger, label],
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
      scale={pressed ? 0.97 : hovered ? 1.025 : 1}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (!disabled) setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (disabled) return;
        setPressed(true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setPressed(false);
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
        color={hovered && !disabled ? "#ffffff" : "#e9e1e4"}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

function PanelBackdrop() {
  const themeColor = useMmdVrStore((s) => s.prefs.themeColor);
  const accent = getXrAccentTokens(themeColor);
  const texture = useMemo(
    () => createPanelTexture(1400, 620, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      roundRectPath(ctx, 2, 2, width - 4, height - 4, 28);
      ctx.fillStyle = "rgba(18, 15, 18, 0.94)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(accent.border, 0.58);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, 330);
      ctx.lineTo(width - 38, 330);
      ctx.stroke();
    }, "en"),
    [accent.border],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[0.16, -0.08, -0.018]}
      renderOrder={20}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <planeGeometry args={[3.4, 1.16]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

function DragHandle({
  label,
  onDragChange,
  onPositionChange,
}: {
  label: string;
  onDragChange: (dragging: boolean) => void;
  onPositionChange: (position: [number, number, number]) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<HudDragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const themeColor = useMmdVrStore((s) => s.prefs.themeColor);
  const accent = getXrAccentTokens(themeColor);
  const texture = useMemo(
    () => createPanelTexture(720, 72, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      roundRectPath(ctx, 1, 1, width - 2, height - 2, 18);
      ctx.fillStyle = dragging ? hexToRgba(accent.primary, 0.82) : "rgba(38, 45, 58, 0.96)";
      ctx.fill();
      ctx.fillStyle = "#f2eaed";
      ctx.font = "650 25px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`⋮⋮  ${label}`, width / 2, height / 2);
    }, "en"),
    [accent.primary, dragging, label],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => onDragChange(false), [onDragChange]);

  function finish(pointerId?: number) {
    const drag = dragRef.current;
    if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return;
    dragRef.current = null;
    setDragging(false);
    onDragChange(false);
  }

  function begin(e: ThreeEvent<PointerEvent>) {
    const handle = groupRef.current;
    const panel = handle?.parent;
    const parent = panel?.parent;
    if (!panel || !parent) return;
    e.stopPropagation();
    const normal = new THREE.Vector3();
    panel.getWorldDirection(normal);
    const localHit = parent.worldToLocal(e.point.clone());
    dragRef.current = {
      pointerId: e.pointerId,
      offset: panel.position.clone().sub(localHit),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, e.point),
    };
    setDragging(true);
    onDragChange(true);
    try {
      (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    } catch {
      // Pointer capture is optional in WebXR implementations.
    }
  }

  function move(e: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    const panel = groupRef.current?.parent;
    const parent = panel?.parent;
    if (!drag || !panel || !parent || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const worldHit = new THREE.Vector3();
    if (!e.ray.intersectPlane(drag.plane, worldHit)) return;
    const local = parent.worldToLocal(worldHit).add(drag.offset);
    const next = clampMmdVrHudPosition(local);
    panel.position.set(...next);
    onPositionChange(next);
  }

  function end(e: ThreeEvent<PointerEvent>) {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    finish(e.pointerId);
    try {
      (e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore unsupported capture release.
    }
  }

  return (
    <group ref={groupRef} position={[0.16, 0.56, 0.012]}>
      <mesh
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <planeGeometry args={[0.92, 0.11]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

function ValueLabel({ position, label, value }: { position: [number, number, number]; label: string; value: string }) {
  const texture = useMemo(
    () => createPanelTexture(440, 88, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#a99ca1";
      ctx.font = "600 24px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 8, height / 2);
      ctx.fillStyle = "#f2eaed";
      ctx.font = "700 30px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(value, width - 8, height / 2);
    }, "en"),
    [label, value],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} renderOrder={30} raycast={() => null}>
      <planeGeometry args={[0.58, 0.11]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} fog={false} />
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
  const themeColor = useMmdVrStore((s) => s.prefs.themeColor);
  const accent = getXrAccentTokens(themeColor);

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
    [accent.primary],
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
    ctx.fillStyle = accent.primary;
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

function ModelPanelBackdrop() {
  const themeColor = useMmdVrStore((s) => s.prefs.themeColor);
  const accent = getXrAccentTokens(themeColor);
  const texture = useMemo(
    () => createPanelTexture(720, 360, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      roundRectPath(ctx, 2, 2, width - 4, height - 4, 24);
      ctx.fillStyle = "rgba(15, 20, 30, 0.95)";
      ctx.fill();
      ctx.strokeStyle = hexToRgba(accent.border, 0.72);
      ctx.lineWidth = 3;
      ctx.stroke();
    }, "en"),
    [accent.border],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0, -0.015]} renderOrder={20} onPointerDown={(event) => event.stopPropagation()}>
      <planeGeometry args={[1.02, 0.52]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

function ModelPanel({
  modelId,
  position,
  hideLabel,
  showLabel,
  placeOnLabel,
  placeOffLabel,
  scaleLabel,
  resetValueLabel,
}: {
  modelId: string;
  position: [number, number, number];
  hideLabel: string;
  showLabel: string;
  placeOnLabel: string;
  placeOffLabel: string;
  scaleLabel: string;
  resetValueLabel: string;
}) {
  const model = useMmdVrStore((s) => s.models.find((entry) => entry.id === modelId));
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const placeModelId = useMmdVrStore((s) => s.placeModelId);
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const setPlaceModelId = useMmdVrStore((s) => s.setPlaceModelId);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);

  if (!model) return null;
  const placementActive = placeMode && placeModelId === model.id;
  const setScale = (scale: number) => requestModelScale(model.id, scale);

  return (
    <group position={position}>
      <ModelPanelBackdrop />
      <ValueLabel position={[0, 0.17, 0]} label={shortName(model.name, 14)} value={model.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.03, 0]}
        label={model.visible ? hideLabel : showLabel}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(model.id)}
      />
      <HudButton
        position={[0.25, 0.03, 0]}
        label={placementActive ? placeOnLabel : placeOffLabel}
        active={placementActive}
        size={[0.42, 0.11]}
        onPress={() => {
          if (placementActive) {
            setPlaceMode(false);
          } else {
            setPlaceModelId(model.id);
            setPlaceMode(true);
          }
        }}
      />
      <ValueLabel position={[-0.28, -0.12, 0]} label={scaleLabel} value={formatMmdVrModelScale(model.scale)} />
      <HudButton position={[0.08, -0.12, 0]} label="−" size={[0.2, 0.11]} onPress={() => setScale(previousMmdVrModelScale(model.scale))} />
      <HudButton position={[0.28, -0.12, 0]} label={resetValueLabel} size={[0.22, 0.11]} onPress={() => setScale(1)} />
      <HudButton position={[0.48, -0.12, 0]} label="+" size={[0.2, 0.11]} onPress={() => setScale(nextMmdVrModelScale(model.scale))} />
    </group>
  );
}

function ModelPanels(props: Pick<Parameters<typeof ModelPanel>[0], "hideLabel" | "showLabel" | "placeOnLabel" | "placeOffLabel" | "scaleLabel" | "resetValueLabel">) {
  const models = useMmdVrStore((s) => s.models.slice(0, 3));
  const spacing = 1.1;
  return (
    <group position={[0.16, -0.68, 0]}>
      {models.map((model, index) => (
        <ModelPanel
          key={model.id}
          {...props}
          modelId={model.id}
          position={[(index - (models.length - 1) / 2) * spacing, 0, 0]}
        />
      ))}
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
  placeOnLabel,
  placeOffLabel,
  placeHint,
  lightStageLabel,
  lightSoftLabel,
  lightContrastLabel,
  shadowsLabel,
  gridLabel,
  scaleLabel,
  heightLabel,
  resetValueLabel,
  panelHideLabel,
  panelShowLabel,
  panelDragLabel,
  onDragChange,
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
  placeOnLabel: string;
  placeOffLabel: string;
  placeHint: string;
  lightStageLabel: string;
  lightSoftLabel: string;
  lightContrastLabel: string;
  shadowsLabel: string;
  gridLabel: string;
  scaleLabel: string;
  heightLabel: string;
  resetValueLabel: string;
  panelHideLabel: string;
  panelShowLabel: string;
  panelDragLabel: string;
  onDragChange: (dragging: boolean) => void;
  onExit: () => void;
  busy: boolean;
}) {
  const playing = useMmdVrStore((s) => s.playing);
  const loop = useMmdVrStore((s) => s.loop);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const statusLine = useMmdVrStore((s) => s.statusLine);
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const lightPreset = useMmdVrStore((s) => s.prefs.lightPreset);
  const prefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(prefs);
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setLoop = useMmdVrStore((s) => s.setLoop);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const resetView = useMmdVrStore((s) => s.resetView);
  const cycleLightPreset = useMmdVrStore((s) => s.cycleLightPreset);
  const setPrefs = useMmdVrStore((s) => s.setPrefs);
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelPosition, setPanelPosition] = useState(PANEL_DEFAULT_POSITION);
  const heightOffset = prefs.heightOffset;

  const status =
    statusLine ??
    (modelCount === 0 ? emptyHint : placeMode ? placeHint : null);
  const lightLabel =
    lightPreset === "soft"
      ? lightSoftLabel
      : lightPreset === "contrast"
        ? lightContrastLabel
        : lightStageLabel;

  if (!panelVisible) {
    return (
      <HudButton
        position={[0, 0.88, -1.05]}
        label={panelShowLabel}
        size={[0.54, 0.13]}
        onPress={() => setPanelVisible(true)}
      />
    );
  }

  return (
    <group position={panelPosition}>
      <PanelBackdrop />
      <DragHandle label={panelDragLabel} onDragChange={onDragChange} onPositionChange={setPanelPosition} />
      <HudButton position={[1.43, 0.42, 0]} label={panelHideLabel} size={[0.36, 0.1]} onPress={() => setPanelVisible(false)} />
      {status ? <StatusPlane text={status} /> : null}
      <ProgressBar />
      <HudButton
        position={[-1.18, 0.05, 0]}
        label={playing ? pauseLabel : playLabel}
        disabled={busy || modelCount === 0}
        active={playing}
        onPress={() => setPlaying(!useMmdVrStore.getState().playing)}
      />
      <HudButton
        position={[-0.82, 0.05, 0]}
        label={loop ? loopOnLabel : loopOffLabel}
        disabled={busy}
        active={loop}
        onPress={() => setLoop(!useMmdVrStore.getState().loop)}
      />
      <HudButton
        position={[-0.45, 0.05, 0]}
        label={placeMode ? placeOnLabel : placeOffLabel}
        disabled={busy || modelCount === 0}
        size={[0.38, 0.11]}
        active={placeMode}
        onPress={() => setPlaceMode(!useMmdVrStore.getState().placeMode)}
      />
      <HudButton
        position={[-0.05, 0.05, 0]}
        label={lightLabel}
        disabled={busy}
        size={[0.4, 0.11]}
        onPress={() => cycleLightPreset()}
      />
      <HudButton
        position={[0.35, 0.05, 0]}
        label={shadowsLabel}
        disabled={busy}
        active={profile.shadows}
        onPress={() => setPrefs({ shadowsPref: profile.shadows ? "off" : "on" })}
      />
      <HudButton
        position={[0.71, 0.05, 0]}
        label={gridLabel}
        disabled={busy}
        active={profile.showGrid}
        onPress={() => setPrefs({ gridPref: profile.showGrid ? "off" : "on" })}
      />
      <HudButton position={[1.07, 0.05, 0]} label={resetLabel} disabled={busy} onPress={() => resetView()} />
      <HudButton position={[1.43, 0.05, 0]} label={exitLabel} disabled={busy} danger onPress={onExit} />
      <ValueLabel position={[-0.83, -0.21, 0]} label={heightLabel} value={`${heightOffset >= 0 ? "+" : ""}${heightOffset.toFixed(1)} m`} />
      <HudButton position={[-0.43, -0.21, 0]} label="−" size={[0.24, 0.11]} onPress={() => setPrefs({ heightOffset: heightOffset - MMD_VR_HEIGHT_OFFSET_STEP })} />
      <HudButton position={[-0.15, -0.21, 0]} label={resetValueLabel} size={[0.3, 0.11]} onPress={() => setPrefs({ heightOffset: 0 })} />
      <HudButton position={[0.17, -0.21, 0]} label="+" size={[0.24, 0.11]} onPress={() => setPrefs({ heightOffset: heightOffset + MMD_VR_HEIGHT_OFFSET_STEP })} />
      <ModelPanels
        hideLabel={hideLabel}
        showLabel={showLabel}
        placeOnLabel={placeOnLabel}
        placeOffLabel={placeOffLabel}
        scaleLabel={scaleLabel}
        resetValueLabel={resetValueLabel}
      />
      <FpsBadge />
    </group>
  );
}
