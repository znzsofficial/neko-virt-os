import { useFrame } from "@react-three/fiber";
import { useXRControllerLocomotion, XROrigin } from "@react-three/xr";
import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { SoftEdges } from "./PanelPrimitives";
import { createPanelTexture, paintFpsBadge } from "../vrPanelTexture";
import { useVrDesktopStore } from "../vrDesktopStore";

/**
 * Snap-turn via XROrigin. layoutEpoch zeros origin yaw/position (layout reset).
 */
export function PlayerRig() {
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

function FpsHud() {
  const show = useVrDesktopStore((s) => s.prefs.showFps);
  const texture = useMemo(() => createPanelTexture(160, 64, (p) => paintFpsBadge(p, 0), "en"), []);
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
