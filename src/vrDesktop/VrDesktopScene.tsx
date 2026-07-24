import { Canvas } from "@react-three/fiber";
import { XR } from "@react-three/xr";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import type { AppId } from "../types";
import { createXrSceneMountGuard } from "../xr";
import { HomeScreen } from "./components/HomeScreen";
import { LauncherScreen } from "./components/LauncherScreen";
import { SecondaryButton, StageFloor } from "./components/PanelPrimitives";
import { vrTheme } from "./vrTheme";
import { PlayerRig } from "./components/PlayerRig";
import { AttachPendingSession, HeadsetHudGate, SessionSync } from "./components/SessionBridge";
import { StickyPreviewScreen } from "./components/StickyPreviewScreen";
import { isVrNativeApp } from "./vrLauncher";
import { VR_DEFAULT_LAYOUT, VR_PANEL_SIZE } from "./vrLayout";
import { VrBrowserPanel } from "./VrBrowserPanel";
import { endVrDesktopSession, peekPendingVrSession, vrXrStore } from "./vrSession";
import { useVrDesktopStore } from "./vrDesktopStore";
import { getVrRenderProfile } from "./vrQuality";

const { useXrSceneLifecycle } = createXrSceneMountGuard();

type HudStatus = { kind: "idle" } | { kind: "status"; label: string } | { kind: "exiting" };

function Stage({
  onExit,
  onLaunch,
  onResetLayout,
  exitLabel,
  resetLabel,
  statusLine,
  busy,
  browserOpen,
  onCloseBrowser,
}: {
  onExit: () => void;
  onLaunch: (appId: AppId, label: string) => void;
  onResetLayout: () => void;
  exitLabel: string;
  resetLabel: string;
  statusLine: string | null;
  busy: boolean;
  browserOpen: boolean;
  onCloseBrowser: () => void;
}) {
  return (
    <>
      <color attach="background" args={[vrTheme.stageBg]} />
      <fog attach="fog" args={[vrTheme.fog, 7, 18]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2, 4, 1.5]} intensity={0.85} />
      <StageFloor />
      <HomeScreen statusLine={statusLine} />
      <LauncherScreen onLaunch={onLaunch} disabled={busy || browserOpen} />
      <StickyPreviewScreen />
      <VrBrowserPanel open={browserOpen} onClose={onCloseBrowser} disabled={busy} />
      <SecondaryButton
        pose={VR_DEFAULT_LAYOUT.exit}
        label={exitLabel}
        disabled={busy}
        onPress={onExit}
        size={VR_PANEL_SIZE.secondaryBtn}
      />
      <SecondaryButton
        pose={VR_DEFAULT_LAYOUT.reset}
        label={resetLabel}
        disabled={busy}
        onPress={onResetLayout}
        size={VR_PANEL_SIZE.resetBtn}
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
  const sessionLocked = useOsUiStore((state) => state.sessionLocked);
  const vrPrefs = useVrDesktopStore((state) => state.prefs);
  const profile = getVrRenderProfile(vrPrefs);
  const [hud, setHud] = useState<HudStatus>({ kind: "idle" });
  const [hideExitHud, setHideExitHud] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const busy = hud.kind === "exiting";
  const actionGenRef = useRef(0);
  const actionTimerRef = useRef<number | null>(null);
  const statusClearRef = useRef<number | null>(null);

  const statusLine =
    hud.kind === "status"
      ? hud.label
      : hud.kind === "exiting"
        ? t("settingsVrDesktopExiting")
        : browserOpen
          ? t("settingsVrDesktopBrowserOpen")
          : null;

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current != null) {
      window.clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
    if (statusClearRef.current != null) {
      window.clearTimeout(statusClearRef.current);
      statusClearRef.current = null;
    }
  }, []);

  const { mountedRef } = useXrSceneLifecycle({
    isOverlayOpen: () => useVrDesktopStore.getState().overlayOpen,
    shouldEndSession: () => Boolean(vrXrStore.getState().session || peekPendingVrSession()),
    endSession: endVrDesktopSession,
    sessionLocked,
    closeOverlay,
    onCleanup: () => {
      clearActionTimer();
      actionGenRef.current += 1;
    },
  });

  function flashStatus(message: string) {
    setHud({ kind: "status", label: message });
    if (statusClearRef.current != null) window.clearTimeout(statusClearRef.current);
    statusClearRef.current = window.setTimeout(() => {
      statusClearRef.current = null;
      if (mountedRef.current) setHud({ kind: "idle" });
    }, 2200);
  }

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

  /** VR-only launch: never openApp, never end XR. Exit is the only way back to 2D. */
  function launchApp(appId: AppId, label: string) {
    if (busy) return;

    if (appId === "browser") {
      setBrowserOpen(true);
      setHud({ kind: "idle" });
      return;
    }

    if (appId === "sticky-board") {
      flashStatus(t("settingsVrDesktopInVrOnly").replace("{app}", label));
      return;
    }

    if (!isVrNativeApp(appId)) {
      flashStatus(t("settingsVrDesktopUnavailableInVr").replace("{app}", label));
    }
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
            browserOpen={browserOpen}
            onCloseBrowser={() => setBrowserOpen(false)}
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
