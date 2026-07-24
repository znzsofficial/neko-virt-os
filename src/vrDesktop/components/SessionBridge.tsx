import { useCallback } from "react";
import type { WebGLRenderer } from "three";
import { AttachPendingXrSession, HeadsetHudGate, XrSessionSync } from "../../xr";
import {
  attachPendingSessionToRenderer,
  endVrDesktopSession,
  peekPendingVrSession,
} from "../vrSession";
import { useVrDesktopStore } from "../vrDesktopStore";

export function AttachPendingSession() {
  const setPhase = useVrDesktopStore((s) => s.setPhase);
  const failEnter = useVrDesktopStore((s) => s.failEnter);

  const attach = useCallback(
    (gl: WebGLRenderer) =>
      attachPendingSessionToRenderer(gl, useVrDesktopStore.getState().prefs),
    [],
  );
  const peekPending = useCallback(() => peekPendingVrSession(), []);
  const isOverlayOpen = useCallback(() => useVrDesktopStore.getState().overlayOpen, []);
  const onActive = useCallback(() => setPhase("active"), [setPhase]);
  const onFail = useCallback((detail: string) => failEnter(detail), [failEnter]);
  const endSession = useCallback(() => {
    void endVrDesktopSession();
  }, []);

  return (
    <AttachPendingXrSession
      attach={attach}
      peekPending={peekPending}
      isOverlayOpen={isOverlayOpen}
      onActive={onActive}
      onFail={onFail}
      endSession={endSession}
      logTag="vrDesktop"
    />
  );
}

export function SessionSync() {
  const setPhase = useVrDesktopStore((state) => state.setPhase);
  const closeOverlay = useVrDesktopStore((state) => state.closeOverlay);
  const onActive = useCallback(() => setPhase("active"), [setPhase]);
  const onSessionEnd = useCallback(() => closeOverlay(), [closeOverlay]);
  return <XrSessionSync onActive={onActive} onSessionEnd={onSessionEnd} />;
}

export { HeadsetHudGate };
