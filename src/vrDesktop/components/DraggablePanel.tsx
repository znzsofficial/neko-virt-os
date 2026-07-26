import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import {
  clampPanelPosition,
  type VrMovablePanelId,
  type VrPanelSize,
} from "../vrLayout";
import { useVrLayoutStore } from "../vrLayoutStore";
import { vrTheme } from "../vrTheme";

const DRAG_THRESHOLD = 0.025;

type DragState = {
  pointerId: number;
  /** panel.position - hitPoint at grab (world) */
  offset: THREE.Vector3;
  startHit: THREE.Vector3;
  moved: boolean;
  plane: THREE.Plane;
};

/**
 * Ray-draggable panel shell. Drag the bezel/frame; content mesh handles clicks.
 * Click vs drag: movement under DRAG_THRESHOLD keeps child click handlers usable
 * when the same mesh is used (launchers use separate content mesh).
 */
export function DraggablePanel({
  panelId,
  size,
  disabled,
  children,
}: {
  panelId: VrMovablePanelId;
  size: VrPanelSize;
  disabled?: boolean;
  children: ReactNode;
}) {
  const pose = useVrLayoutStore((s) => s.poses[panelId]);
  const setPosition = useVrLayoutStore((s) => s.setPosition);
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const tmp = useRef({
    hit: new THREE.Vector3(),
    next: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    plane: new THREE.Plane(),
  }).current;

  function beginDrag(e: ThreeEvent<PointerEvent>) {
    if (disabled) return;
    e.stopPropagation();
    const group = groupRef.current;
    if (!group) return;

    // Plane through panel, facing its local +Z (panel normal).
    group.getWorldDirection(tmp.normal);
    // Plane faces the user: normal points roughly toward origin from panel
    tmp.plane.setFromNormalAndCoplanarPoint(tmp.normal, e.point);

    dragRef.current = {
      pointerId: e.pointerId,
      offset: group.position.clone().sub(e.point),
      startHit: e.point.clone(),
      moved: false,
      plane: tmp.plane.clone(),
    };
    setDragging(true);

    try {
      (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
        e.pointerId,
      );
    } catch {
      // ignore
    }
  }

  function moveDrag(e: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    const group = groupRef.current;
    if (!drag || !group || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (disabled) {
      finishDrag(e.pointerId);
      return;
    }

    // Prefer plane intersection so drag continues off the mesh edges.
    const hit = tmp.hit;
    if (!e.ray.intersectPlane(drag.plane, hit)) {
      hit.copy(e.point);
    }

    if (!drag.moved && hit.distanceTo(drag.startHit) >= DRAG_THRESHOLD) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    tmp.next.copy(hit).add(drag.offset);
    const clamped = clampPanelPosition([tmp.next.x, tmp.next.y, tmp.next.z]);
    group.position.set(clamped[0], clamped[1], clamped[2]);
  }

  function finishDrag(pointerId?: number) {
    const drag = dragRef.current;
    const group = groupRef.current;
    if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return;
    dragRef.current = null;
    setDragging(false);

    if (drag.moved && group) {
      setPosition(panelId, [group.position.x, group.position.y, group.position.z]);
    }
  }

  function endDrag(e: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    finishDrag(e.pointerId);

    try {
      (e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
        e.pointerId,
      );
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (disabled) finishDrag();
  }, [disabled]);

  useEffect(() => () => finishDrag(), []);

  const bezel = vrTheme.panelBezel;
  const depth = vrTheme.panelDepth;

  return (
    <group
      ref={groupRef}
      position={pose.position}
      rotation={pose.rotation}
    >
      {/* Drag handle = frame bezel (behind content) */}
      <mesh
        position={[0, 0, -depth / 2]}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          if (!dragRef.current) setHovered(false);
        }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <boxGeometry args={[size.w + bezel * 2, size.h + bezel * 2, depth]} />
        <meshBasicMaterial color={hovered ? vrTheme.borderStrong : vrTheme.frame} fog={false} />
      </mesh>

      {/* Top drag strip on the face (easier to grab without missing bezel) */}
      <mesh
        position={[0, size.h / 2 - 0.04, depth / 2 + 0.002]}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          if (!dragRef.current) setHovered(false);
        }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <planeGeometry args={[size.w + bezel * 1.2, 0.08]} />
        <meshBasicMaterial color={dragging ? vrTheme.primary : hovered ? vrTheme.borderStrong : vrTheme.frameEdge} transparent opacity={dragging ? 0.95 : hovered ? 0.8 : 0.55} fog={false} depthWrite={false} />
      </mesh>

      {children}
    </group>
  );
}
