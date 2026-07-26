import { useXRControllerLocomotion, XROrigin } from "@react-three/xr";
import { useEffect, useRef, useState } from "react";
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
  onExit: () => void;
  busy: boolean;
}) {
  const originRef = useRef<THREE.Group>(null);
  const viewEpoch = useMmdVrStore((s) => s.viewEpoch);
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const speed = getMmdVrRenderProfile(mmdPrefs).walkSpeed;
  const heightOffset = mmdPrefs.heightOffset;
  const [panelDragging, setPanelDragging] = useState(false);

  useXRControllerLocomotion(
    originRef,
    { speed: panelDragging ? 0 : speed },
    { type: "snap", degrees: 30, deadZone: 0.65 },
  );

  useEffect(() => {
    const g = originRef.current;
    if (!g) return;
    g.position.set(0, heightOffset, 0);
    g.rotation.set(0, 0, 0);
  }, [viewEpoch]);

  useEffect(() => {
    const g = originRef.current;
    if (g) g.position.y = heightOffset;
  }, [heightOffset]);

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
        placeOnLabel={placeOnLabel}
        placeOffLabel={placeOffLabel}
        placeHint={placeHint}
        lightStageLabel={lightStageLabel}
        lightSoftLabel={lightSoftLabel}
        lightContrastLabel={lightContrastLabel}
        shadowsLabel={shadowsLabel}
        gridLabel={gridLabel}
        scaleLabel={scaleLabel}
        heightLabel={heightLabel}
        resetValueLabel={resetValueLabel}
        panelHideLabel={panelHideLabel}
        panelShowLabel={panelShowLabel}
        panelDragLabel={panelDragLabel}
        onDragChange={setPanelDragging}
        onExit={onExit}
        busy={busy}
      />
    </XROrigin>
  );
}
