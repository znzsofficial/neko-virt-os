import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { VrPanelPose } from "../vrLayout";
import { createPanelTexture, paintSecondaryButton } from "../vrPanelTexture";
import { getVrRenderProfile, scalePanelSize, VR_PANEL_BASE } from "../vrQuality";
import { useVrDesktopStore } from "../vrDesktopStore";
import { vrTheme } from "../vrTheme";

/** Slim frame — Basic material (static, no lighting cost). */
export function PanelFrame({
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

export function TexturedPlane({
  size,
  texture,
  transparent = false,
}: {
  size: { w: number; h: number };
  texture: THREE.Texture;
  transparent?: boolean;
}) {
  return (
    <mesh position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}>
      <planeGeometry args={[size.w, size.h]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        side={THREE.FrontSide}
        fog={false}
        transparent={transparent}
      />
    </mesh>
  );
}

/** Quiet secondary control (exit / reset layout). */
export function SecondaryButton({
  pose,
  label,
  disabled,
  onPress,
  size = [0.72, 0.165] as [number, number],
}: {
  pose: VrPanelPose;
  label: string;
  disabled: boolean;
  onPress: () => void;
  size?: [number, number];
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs).panelScale);
  const texW = scalePanelSize(VR_PANEL_BASE.exit.w, panelScale);
  const texH = scalePanelSize(VR_PANEL_BASE.exit.h, panelScale);
  const texture = useMemo(
    () =>
      createPanelTexture(
        texW,
        texH,
        ({ ctx, width, height }) => paintSecondaryButton({ ctx, width, height }, label),
        "en",
      ),
    [label, texH, texW],
  );

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
      scale={pressed ? 0.97 : hovered && !disabled ? 1.035 : 1}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (!disabled) setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!disabled) setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPress();
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        color={disabled ? "#777077" : hovered ? "#ffffff" : "#eee8eb"}
        toneMapped={false}
        transparent
        opacity={disabled ? 0.48 : 1}
        fog={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export function StageFloor() {
  const segments = useVrDesktopStore((s) => getVrRenderProfile(s.prefs).floorSegments);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6.5, segments]} />
        <meshBasicMaterial color={vrTheme.floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[2.75, 2.79, Math.max(24, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={vrTheme.floorRing} transparent opacity={0.72} side={THREE.FrontSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -1.9]}>
        <ringGeometry args={[0.32, 0.335, 32]} />
        <meshBasicMaterial color={vrTheme.primary} transparent opacity={0.48} side={THREE.FrontSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0035, -1.32]}>
        <planeGeometry args={[0.022, 0.72]} />
        <meshBasicMaterial color={vrTheme.floorGuide} transparent opacity={0.68} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Optional soft edge vignette — disabled on low quality even if pref is on. */
export function SoftEdges() {
  const soft = useVrDesktopStore((s) => s.prefs.softEdges);
  const allow = useVrDesktopStore((s) => getVrRenderProfile(s.prefs).allowSoftEdges);
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
