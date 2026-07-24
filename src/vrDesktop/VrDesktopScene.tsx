import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useXR, useXRControllerLocomotion, XR, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { appTitleKeys } from "../appText";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import { formatClockTime } from "../systemPrefs";
import type { AppId } from "../types";
import { useDesktopStore } from "../windowStore";
import { readStickyNotes } from "../stickyBoardStorage";
import { VR_DEFAULT_LAYOUT } from "./vrLayout";
import {
  createPanelTexture,
  paintFpsBadge,
  paintHomePanel,
  paintLauncherPanel,
  paintSecondaryButton,
  paintStickyPreviewPanel,
  type LauncherHit,
  type LauncherPage,
} from "./vrPanelTexture";
import { attachPendingSessionToRenderer, endVrDesktopSession, vrXrStore } from "./vrSession";
import { useVrDesktopStore } from "./vrDesktopStore";
import { getVrRenderProfile, scalePanelSize, VR_PANEL_BASE } from "./vrQuality";
import { vrTheme } from "./vrTheme";

const HOME_PANEL = { w: 2.2, h: 1.375 };
const LAUNCH_PANEL = { w: 1.9, h: 1.425 };
const STICKY_PANEL = { w: 1.35, h: 1.05 };

/** Survive React Strict Mode double-mount without ending the XR session mid-remount. */
let vrSceneMountCount = 0;

/** VR launcher pages — keeps each page scannable (≤9 tiles). */
const VR_LAUNCHER_PAGES: { id: string; labelZh: string; labelEn: string; ids: AppId[] }[] = [
  {
    id: "frequent",
    labelZh: "常用",
    labelEn: "Frequent",
    ids: ["files", "notes", "browser", "calendar", "tasks", "timer", "calculator", "sticky-board"],
  },
  {
    id: "system",
    labelZh: "系统",
    labelEn: "System",
    ids: ["settings", "terminal", "clipboard", "about"],
  },
];

type HudStatus = { kind: "idle" } | { kind: "opening"; label: string } | { kind: "exiting" };

/**
 * Click path already called requestSession(); bind that session once gl is ready.
 * Attach is idempotent under Strict Mode (session kept until setSession succeeds).
 */
