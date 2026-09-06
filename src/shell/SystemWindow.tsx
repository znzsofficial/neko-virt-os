import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { memo, Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Rnd } from "react-rnd";
import { appComponentRegistry } from "../appRegistry";
import { getAppIcon } from "../appText";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import type { WindowState } from "../types";
import { SNAP_THRESHOLD, getWindowTitle, snapWindowBounds, useDesktopStore } from "../windowStore";
import { requestCloseWindow } from "./windowLifecycle";

function getImmersiveBounds(): { x: number; y: number; width: number; height: number } {
  return {
    x: 0,
    y: 0,
    width: Math.max(320, globalThis.window.innerWidth),
    height: Math.max(240, globalThis.window.innerHeight),
  };
}

export const SystemWindow = memo(function SystemWindow({ window }: { window: WindowState }) {
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const snapWindow = useDesktopStore((state) => state.snapWindow);
  const updateWindow = useDesktopStore((state) => state.updateWindow);
  const immersiveWindowId = useOsUiStore((state) => state.immersiveWindowId);
  const toggleImmersive = useOsUiStore((state) => state.toggleImmersive);
  const isImmersive = immersiveWindowId === window.id;
  const isActive = activeWindowId === window.id;
  const windowIcon = getAppIcon(window.appId, window.icon);
  const t = useLanguageStore((state) => state.t);
  const windowTitle = getWindowTitle(window, t);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [liveBounds, setLiveBounds] = useState(() => ({ x: window.x, y: window.y, width: window.width, height: window.height }));
  const titlebarRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const canFullscreen = window.appId === "mmd-studio";

  useEffect(() => {
    if (isImmersive) {
      setLiveBounds(getImmersiveBounds());
      return;
    }
    setLiveBounds({ x: window.x, y: window.y, width: window.width, height: window.height });
  }, [isImmersive, window.x, window.y, window.width, window.height]);

  useEffect(() => {
    if (!isImmersive) return;
    function onResize() {
      setLiveBounds(getImmersiveBounds());
    }
    globalThis.window.addEventListener("resize", onResize);
    return () => globalThis.window.removeEventListener("resize", onResize);
  }, [isImmersive]);

  useEffect(() => {
    if (!isActive || window.minimized || isImmersive) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && frameRef.current?.contains(active)) return;
    titlebarRef.current?.focus({ preventScroll: true });
  }, [isActive, isImmersive, window.minimized]);

  useEffect(() => {
    if (isActive) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && frameRef.current?.contains(active)) active.blur();
  }, [isActive]);

  function requestMinimize() {
    setIsMinimizing(true);
    globalThis.window.setTimeout(() => {
      minimizeWindow(window.id);
      setIsMinimizing(false);
    }, 170);
  }

  function getRestoredBoundsForDrag(event: MouseEvent | globalThis.MouseEvent) {
    if (!window.maximized) return null;
    const fallbackWidth = Math.min(760, Math.max(480, globalThis.window.innerWidth * 0.58));
    const fallbackHeight = Math.min(520, Math.max(320, globalThis.window.innerHeight * 0.58));
    const restoreBounds = window.restoreBounds ?? {
      x: Math.max(14, event.clientX - fallbackWidth / 2),
      y: 48,
      width: fallbackWidth,
      height: fallbackHeight,
    };
    const pointerRatio = Math.min(Math.max((event.clientX - window.x) / Math.max(window.width, 1), 0.15), 0.85);
    const restored = snapWindowBounds({
      ...restoreBounds,
      x: event.clientX - restoreBounds.width * pointerRatio,
      y: Math.max(18, event.clientY - 18),
    });
    return restored;
  }

  return (
    <Rnd
      key={window.id}
      bounds="parent"
      className={clsx(
        "system-window",
        isActive && "is-active",
        window.maximized && "is-maximized",
        isImmersive && "is-immersive",
        isMinimizing && "is-minimizing",
        window.minimized && "is-minimized-kept",
      )}
      data-app-id={window.appId}
      position={{ x: liveBounds.x, y: liveBounds.y }}
      size={{ width: liveBounds.width, height: liveBounds.height }}
      minWidth={380}
      minHeight={250}
      disableDragging={window.minimized || isImmersive}
      dragHandleClassName="window-titlebar"
      cancel=".window-content, .window-actions, .window-actions *, input, textarea, button, select, option, a, iframe, label"
      enableResizing={!window.maximized && !window.minimized && !isImmersive}
      style={{ zIndex: window.minimized ? 0 : isImmersive ? 1000 : window.z }}
      onMouseDown={() => {
        if (!window.minimized) focusWindow(window.id);
      }}
      onDragStart={() => {}}
      onDrag={(_, data) => {
        if (isImmersive) return;
        setLiveBounds((current) => ({ ...current, x: data.x, y: data.y }));
      }}
      onDragStop={(_, data) => {
        if (isImmersive) return;
        if (data.y <= SNAP_THRESHOLD) {
          toggleMaximize(window.id);
          return;
        }
        if (data.x <= SNAP_THRESHOLD) {
          snapWindow(window.id, "left");
          return;
        }
        if (data.x + window.width >= globalThis.window.innerWidth - SNAP_THRESHOLD) {
          snapWindow(window.id, "right");
          return;
        }
        const snapped = snapWindowBounds({ x: data.x, y: data.y, width: window.width, height: window.height });
        setLiveBounds(snapped);
        updateWindow(window.id, { x: snapped.x, y: snapped.y });
      }}
      onResize={(_, __, ref, ___, position) => {
        if (isImmersive) return;
        setLiveBounds({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        if (isImmersive) return;
        const snapped = snapWindowBounds({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
        setLiveBounds(snapped);
        updateWindow(window.id, snapped);
      }}
    >
      <article
        ref={frameRef}
        className="window-frame"
        data-context-kind="window"
        data-context-id={window.id}
        aria-hidden={window.minimized || undefined}
      >
        {!isImmersive ? (
          <header
            ref={titlebarRef}
            tabIndex={-1}
            className="window-titlebar"
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              if (window.maximized) {
                const restored = getRestoredBoundsForDrag(event.nativeEvent);
                if (!restored) return;
                flushSync(() => {
                  setLiveBounds(restored);
                  updateWindow(window.id, { ...restored, maximized: false, restoreBounds: undefined });
                });
              }
            }}
            onDoubleClick={() => toggleMaximize(window.id)}
          >
            <div className="window-title">
              <Icon icon={windowIcon} width={18} height={18} />
              <span>{windowTitle}</span>
            </div>
            <div
              className="window-actions"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="window-action is-minimize" aria-label={`${t("minimizeWindowLabel")} ${windowTitle}`} onClick={requestMinimize}>
                <Icon icon="lucide:minus" width={16} height={16} />
              </button>
              {canFullscreen ? (
                <button
                  type="button"
                  className="window-action is-fullscreen"
                  aria-label={`${t("fullscreenWindowLabel")} ${windowTitle}`}
                  onClick={() => {
                    focusWindow(window.id);
                    toggleImmersive(window.id);
                  }}
                >
                  <Icon icon="lucide:maximize-2" width={14} height={14} />
                </button>
              ) : null}
              <button
                type="button"
                className="window-action is-maximize"
                aria-label={`${window.maximized ? t("restoreWindowLabel") : t("maximizeWindowLabel")} ${windowTitle}`}
                onClick={() => toggleMaximize(window.id)}
              >
                <Icon icon={window.maximized ? "lucide:copy" : "lucide:square"} width={14} height={14} />
              </button>
              <button
                type="button"
                className="window-action is-close"
                aria-label={`${t("closeWindowLabel")} ${windowTitle}`}
                onClick={() => requestCloseWindow(window, closeWindow)}
              >
                <Icon icon="lucide:x" width={16} height={16} />
              </button>
            </div>
          </header>
        ) : null}
        <div className="window-content">{renderApp(window)}</div>
      </article>
    </Rnd>
  );
});

function renderApp(window: WindowState) {
  const RegisteredApp = appComponentRegistry[window.appId];
  if (RegisteredApp) {
    return (
      <Suspense fallback={<WindowLoadingFallback />}>
        <RegisteredApp windowId={window.id} />
      </Suspense>
    );
  }
}

function WindowLoadingFallback() {
  const t = useLanguageStore((state) => state.t);

  return (
    <div className="empty-state compact">
      <p>{t("loading")}</p>
    </div>
  );
}
