import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState, XRSpace } from "@react-three/xr";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  clearMmdVrControllerColliders,
  setMmdVrControllerColliderMatrix,
} from "../mmdVrControllerColliders";
import { useMmdVrStore } from "../mmdVrStore";

function ControllerCollider({ handedness, index }: { handedness: "left" | "right"; index: 0 | 1 }) {
  const controller = useXRInputSourceState("controller", handedness);
  const physicsEnabled = useMmdVrStore((state) => state.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((state) => state.physicsDebugEnabled);
  const colliderRadius = useMmdVrStore((state) => state.physicsColliderRadius);
  const hapticsEnabled = useMmdVrStore((state) => state.physicsHapticsEnabled);
  const contactCount = useMmdVrStore((state) => state.physicsControllerContactCounts[index]);
  const ref = useRef<THREE.Object3D>(null);
  const contactActiveRef = useRef(false);

  useFrame(() => {
    const object = ref.current;
    const tracked = object as (THREE.Object3D & { transformReady?: boolean }) | null;
    if (!tracked?.visible || tracked.transformReady === false) {
      setMmdVrControllerColliderMatrix(index, null);
      return;
    }
    tracked.updateWorldMatrix(true, false);
    setMmdVrControllerColliderMatrix(index, tracked.matrixWorld);
  });

  useEffect(() => {
    const contactActive = physicsEnabled && hapticsEnabled && contactCount > 0;
    if (contactActive && !contactActiveRef.current) {
      const gamepad = controller?.inputSource.gamepad as (Gamepad & {
        hapticActuators?: readonly { pulse: (intensity: number, duration: number) => Promise<boolean> }[];
      }) | undefined;
      const actuator = gamepad?.hapticActuators?.[0];
      if (actuator) void actuator.pulse(0.28, 36).catch(() => undefined);
      else void gamepad?.vibrationActuator?.playEffect("dual-rumble", {
        duration: 36,
        strongMagnitude: 0.28,
        weakMagnitude: 0.18,
      }).catch(() => undefined);
    }
    contactActiveRef.current = contactActive;
  }, [contactCount, controller, hapticsEnabled, physicsEnabled]);

  useEffect(() => () => setMmdVrControllerColliderMatrix(index, null), [index]);
  if (!controller?.inputSource.gripSpace) return null;
  return (
    <XRSpace ref={ref} space={controller.inputSource.gripSpace}>
      {physicsEnabled && physicsDebugEnabled ? (
        <mesh raycast={() => null}>
          <sphereGeometry args={[colliderRadius, 16, 12]} />
          <meshBasicMaterial color={contactCount > 0 ? "#7dff72" : index === 0 ? "#45d7ff" : "#ff5ca8"} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      ) : null}
    </XRSpace>
  );
}

export function MmdVrControllerColliders() {
  useEffect(() => () => clearMmdVrControllerColliders(), []);
  return (
    <>
      <ControllerCollider handedness="left" index={0} />
      <ControllerCollider handedness="right" index={1} />
    </>
  );
}