function AttachPendingSession() {
  const gl = useThree((s) => s.gl);
  const setPhase = useVrDesktopStore((s) => s.setPhase);
  const failEnter = useVrDesktopStore((s) => s.failEnter);
  const renderQuality = useVrDesktopStore((s) => s.prefs.renderQuality);

  useEffect(() => {
    let cancelled = false;
    void attachPendingSessionToRenderer(gl, renderQuality)
      .then((attached) => {
        if (!cancelled && attached) setPhase("active");
      })
      .catch((err) => {
        console.error("[vrDesktop] setSession failed", err);
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : "set_session_failed";
          failEnter(detail);
          void endVrDesktopSession();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [failEnter, gl, renderQuality, setPhase]);

  return null;
}

function SessionSync() {
  const session = useXR((state) => state.session);
  const setPhase = useVrDesktopStore((state) => state.setPhase);
  const closeOverlay = useVrDesktopStore((state) => state.closeOverlay);

  useEffect(() => {
    if (!session) return;
    setPhase("active");
    const onEnd = () => {
      closeOverlay();
    };
    session.addEventListener("end", onEnd);
    return () => session.removeEventListener("end", onEnd);
  }, [closeOverlay, session, setPhase]);

  return null;
}

/**
 * Hide 2D exit HUD only when session mode is explicitly immersive.
 * Unknown/inline/desktop keep the HUD for debugging.
 */
function HeadsetHudGate({ onHideHud }: { onHideHud: (hide: boolean) => void }) {
  const session = useXR((state) => state.session);
  useEffect(() => {
    if (!session) {
      onHideHud(false);
      return;
    }
    const mode = (session as XRSession & { mode?: string }).mode;
    onHideHud(mode === "immersive-vr" || mode === "immersive-ar");
  }, [onHideHud, session]);
  return null;
}

/**
 * Snap-turn the player by moving XROrigin (feet / XR camera parent).
 * layoutEpoch zeros origin yaw/position (layout reset).
 */
function PlayerRig() {
  const originRef = useRef<THREE.Group>(null);
  const layoutEpoch = useVrDesktopStore((s) => s.layoutEpoch);
  useXRControllerLocomotion(originRef, false, { type: "snap", degrees: 30, deadZone: 0.65 });

  useEffect(() => {
    const g = originRef.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
  }, [layoutEpoch]);

  return (
    <XROrigin ref={originRef}>
      <SoftEdges />
      <FpsHud />
    </XROrigin>
  );
}

/** Lightweight FPS badge in front of the player (P1 acceptance). */
function FpsHud() {
  const show = useVrDesktopStore((s) => s.prefs.showFps);
  const texture = useMemo(() => {
    return createPanelTexture(160, 64, (p) => paintFpsBadge(p, 0), "en");
  }, []);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const framesRef = useRef(0);

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
    paintFpsBadge({ ctx, width: 160, height: 64 }, fps);
    texture.needsUpdate = true;
  });

  if (!show) return null;
  return (
    <mesh position={[0.55, 1.55, -1.15]} renderOrder={30}>
      <planeGeometry args={[0.22, 0.09]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

function formatDate(date: Date, language: "zh" | "en") {
  return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function HomeScreen({ statusLine }: { statusLine: string | null }) {
  const language = useLanguageStore((state) => state.language);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const windowCount = useDesktopStore((state) => state.windows.length);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).panelScale);
  const homeW = scalePanelSize(VR_PANEL_BASE.home.w, panelScale);
  const homeH = scalePanelSize(VR_PANEL_BASE.home.h, panelScale);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(statusLine);
  statusRef.current = statusLine;
  const windowCountRef = useRef(windowCount);
  windowCountRef.current = windowCount;

  const texture = useMemo(() => {
    const now = new Date();
    const map = createPanelTexture(
      homeW,
      homeH,
      (p) =>
        paintHomePanel(p, formatClockTime(now, hour12, true), formatDate(now, language), {
          windowCount: windowCountRef.current,
          language,
          statusLine: statusRef.current,
        }),
      language,
    );
    canvasRef.current = map.image as HTMLCanvasElement;
    return map;
  }, [homeH, homeW, hour12, language]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const now = new Date();
    paintHomePanel(
      { ctx, width: homeW, height: homeH, language },
      formatClockTime(now, hour12, true),
      formatDate(now, language),
      { windowCount: windowCountRef.current, language, statusLine: statusRef.current },
    );
    texture.needsUpdate = true;
  }, [homeH, homeW, hour12, language, texture]);

  useEffect(() => {
    repaint();
  }, [repaint, statusLine, windowCount]);

  useEffect(() => {
    const id = window.setInterval(repaint, 1000);
    return () => window.clearInterval(id);
  }, [repaint]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  const pose = VR_DEFAULT_LAYOUT.home;
  return (
    <PanelFrame position={pose.position} rotation={pose.rotation} size={HOME_PANEL}>
      <mesh position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}>
        <planeGeometry args={[HOME_PANEL.w, HOME_PANEL.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} fog={false} />
      </mesh>
    </PanelFrame>
  );
}

function LauncherScreen({
  onLaunch,
  disabled,
}: {
  onLaunch: (appId: AppId, label: string) => void;
  disabled: boolean;
}) {
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).panelScale);
  const launchW = scalePanelSize(VR_PANEL_BASE.launch.w, panelScale);
  const launchH = scalePanelSize(VR_PANEL_BASE.launch.h, panelScale);
  const hoverIdRef = useRef<string | null>(null);
  const pageRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitsRef = useRef<LauncherHit[]>([]);

  const pages: LauncherPage[] = useMemo(
    () =>
      VR_LAUNCHER_PAGES.map((page) => ({
        id: page.id,
        labelZh: page.labelZh,
        labelEn: page.labelEn,
        items: page.ids.map((id) => ({
          id,
          label: t(appTitleKeys[id] as TranslationKey),
        })),
      })),
    [t],
  );

  const texture = useMemo(() => {
    pageRef.current = 0;
    hoverIdRef.current = null;
    let hits: LauncherHit[] = [];
    const map = createPanelTexture(
      launchW,
      launchH,
      (p) => {
        hits = paintLauncherPanel(p, pages, { hoverId: null, pageIndex: 0 });
      },
      language,
    );
    hitsRef.current = hits;
    canvasRef.current = map.image as HTMLCanvasElement;
    return map;
  }, [language, launchH, launchW, pages]);

  const repaint = useCallback(
    (hoverId: string | null, pageIndex = pageRef.current) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      pageRef.current = pageIndex;
      hitsRef.current = paintLauncherPanel(
        { ctx, width: launchW, height: launchH, language },
        pages,
        { hoverId, pageIndex },
      );
      texture.needsUpdate = true;
    },
    [language, launchH, launchW, pages, texture],
  );

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  function hitTest(uv: THREE.Vector2 | undefined): LauncherHit | undefined {
    if (!uv) return undefined;
    const px = uv.x * launchW;
    const py = (1 - uv.y) * launchH;
    return hitsRef.current.find(
      (c) => px >= c.rect.x && px <= c.rect.x + c.rect.w && py >= c.rect.y && py <= c.rect.y + c.rect.h,
    );
  }

  const pose = VR_DEFAULT_LAYOUT.launch;
  return (
    <PanelFrame position={pose.position} rotation={pose.rotation} size={LAUNCH_PANEL}>
      <mesh
        position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}
        onPointerMove={(event) => {
          if (disabled) return;
          const hit = hitTest(event.uv);
          const next = hit?.kind === "app" ? hit.id : null;
          if (next !== hoverIdRef.current) {
            hoverIdRef.current = next;
            repaint(next);
          }
        }}
        onPointerOut={() => {
          if (hoverIdRef.current == null) return;
          hoverIdRef.current = null;
          repaint(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          const hit = hitTest(event.uv);
          if (!hit) return;
          if (hit.kind === "tab") {
            if (hit.page !== pageRef.current) {
              hoverIdRef.current = null;
              repaint(null, hit.page);
            }
            return;
          }
          onLaunch(hit.id as AppId, hit.label);
        }}
      >
        <planeGeometry args={[LAUNCH_PANEL.w, LAUNCH_PANEL.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} fog={false} />
      </mesh>
    </PanelFrame>
  );
}

/**
 * U3: sticky notes preview as canvas texture (no uikit / no offscreen DOM).
 * Tap opens Sticky Board via the same exit-to-2D path as the launcher.
 */
function StickyPreviewScreen({
  onOpen,
  disabled,
}: {
  onOpen: (label: string) => void;
  disabled: boolean;
}) {
  const language = useLanguageStore((state) => state.language);
  const t = useLanguageStore((state) => state.t);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).panelScale);
  const stickyW = scalePanelSize(VR_PANEL_BASE.sticky.w, panelScale);
  const stickyH = scalePanelSize(VR_PANEL_BASE.sticky.h, panelScale);
  const title = t("settingsVrDesktopStickyTitle");
  const empty = t("settingsVrDesktopStickyEmpty");
  const openHint = t("settingsVrDesktopStickyOpen");
  const openLabel = t(appTitleKeys["sticky-board"] as TranslationKey);

  const texture = useMemo(() => {
    const notes = readStickyNotes();
    return createPanelTexture(
      stickyW,
      stickyH,
      (p) => paintStickyPreviewPanel(p, notes, { title, empty, openHint }),
      language,
    );
  }, [empty, language, openHint, stickyH, stickyW, title]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  // Refresh when returning to tab (notes may change in 2D).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const canvas = texture.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paintStickyPreviewPanel(
        { ctx, width: stickyW, height: stickyH, language },
        readStickyNotes(),
        { title, empty, openHint },
      );
      texture.needsUpdate = true;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [empty, language, openHint, stickyH, stickyW, texture, title]);

  const pose = VR_DEFAULT_LAYOUT.sticky;
  return (
    <PanelFrame position={pose.position} rotation={pose.rotation} size={STICKY_PANEL}>
      <mesh
        position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          onOpen(openLabel);
        }}
      >
        <planeGeometry args={[STICKY_PANEL.w, STICKY_PANEL.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} fog={false} />
      </mesh>
    </PanelFrame>
  );
}

