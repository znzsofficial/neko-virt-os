import { Canvas } from "@react-three/fiber";
import { XR } from "@react-three/xr";
import { useRef, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import { createXrSceneMountGuard } from "../xr";
import {
  AttachPendingMmdVrSession,
  MmdVrHeadsetHudGate,
  MmdVrSessionSync,
} from "./components/MmdVrSessionBridge";
import { MmdVrPlayerRig } from "./components/MmdVrPlayerRig";
import { MmdVrStageContent } from "./components/MmdVrStage";
import { endMmdVrSession, mmdVrXrStore, peekPendingMmdVrSession } from "./mmdVrSession";
import { getMmdVrRenderProfile } from "./mmdVrQuality";
import { useMmdVrStore } from "./mmdVrStore";

const { useXrSceneLifecycle } = createXrSceneMountGuard();

export function MmdVrScene() {
  const closeOverlay = useMmdVrStore((state) => state.closeOverlay);
  const t = useLanguageStore((state) => state.t);
  const sessionLocked = useOsUiStore((state) => state.sessionLocked);
  const mmdPrefs = useMmdVrStore((state) => state.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const [exiting, setExiting] = useState(false);
  const [hideExitHud, setHideExitHud] = useState(false);
  const exitGenRef = useRef(0);

  const { mountedRef } = useXrSceneLifecycle({
    isOverlayOpen: () => useMmdVrStore.getState().overlayOpen,
    shouldEndSession: () => Boolean(mmdVrXrStore.getState().session || peekPendingMmdVrSession()),
    endSession: endMmdVrSession,
    sessionLocked,
    closeOverlay,
    onCleanup: () => {
      exitGenRef.current += 1;
    },
  });

  function exitVr() {
    if (exiting) return;
    const gen = ++exitGenRef.current;
    setExiting(true);
    window.setTimeout(() => {
      if (gen !== exitGenRef.current || !mountedRef.current) return;
      void endMmdVrSession().finally(() => {
        if (gen === exitGenRef.current && mountedRef.current) closeOverlay();
      });
    }, 200);
  }

  return (
    <div
      className="vr-desktop-overlay mmd-vr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("settingsMmdVrShowcase")}
    >
      <Canvas
        className="vr-desktop-canvas"
        gl={{
          antialias: profile.antialias,
          powerPreference: "high-performance",
        }}
        shadows={profile.shadows}
        camera={{ position: [0, 1.5, 2.8], fov: 70, near: 0.05, far: mmdPrefs.viewDistance }}
        dpr={profile.dpr}
        frameloop="always"
      >
        <XR store={mmdVrXrStore}>
          <AttachPendingMmdVrSession />
          <MmdVrHeadsetHudGate onHideHud={setHideExitHud} />
          <MmdVrPlayerRig
            playLabel={t("settingsMmdVrPlay")}
            pauseLabel={t("settingsMmdVrPause")}
            loopOnLabel={t("settingsMmdVrLoopOn")}
            loopOffLabel={t("settingsMmdVrLoopOff")}
            resetLabel={t("settingsMmdVrResetView")}
            exitLabel={t("settingsVrDesktopExit")}
            emptyHint={t("settingsMmdVrEmptyNoAssets")}
            hideLabel={t("settingsMmdVrHideModel")}
            showLabel={t("settingsMmdVrShowModel")}
            placeOnLabel={t("settingsMmdVrPlaceOn")}
            placeOffLabel={t("settingsMmdVrPlaceOff")}
            placeHint={t("settingsMmdVrPlaceHint")}
            lightStageLabel={t("settingsMmdVrLightStage")}
            lightSoftLabel={t("settingsMmdVrLightSoft")}
            lightContrastLabel={t("settingsMmdVrLightContrast")}
            lightDaylightLabel={t("settingsMmdVrLightDaylight")}
            lightWarmLabel={t("settingsMmdVrLightWarm")}
            lightRimLabel={t("settingsMmdVrLightRim")}
            shadowsLabel={t("settingsMmdVrShadows")}
            gridLabel={t("settingsMmdVrGrid")}
            scaleLabel={t("settingsMmdVrModelScale")}
            rotateLeftLabel={t("settingsMmdVrRotateLeft")}
            rotateRightLabel={t("settingsMmdVrRotateRight")}
            heightLabel={t("settingsMmdVrUserHeight")}
            viewDistanceLabel={t("settingsMmdVrViewDistance")}
            resetValueLabel={t("settingsMmdVrValueReset")}
            panelHideLabel={t("settingsMmdVrPanelHide")}
            panelShowLabel={t("settingsMmdVrPanelShow")}
            panelDragLabel={t("settingsMmdVrPanelDrag")}
            fpsOnLabel={t("settingsMmdVrFpsOn")}
            fpsOffLabel={t("settingsMmdVrFpsOff")}
            physicsOnLabel={t("settingsMmdVrPhysicsOn")}
            physicsOffLabel={t("settingsMmdVrPhysicsOff")}
            physicsDebugOnLabel={t("settingsMmdVrPhysicsDebugOn")}
            physicsDebugOffLabel={t("settingsMmdVrPhysicsDebugOff")}
            physicsSettingsLabel={t("settingsMmdVrPhysicsSettings")}
            physicsCollisionOnLabel={t("settingsMmdVrPhysicsCollisionOn")}
            physicsCollisionOffLabel={t("settingsMmdVrPhysicsCollisionOff")}
            physicsRadiusLabel={t("settingsMmdVrPhysicsRadius")}
            physicsQualityLabels={[
              t("settingsMmdVrPhysicsQualityLow"),
              t("settingsMmdVrPhysicsQualityMedium"),
              t("settingsMmdVrPhysicsQualityHigh"),
            ]}
            physicsHapticLevelLabels={[
              t("settingsMmdVrPhysicsHapticsOff"),
              t("settingsMmdVrPhysicsHapticsLow"),
              t("settingsMmdVrPhysicsHapticsNormal"),
            ]}
            resetPhysicsLabel={t("settingsMmdVrPhysicsReset")}
            snapTurnLabel={t("settingsMmdVrSnapTurn")}
            exposureLabel={t("settingsMmdVrExposure")}
            removeLabel={t("settingsMmdVrRemoveModel")}
            themeLabels={[
              t("settingsMmdVrThemeBlue"),
              t("settingsMmdVrThemeCyan"),
              t("settingsMmdVrThemePurple"),
              t("settingsMmdVrThemeGreen"),
              t("settingsMmdVrThemeRed"),
            ]}
            walkLabels={[
              t("settingsMmdVrWalkSlow"),
              t("settingsMmdVrWalkNormal"),
              t("settingsMmdVrWalkFast"),
            ]}
            walkSpeedLabel={t("settingsMmdVrWalkSpeed")}
            onExit={exitVr}
            busy={exiting}
          />
          <MmdVrStageContent />
          <MmdVrSessionSync />
        </XR>
      </Canvas>
      {!hideExitHud ? (
        <div className="vr-desktop-hud">
          <button type="button" className="vr-desktop-exit-btn" onClick={exitVr} disabled={exiting}>
            {t("settingsVrDesktopExit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
