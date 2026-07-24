import { useXRControllerLocomotion, XROrigin } from "@react-three/xr";
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore } from "../mmdVrStore";
import { MmdVrControlBar } from "./MmdVrHud";

/**
 * Smooth walk + snap turn. viewEpoch zeros origin (reset view).
 */
export function MmdVrPlayerRig({
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
  const originRef = useRef<THREE.Group>(null);
  const viewEpoch = useMmdVrStore((s) => s.viewEpoch);
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const speed = getMmdVrRenderProfile(mmdPrefs).walkSpeed;

  useXRControllerLocomotion(
    originRef,
    { speed },
    { type: "snap", degrees: 30, deadZone: 0.65 },
  );

  useEffect(() => {
    const g = originRef.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
  }, [viewEpoch]);

  return (
    <XROrigin ref={originRef}>
      <MmdVrControlBar
        playLabel={playLabel}
        pauseLabel={pauseLabel}
        loopOnLabel={loopOnLabel}
        loopOffLabel={loopOffLabel}
        resetLabel={resetLabel}
        exitLabel={exitLabel}
        emptyHint={emptyHint}
        hideLabel={hideLabel}
        showLabel={showLabel}
        lightStageLabel={lightStageLabel}
        lightSoftLabel={lightSoftLabel}
        lightContrastLabel={lightContrastLabel}
        onExit={onExit}
        busy={busy}
      />
    </XROrigin>
  );
}