/** Shared secondary control mesh (exit / reset layout). */
function SecondaryButton({
  pose,
  label,
  disabled,
  onPress,
  size = [0.72, 0.165] as [number, number],
}: {
  pose: { position: [number, number, number]; rotation: [number, number, number] };
  label: string;
  disabled: boolean;
  onPress: () => void;
  size?: [number, number];
}) {
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).panelScale);
  const texW = scalePanelSize(VR_PANEL_BASE.exit.w, panelScale);
  const texH = scalePanelSize(VR_PANEL_BASE.exit.h, panelScale);
  const texture = useMemo(() => {
    return createPanelTexture(
      texW,
      texH,
      ({ ctx, width, height }) => {
        paintSecondaryButton({ ctx, width, height }, label);
      },
      "en",
    );
  }, [label, texH, texW]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh
      position={pose.position}
      rotation={pose.rotation}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPress();
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} side={THREE.FrontSide} />
    </mesh>
  );
}

/** Slim frame — Basic material (static, no lighting cost). */
function PanelFrame({
  position,
  rotation,
  size,
  children,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  size: { w: number; h: number };
  children: ReactNode;
}) {
  const bezel = vrTheme.panelBezel;
  const depth = vrTheme.panelDepth;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -depth / 2]}>
        <boxGeometry args={[size.w + bezel * 2, size.h + bezel * 2, depth]} />
        <meshBasicMaterial color={vrTheme.frame} fog={false} />
      </mesh>
      {children}
    </group>
  );
}

