import { useEffect, useRef } from "react";
import { useOsUiStore } from "../osUiStore";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "mousemove",
];

export function useIdleLock() {
  const autoLockMinutes = useOsUiStore((state) => state.systemPrefs.autoLockMinutes);
  const sessionLocked = useOsUiStore((state) => state.sessionLocked);
  const lockSession = useOsUiStore((state) => state.lockSession);
  const lastActiveRef = useRef(Date.now());

  useEffect(() => {
    lastActiveRef.current = Date.now();
    if (!autoLockMinutes || sessionLocked) return;

    let moveThrottle = 0;
    const onActivity = (event: Event) => {
      if (event.type === "mousemove") {
        const now = Date.now();
        if (now - moveThrottle < 1000) return;
        moveThrottle = now;
      }
      lastActiveRef.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (useOsUiStore.getState().sessionLocked) return;
      const minutes = useOsUiStore.getState().systemPrefs.autoLockMinutes;
      if (!minutes) return;
      if (Date.now() - lastActiveRef.current >= minutes * 60_000) {
        lockSession();
      }
    }, 10_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.clearInterval(timer);
    };
  }, [autoLockMinutes, lockSession, sessionLocked]);
}
