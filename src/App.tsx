import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useHotkeys } from "react-hotkeys-hook";
import { lazy, Suspense, useEffect, useState, type MouseEvent } from "react";
import { AppDialogHost } from "./components/AppDialogHost";
import { FpsOverlay } from "./components/FpsOverlay";
import { Launcher } from "./components/Launcher";
import { LockScreen } from "./components/LockScreen";
import { NotificationOverlay } from "./components/NotificationOverlay";
import { Taskbar } from "./components/Taskbar";
import { WindowSwitcher } from "./components/WindowSwitcher";
import { useFsStore } from "./fs";
import { useLanguageStore } from "./languageStore";
import { useOsUiStore } from "./osUiStore";
import { ContextMenu } from "./shell/ContextMenu";
import { Desktop } from "./shell/Desktop";
import { SystemWindow } from "./shell/SystemWindow";
import { applyThemeSettings, readThemeSettings, THEME_STORAGE_KEY } from "./theme";
import type { ContextMenuState } from "./types";
import { useDesktopStore } from "./windowStore";

const CommandPalette = lazy(() => import("./components/CommandPalette").then((module) => ({ default: module.CommandPalette })));

applyThemeSettings(readThemeSettings());

export function App() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [booting, setBooting] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(0);
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const launcherOpen = useDesktopStore((state) => state.launcherOpen);
  const closeLauncher = useDesktopStore((state) => state.closeLauncher);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const activeWorkspace = useOsUiStore((state) => state.activeWorkspace);
  const immersiveWindowId = useOsUiStore((state) => state.immersiveWindowId);
  const sessionLocked = useOsUiStore((state) => state.sessionLocked);
  const exitImmersive = useOsUiStore((state) => state.exitImmersive);
  const initFs = useFsStore((state) => state.init);
  const t = useLanguageStore((state) => state.t);
  const workspaceWindows = windows.filter((window) => (window.workspaceId ?? 0) === activeWorkspace);
  const switcherWindows = workspaceWindows.slice().sort((a, b) => b.z - a.z);
  const isImmersive = Boolean(immersiveWindowId);

  useHotkeys("ctrl+k, meta+k", () => setCommandOpen((open) => !open), { preventDefault: true, enableOnFormTags: true });

  useEffect(() => {
    if (!immersiveWindowId) return;
    if (!windows.some((win) => win.id === immersiveWindowId)) {
      exitImmersive();
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "F11") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector(".app-dialog-backdrop, .mmd-modal-backdrop")) return;
      event.preventDefault();
      exitImmersive();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitImmersive, immersiveWindowId, windows]);

  useEffect(() => {
    const theme = readThemeSettings();
    applyThemeSettings(theme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      const nextTheme = readThemeSettings();
      if (nextTheme.theme === "system") applyThemeSettings(nextTheme);
    };
    media.addEventListener?.("change", updateSystemTheme);
    return () => media.removeEventListener?.("change", updateSystemTheme);
  }, []);

  function openContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const contextTarget = target.closest<HTMLElement>("[data-context-kind]");
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: (contextTarget?.dataset.contextKind as ContextMenuState["kind"] | undefined) ?? "desktop",
      id: contextTarget?.dataset.contextId,
    });
    closeLauncher();
  }

  useEffect(() => {
    let mounted = true;
    const minBootTime = new Promise((resolve) => window.setTimeout(resolve, 900));
    void Promise.all([initFs(), minBootTime]).then(() => {
      if (mounted) setBooting(false);
    });
    return () => {
      mounted = false;
    };
  }, [initFs]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || (!event.altKey && !event.metaKey)) return;
      if (!switcherWindows.length) return;
      event.preventDefault();
      setSwitcherOpen(true);
      setSwitcherIndex((current) => {
        const activeIndex = switcherWindows.findIndex((window) => window.id === activeWindowId);
        const base = current >= 0 && current < switcherWindows.length ? current : Math.max(0, activeIndex);
        return (base + 1) % switcherWindows.length;
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key !== "Alt" && event.key !== "Meta") return;
      const target = switcherWindows[switcherIndex];
      setSwitcherOpen(false);
      if (!target) return;
      restoreWindow(target.id);
      focusWindow(target.id);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeWindowId, focusWindow, restoreWindow, switcherIndex, switcherWindows]);

  if (booting) {
    return (
      <main className="os-boot-screen" onContextMenu={(e) => e.preventDefault()}>
        <div className="os-boot-content">
          <Icon className="boot-cat" icon="solar:cat-bold-duotone" width={56} height={56} />
          <h2 className="boot-title">NekoVirtOS</h2>
          <div className="boot-progress-track">
            <div className="boot-progress-bar" />
          </div>
          <span className="boot-status">{t("bootStatus")}</span>
        </div>
      </main>
    );
  }

  return (
    <main
      className={clsx("os", isImmersive && "is-immersive")}
      onContextMenu={isImmersive ? (event) => event.preventDefault() : openContextMenu}
      onMouseDown={() => {
        if (isImmersive) return;
        closeLauncher();
        setContextMenu(null);
      }}
    >
      {!isImmersive ? <Desktop /> : null}
      <section className="window-layer" aria-label={t("openWindows")}>
        {workspaceWindows.map((window) => (
          <SystemWindow key={window.id} window={window} />
        ))}
      </section>
      {!isImmersive && launcherOpen ? <Launcher /> : null}
      {!isImmersive && switcherOpen ? <WindowSwitcher windows={switcherWindows} selectedIndex={switcherIndex} /> : null}
      {!isImmersive && contextMenu ? <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} /> : null}
      {!isImmersive && commandOpen ? (
        <Suspense fallback={null}>
          <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        </Suspense>
      ) : null}
      {!isImmersive ? <NotificationOverlay /> : null}
      <AppDialogHost />
      {!isImmersive ? <Taskbar /> : null}
      <FpsOverlay />
      {sessionLocked ? <LockScreen /> : null}
    </main>
  );
}