/** Quiet floor: soft disc + single faint ring. */
function StageFloor() {
  const segments = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).floorSegments);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6.5, segments]} />
        <meshBasicMaterial color={vrTheme.floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[2.8, 2.9, Math.max(16, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={vrTheme.floorRing} transparent opacity={0.35} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Optional soft edge vignette — disabled on low quality even if pref is on. */
function SoftEdges() {
  const soft = useVrDesktopStore((s) => s.prefs.softEdges);
  const allow = useVrDesktopStore((s) => getVrRenderProfile(s.prefs.renderQuality).allowSoftEdges);
  if (!soft || !allow) return null;
  return (
    <group position={[0, 1.45, -1.05]}>
      <mesh position={[0, 0.88, 0]} renderOrder={20}>
        <planeGeometry args={[3.6, 0.48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} fog={false} />
      </mesh>
      <mesh position={[0, -0.88, 0]} renderOrder={20}>
        <planeGeometry args={[3.6, 0.48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

function Stage({
  onExit,
  onLaunch,
  onResetLayout,
  exitLabel,
  resetLabel,
  statusLine,
  busy,
}: {
  onExit: () => void;
  onLaunch: (appId: AppId, label: string) => void;
  onResetLayout: () => void;
  exitLabel: string;
  resetLabel: string;
  statusLine: string | null;
  busy: boolean;
}) {
  return (
    <>
      <color attach="background" args={[vrTheme.stageBg]} />
      <fog attach="fog" args={[vrTheme.fog, 7, 18]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2, 4, 1.5]} intensity={0.85} />
      <StageFloor />
      <HomeScreen statusLine={statusLine} />
      <LauncherScreen onLaunch={onLaunch} disabled={busy} />
      <StickyPreviewScreen
        disabled={busy}
        onOpen={(label) => onLaunch("sticky-board", label)}
      />
      <SecondaryButton
        pose={VR_DEFAULT_LAYOUT.exit}
        label={exitLabel}
        disabled={busy}
        onPress={onExit}
      />
      <SecondaryButton
        pose={VR_DEFAULT_LAYOUT.reset}
        label={resetLabel}
        disabled={busy}
        onPress={onResetLayout}
        size={[0.78, 0.165]}
      />
      <PlayerRig />
      <SessionSync />
    </>
  );
}

/** Renders XR scene after click-time requestSession + openOverlay. */
export function VrDesktopScene() {
  const closeOverlay = useVrDesktopStore((state) => state.closeOverlay);
  const t = useLanguageStore((state) => state.t);
  const openApp = useDesktopStore((state) => state.openApp);
  const sessionLocked = useOsUiStore((state) => state.sessionLocked);
  const renderQuality = useVrDesktopStore((state) => state.prefs.renderQuality);
  const profile = getVrRenderProfile(renderQuality);
  const [hud, setHud] = useState<HudStatus>({ kind: "idle" });
  const [hideExitHud, setHideExitHud] = useState(false);
  const busy = hud.kind !== "idle";
  const actionGenRef = useRef(0);
  const actionTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const statusLine =
    hud.kind === "opening"
      ? t("settingsVrDesktopOpening").replace("{app}", hud.label)
      : hud.kind === "exiting"
        ? t("settingsVrDesktopExiting")
        : null;

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current != null) {
      window.clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    vrSceneMountCount += 1;
    return () => {
      mountedRef.current = false;
      clearActionTimer();
      actionGenRef.current += 1;
      vrSceneMountCount -= 1;
      // Defer so Strict Mode remount can re-increment before we tear down XR.
      window.setTimeout(() => {
        if (vrSceneMountCount === 0 && vrXrStore.getState().session) {
          void endVrDesktopSession();
        }
      }, 0);
    };
  }, [clearActionTimer]);

  // Lock screen / security: leave XR immediately.
  useEffect(() => {
    if (!sessionLocked) return;
    clearActionTimer();
    actionGenRef.current += 1;
    void endVrDesktopSession().finally(() => {
      if (mountedRef.current) closeOverlay();
    });
  }, [clearActionTimer, closeOverlay, sessionLocked]);

  function exitVr() {
    if (busy) return;
    const gen = ++actionGenRef.current;
    setHud({ kind: "exiting" });
    clearActionTimer();
    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null;
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      void endVrDesktopSession().finally(() => {
        if (gen === actionGenRef.current && mountedRef.current) closeOverlay();
      });
    }, 280);
  }

  function launchApp(appId: AppId, label: string) {
    if (busy) return;
    const gen = ++actionGenRef.current;
    setHud({ kind: "opening", label });
    clearActionTimer();
    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null;
      if (gen !== actionGenRef.current || !mountedRef.current) return;
      void endVrDesktopSession().finally(() => {
        if (gen !== actionGenRef.current || !mountedRef.current) return;
        closeOverlay();
        openApp(appId);
      });
    }, 320);
  }

  function resetLayout() {
    if (busy) return;
    useVrDesktopStore.getState().resetLayout();
  }

  return (
    <div className="vr-desktop-overlay" role="dialog" aria-modal="true" aria-label={t("settingsVrDesktop")}>
      <Canvas
        className="vr-desktop-canvas"
        gl={{ antialias: profile.antialias, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.5, 0.35], fov: 70, near: 0.05, far: 28 }}
        dpr={profile.dpr}
        frameloop="always"
      >
        <XR store={vrXrStore}>
          <AttachPendingSession />
          <HeadsetHudGate onHideHud={setHideExitHud} />
          <Stage
            onExit={exitVr}
            onLaunch={launchApp}
            onResetLayout={resetLayout}
            exitLabel={t("settingsVrDesktopExit")}
            resetLabel={t("settingsVrDesktopResetLayout")}
            statusLine={statusLine}
            busy={busy}
          />
        </XR>
      </Canvas>
      {!hideExitHud ? (
        <div className="vr-desktop-hud">
          <button type="button" className="vr-desktop-exit-btn" onClick={exitVr} disabled={busy}>
            {t("settingsVrDesktopExit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
