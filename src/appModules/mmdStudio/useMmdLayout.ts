import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampSideWidth,
  clampTransportHeight,
  MMD_SIDE_WIDTH_DEFAULT,
  MMD_SIDE_WIDTH_MAX,
  MMD_SIDE_WIDTH_MIN,
  MMD_TRANSPORT_HEIGHT_DEFAULT,
  MMD_TRANSPORT_HEIGHT_MAX,
  MMD_TRANSPORT_HEIGHT_MIN,
  readMmdLayoutPrefs,
  writeMmdLayoutPrefs,
  type MmdLayoutPrefs,
} from "./mmdLayoutPrefs";

const DRAG_THRESHOLD_PX = 3;
const KEY_STEP = 8;
const KEY_STEP_LARGE = 24;
const PERSIST_DEBOUNCE_MS = 180;

function sideMaxForWidth(mainWidth: number) {
  return Math.max(MMD_SIDE_WIDTH_MIN, Math.min(MMD_SIDE_WIDTH_MAX, Math.floor(mainWidth * 0.55)));
}

function transportMaxForHeight(rootHeight: number) {
  return Math.max(MMD_TRANSPORT_HEIGHT_MIN, Math.min(MMD_TRANSPORT_HEIGHT_MAX, Math.floor(rootHeight * 0.45)));
}

function migrateTransportHeight(value: number) {
  // Older default (88) and min (64) left the toolbar/track clipped; lift legacy values.
  if (!Number.isFinite(value)) return MMD_TRANSPORT_HEIGHT_DEFAULT;
  if (value < MMD_TRANSPORT_HEIGHT_MIN) return MMD_TRANSPORT_HEIGHT_DEFAULT;
  return clampTransportHeight(value);
}

export function useMmdLayout() {
  const [layoutPrefs, setLayoutPrefs] = useState(() => {
    const prefs = readMmdLayoutPrefs();
    const transportHeight = migrateTransportHeight(prefs.transportHeight);
    const next = { ...prefs, transportHeight };
    // Normalize legacy short transport heights so reload stays consistent.
    if (transportHeight !== prefs.transportHeight) writeMmdLayoutPrefs(next);
    return next;
  });
  const layoutPrefsRef = useRef(layoutPrefs);
  layoutPrefsRef.current = layoutPrefs;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const bodyClassRef = useRef<string | null>(null);

  const schedulePersist = useCallback((prefs: MmdLayoutPrefs) => {
    if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      writeMmdLayoutPrefs(prefs);
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const commitPrefs = useCallback((updater: (current: MmdLayoutPrefs) => MmdLayoutPrefs) => {
    setLayoutPrefs((current) => {
      const next = updater(current);
      if (
        next.sideWidth === current.sideWidth
        && next.sideCollapsed === current.sideCollapsed
        && next.transportHeight === current.transportHeight
      ) {
        return current;
      }
      layoutPrefsRef.current = next;
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const flushPersist = useCallback(() => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    writeMmdLayoutPrefs(layoutPrefsRef.current);
  }, []);

  const clearBodyResizeClass = useCallback(() => {
    if (!bodyClassRef.current) return;
    document.body.classList.remove(bodyClassRef.current);
    bodyClassRef.current = null;
  }, []);

  useEffect(() => () => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      writeMmdLayoutPrefs(layoutPrefsRef.current);
    }
    clearBodyResizeClass();
  }, [clearBodyResizeClass]);

  // Re-clamp when the editor shell is resized (window chrome / immersive / DPR).
  // Bind via callback refs so home→editor remounts re-attach the observer.
  const observerRef = useRef<ResizeObserver | null>(null);

  const ensureObserver = useCallback(() => {
    function reclamp() {
      const mainWidth = mainRef.current?.clientWidth || rootRef.current?.clientWidth || 0;
      const rootHeight = rootRef.current?.clientHeight || 0;
      if (!mainWidth && !rootHeight) return;
      const sideMax = sideMaxForWidth(mainWidth || window.innerWidth);
      const transportMax = transportMaxForHeight(rootHeight || window.innerHeight);
      commitPrefs((current) => {
        const sideWidth = Math.min(current.sideWidth, sideMax);
        const transportHeight = Math.min(current.transportHeight, transportMax);
        if (sideWidth === current.sideWidth && transportHeight === current.transportHeight) return current;
        return { ...current, sideWidth, transportHeight };
      });
    }

    if (!observerRef.current) {
      observerRef.current = new ResizeObserver(() => reclamp());
    }
    const observer = observerRef.current;
    observer.disconnect();
    if (rootRef.current) observer.observe(rootRef.current);
    if (mainRef.current) observer.observe(mainRef.current);
    reclamp();
  }, [commitPrefs]);

  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    ensureObserver();
  }, [ensureObserver]);

  const setMainRef = useCallback((node: HTMLDivElement | null) => {
    mainRef.current = node;
    ensureObserver();
  }, [ensureObserver]);

  useEffect(() => () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const beginSideResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || layoutPrefsRef.current.sideCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = layoutPrefsRef.current.sideWidth;
    const mainWidth = mainRef.current?.clientWidth ?? event.currentTarget.parentElement?.clientWidth ?? window.innerWidth;
    const dynamicMax = sideMaxForWidth(mainWidth);
    const target = event.currentTarget;
    let dragged = false;
    target.setPointerCapture(event.pointerId);
    bodyClassRef.current = "mmd-resizing-side";
    document.body.classList.add("mmd-resizing-side");

    function onMove(moveEvent: PointerEvent) {
      const delta = startX - moveEvent.clientX;
      if (!dragged && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      dragged = true;
      const next = Math.min(dynamicMax, clampSideWidth(startWidth + delta));
      commitPrefs((current) => (
        current.sideWidth === next && !current.sideCollapsed
          ? current
          : { ...current, sideWidth: next, sideCollapsed: false }
      ));
    }

    function onUp(upEvent: PointerEvent) {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // already released
      }
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      clearBodyResizeClass();
      if (dragged) flushPersist();
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }, [clearBodyResizeClass, commitPrefs, flushPersist]);

  const beginTransportResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = layoutPrefsRef.current.transportHeight;
    const rootHeight = rootRef.current?.clientHeight ?? event.currentTarget.parentElement?.clientHeight ?? window.innerHeight;
    const dynamicMax = transportMaxForHeight(rootHeight);
    const target = event.currentTarget;
    let dragged = false;
    target.setPointerCapture(event.pointerId);
    bodyClassRef.current = "mmd-resizing-transport";
    document.body.classList.add("mmd-resizing-transport");

    function onMove(moveEvent: PointerEvent) {
      const delta = startY - moveEvent.clientY;
      if (!dragged && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      dragged = true;
      const next = Math.min(dynamicMax, clampTransportHeight(startHeight + delta));
      commitPrefs((current) => (current.transportHeight === next ? current : { ...current, transportHeight: next }));
    }

    function onUp(upEvent: PointerEvent) {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // already released
      }
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      clearBodyResizeClass();
      if (dragged) flushPersist();
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }, [clearBodyResizeClass, commitPrefs, flushPersist]);

  const onSideKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (layoutPrefsRef.current.sideCollapsed) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let delta = 0;
    if (event.key === "ArrowLeft") delta = step;
    else if (event.key === "ArrowRight") delta = -step;
    else if (event.key === "Home") {
      event.preventDefault();
      commitPrefs((current) => ({ ...current, sideWidth: MMD_SIDE_WIDTH_MIN, sideCollapsed: false }));
      flushPersist();
      return;
    } else if (event.key === "End") {
      event.preventDefault();
      const mainWidth = mainRef.current?.clientWidth ?? window.innerWidth;
      commitPrefs((current) => ({
        ...current,
        sideWidth: sideMaxForWidth(mainWidth),
        sideCollapsed: false,
      }));
      flushPersist();
      return;
    } else {
      return;
    }
    event.preventDefault();
    const mainWidth = mainRef.current?.clientWidth ?? window.innerWidth;
    const dynamicMax = sideMaxForWidth(mainWidth);
    commitPrefs((current) => {
      const next = Math.min(dynamicMax, clampSideWidth(current.sideWidth + delta));
      return current.sideWidth === next ? current : { ...current, sideWidth: next, sideCollapsed: false };
    });
    flushPersist();
  }, [commitPrefs, flushPersist]);

  const onTransportKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let delta = 0;
    if (event.key === "ArrowUp") delta = step;
    else if (event.key === "ArrowDown") delta = -step;
    else if (event.key === "Home") {
      event.preventDefault();
      commitPrefs((current) => ({ ...current, transportHeight: MMD_TRANSPORT_HEIGHT_MIN }));
      flushPersist();
      return;
    } else if (event.key === "End") {
      event.preventDefault();
      const rootHeight = rootRef.current?.clientHeight ?? window.innerHeight;
      commitPrefs((current) => ({
        ...current,
        transportHeight: transportMaxForHeight(rootHeight),
      }));
      flushPersist();
      return;
    } else {
      return;
    }
    event.preventDefault();
    const rootHeight = rootRef.current?.clientHeight ?? window.innerHeight;
    const dynamicMax = transportMaxForHeight(rootHeight);
    commitPrefs((current) => {
      const next = Math.min(dynamicMax, clampTransportHeight(current.transportHeight + delta));
      return current.transportHeight === next ? current : { ...current, transportHeight: next };
    });
    flushPersist();
  }, [commitPrefs, flushPersist]);

  const resetSideWidth = useCallback(() => {
    commitPrefs((current) => ({
      ...current,
      sideWidth: MMD_SIDE_WIDTH_DEFAULT,
      sideCollapsed: false,
    }));
    flushPersist();
  }, [commitPrefs, flushPersist]);

  const resetTransportHeight = useCallback(() => {
    commitPrefs((current) => ({
      ...current,
      transportHeight: MMD_TRANSPORT_HEIGHT_DEFAULT,
    }));
    flushPersist();
  }, [commitPrefs, flushPersist]);

  const setSideCollapsed = useCallback((sideCollapsed: boolean) => {
    commitPrefs((current) => (current.sideCollapsed === sideCollapsed ? current : { ...current, sideCollapsed }));
    flushPersist();
  }, [commitPrefs, flushPersist]);

  return {
    layoutPrefs,
    rootRef: setRootRef,
    mainRef: setMainRef,
    beginSideResize,
    beginTransportResize,
    onSideKeyDown,
    onTransportKeyDown,
    resetSideWidth,
    resetTransportHeight,
    setSideCollapsed,
  };
}
