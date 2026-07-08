import { Icon } from "@iconify-icon/react";
import { Rnd } from "react-rnd";
import { clsx } from "clsx";
import { useHotkeys } from "react-hotkeys-hook";
import { lazy, Suspense, useEffect, useState, type MouseEvent } from "react";
import { apps } from "./apps";
import { useFsStore } from "./fsStore";
import { useNotificationStore } from "./notificationStore";
import { useLanguageStore, type TranslationKey } from "./languageStore";
import { findFileByName, formatFileSize, formatFileTime, sortFiles } from "./fileUtils";
import { snapWindowBounds, useDesktopStore } from "./windowStore";
import { appDescriptionKeys, appTitleKeys, getAppIcon } from "./appText";
import { appComponentRegistry } from "./appRegistry";
import { clampDesktopIconPosition, findNearestAvailableGridPosition, getDesktopGridKey, getDesktopGridPosition, snapDesktopIconPosition } from "./desktopLayout";
import { ACCENT_HUES, applyThemeSettings, readThemeSettings, resolveThemeMode, THEME_STORAGE_KEY, WALLPAPERS } from "./theme";
import { Launcher } from "./components/Launcher";
import { NotificationOverlay } from "./components/NotificationOverlay";
import { Taskbar } from "./components/Taskbar";
import { WindowSwitcher } from "./components/WindowSwitcher";
import type { FsFile } from "./virtualFs";
import type { AppId, ContextMenuState, DesktopLayoutMode, FileMutationResult, FileSortMode, ThemeSettings, WindowState } from "./types";

const CommandPalette = lazy(() => import("./components/CommandPalette").then((module) => ({ default: module.CommandPalette })));

type StorageSnapshot = { usage?: number; quota?: number };
type DeviceSnapshot = {
  architecture?: string;
  bitness?: string;
  platformVersion?: string;
  model?: string;
  uaFullVersion?: string;
  fullVersionList?: { brand: string; version: string }[];
};
type BrowserNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    brands?: { brand: string; version: string }[];
    mobile?: boolean;
    getHighEntropyValues?: (hints: string[]) => Promise<DeviceSnapshot>;
  };
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
};
type BrowserPerformance = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
};
type LocalTask = { id: string; text: string; done: boolean };

const TASKS_STORAGE_KEY = "neko-virt-os.tasks.v1";
const PALETTE_COLORS = [
  ["Kernel", "#3467d6"],
  ["Rose", "#d65b8f"],
  ["Mint", "#36a66d"],
  ["Sun", "#d09a27"],
  ["Sky", "#2f88d8"],
  ["Violet", "#8a5bd8"],
  ["Coral", "#d65c45"],
  ["Ink", "#242733"],
] as const;

function formatBytes(value?: number) {
  if (!value || Number.isNaN(value)) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function getStorageLabel(snapshot: StorageSnapshot | null) {
  if (!snapshot?.quota) return "Unavailable";
  return `${formatBytes(snapshot.usage)} used of ${formatBytes(snapshot.quota)}`;
}

async function readHighEntropyDeviceInfo() {
  const nav = navigator as BrowserNavigator;
  try {
    return await nav.userAgentData?.getHighEntropyValues?.(["architecture", "bitness", "platformVersion", "model", "uaFullVersion", "fullVersionList"]);
  } catch {
    return undefined;
  }
}

function getBrowserName(snapshot?: DeviceSnapshot) {
  const brands = snapshot?.fullVersionList ?? (navigator as BrowserNavigator).userAgentData?.brands;
  const brand = brands?.find((item) => !/Chromium|Not A\(?Brand/i.test(item.brand)) ?? brands?.[0];
  if (brand) return `${brand.brand} ${brand.version}`;
  const ua = navigator.userAgent;
  const match = ua.match(/(Firefox|Edg|Chrome|Safari)\/([\d.]+)/);
  return match ? `${match[1] === "Edg" ? "Edge" : match[1]} ${match[2]}` : ua;
}

function getDeviceRows(storage: StorageSnapshot | null, device: DeviceSnapshot | undefined, t: (key: TranslationKey) => string) {
  const nav = navigator as BrowserNavigator;
  const screenInfo = window.screen;
  const connection = nav.connection;
  const heap = (performance as BrowserPerformance).memory;

  return [
    [t("processor"), navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} threads` : t("unavailable")],
    [t("memory"), nav.deviceMemory ? `${nav.deviceMemory} GB` : t("unavailable")],
    [t("jsHeap"), heap ? `${formatBytes(heap.usedJSHeapSize)} / ${formatBytes(heap.jsHeapSizeLimit)}` : t("unavailable")],
    [t("platform"), nav.userAgentData?.platform || navigator.platform || t("unavailable")],
    [t("architecture"), device?.architecture ? `${device.architecture}${device.bitness ? ` ${device.bitness}-bit` : ""}` : t("unavailable")],
    [t("platformVersion"), device?.platformVersion || t("unavailable")],
    [t("browser"), getBrowserName(device)],
    [t("mobile"), nav.userAgentData ? (nav.userAgentData.mobile ? t("yes") : t("no")) : navigator.maxTouchPoints > 1 ? t("possibly") : t("no")],
    [t("language"), navigator.language || t("unavailable")],
    [t("timezone"), Intl.DateTimeFormat().resolvedOptions().timeZone || t("unavailable")],
    [t("screen"), `${screenInfo.width} x ${screenInfo.height} @ ${window.devicePixelRatio.toFixed(2)}x`],
    [t("viewport"), `${window.innerWidth} x ${window.innerHeight}`],
    [t("colorDepth"), `${screenInfo.colorDepth}-bit`],
    [t("touchPoints"), `${navigator.maxTouchPoints || 0}`],
    [t("network"), connection?.effectiveType ? `${connection.effectiveType}${connection.downlink ? `, ${connection.downlink} Mbps` : ""}${connection.rtt ? `, ${connection.rtt}ms` : ""}` : t("unavailable")],
    [t("storage"), getStorageLabel(storage)],
    [t("secureContext"), window.isSecureContext ? t("yes") : t("no")],
  ];
}

function setNoteWindowDirty(windowId: string, dirty: boolean) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  registry[windowId] = dirty;
}

function clearNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ??= {}) as Record<string, boolean>;
  delete registry[windowId];
}

function isNoteWindowDirty(windowId: string) {
  const registry = ((globalThis as any).__notes_dirty_windows ?? {}) as Record<string, boolean>;
  return Boolean(registry[windowId]);
}

function requestCloseWindow(windowState: WindowState, closeWindow: (id: string) => void) {
  const t = useLanguageStore.getState().t;
  if (windowState.appId === "notes" && isNoteWindowDirty(windowState.id)) {
    const shouldClose = window.confirm(t("confirmUnsavedNotes"));
    if (!shouldClose) return;
  }
  clearNoteWindowDirty(windowState.id);
  closeWindow(windowState.id);
}

function phrase(t: (key: TranslationKey) => string, prefix: TranslationKey, value: string | number, suffix: TranslationKey) {
  return `${t(prefix)}${value}${t(suffix)}`;
}

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
  const initFs = useFsStore((state) => state.init);
  const t = useLanguageStore((state) => state.t);
  const switcherWindows = windows.slice().sort((a, b) => b.z - a.z);

  useHotkeys("ctrl+k, meta+k", () => setCommandOpen((open) => !open), { preventDefault: true, enableOnFormTags: true });

  // Persist normalized theme settings before the boot screen finishes.
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
      className="os"
      onContextMenu={openContextMenu}
      onMouseDown={() => {
        closeLauncher();
        setContextMenu(null);
      }}
    >
      <Desktop />
      <section className="window-layer" aria-label={t("openWindows")}>
        {windows.map((window) => (
          <SystemWindow key={window.id} window={window} />
        ))}
      </section>
      {launcherOpen ? <Launcher /> : null}
      {switcherOpen ? <WindowSwitcher windows={switcherWindows} selectedIndex={switcherIndex} /> : null}
      {contextMenu ? <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} /> : null}
      {commandOpen ? (
        <Suspense fallback={null}>
          <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        </Suspense>
      ) : null}
      <NotificationOverlay />
      <Taskbar />
    </main>
  );
}

function Desktop() {
  const [selectedDesktopItems, setSelectedDesktopItems] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const openApp = useDesktopStore((state) => state.openApp);
  const updateDesktopIconPosition = useDesktopStore((state) => state.updateDesktopIconPosition);
  const desktopLayoutMode = useDesktopStore((state) => state.desktopLayoutMode);
  const setDesktopLayoutMode = useDesktopStore((state) => state.setDesktopLayoutMode);
  const desktopIconPositions = useDesktopStore((state) => state.desktopIconPositions);
  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const deleteSelectedFile = useFsStore((state) => state.deleteSelectedFile);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const desktopApps: AppId[] = ["files", "notes", "browser", "calculator", "calendar", "tasks", "timer", "palette", "settings", "task-manager", "about"];
  const [pinnedDesktopApps, setPinnedDesktopApps] = useState<AppId[]>(desktopApps);
  const [hiddenDesktopApps, setHiddenDesktopApps] = useState<AppId[]>([]);
  const desktopFiles = files.filter((file) => !file.trashed).slice(0, 4);

  // Expose these modifiers for the right-click menu
  (globalThis as any).__desktop_state = {
    pinnedDesktopApps,
    setPinnedDesktopApps,
    hiddenDesktopApps,
    setHiddenDesktopApps,
    addNotification,
  };

  const visibleApps = pinnedDesktopApps.filter((id) => !hiddenDesktopApps.includes(id));
  const desktopItems = [
    ...visibleApps.map((id) => ({ id: `app:${id}`, kind: "app" as const, appId: id })),
    ...desktopFiles.map((file) => ({ id: `file:${file.id}`, kind: "file" as const, file })),
  ];

  function getIconPosition(itemId: string, index: number, bounds?: { width: number; height: number }) {
    const saved = (desktopIconPositions as Record<string, { x: number; y: number }>)[itemId];
    if (desktopLayoutMode === "free") return saved ?? getDesktopGridPosition(index, bounds);
    return snapDesktopIconPosition(saved ?? getDesktopGridPosition(index, bounds), bounds);
  }

  function setLayoutMode(mode: DesktopLayoutMode) {
    if (mode === "grid") {
      const desktopEl = document.querySelector(".desktop-icons");
      const desktopBounds = desktopEl ? desktopEl.getBoundingClientRect() : { width: 1200, height: 700 };
      const occupiedKeys = new Set<string>();
      desktopItems.forEach((item, index) => {
        const position = findNearestAvailableGridPosition(getIconPosition(item.id, index, desktopBounds), occupiedKeys, desktopBounds);
        occupiedKeys.add(getDesktopGridKey(position));
        updateDesktopIconPosition(item.id, position.x, position.y);
      });
    }
    setDesktopLayoutMode(mode);
    addNotification({
      title: mode === "grid" ? t("desktopGridMode") : t("desktopFreeMode"),
      message: mode === "grid" ? t("desktopGridModeMessage") : t("desktopFreeModeMessage"),
      type: "info",
    });
  }

  // Selection box and delete key logic
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === "Delete" && selectedDesktopItems.length > 0) {
        const fileIdsToDelete = selectedDesktopItems
          .filter((item) => item.startsWith("file:"))
          .map((item) => item.replace("file:", ""));
        
        if (fileIdsToDelete.length > 0) {
          const filesToDelete = files.filter((f) => fileIdsToDelete.includes(f.id));
          const names = filesToDelete.map((f) => f.name).join(", ");
          if (window.confirm(phrase(t, "confirmDeletePrefix", names, "confirmDeleteSuffix"))) {
            void Promise.all(
              filesToDelete.map(async (f) => {
                selectFile(f.id);
                await deleteSelectedFile();
              })
            ).then(() => {
              (globalThis as any).__desktop_state?.addNotification({
                title: t("filesDeleted"),
                message: phrase(t, "filesDeletedPrefix", filesToDelete.length, "filesDeletedSuffix"),
                type: "success",
              });
            });
            setSelectedDesktopItems([]);
          }
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedDesktopItems, files, selectFile, deleteSelectedFile]);

  function handleDesktopMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    
    if (target.closest(".desktop-icon")) {
      return;
    }

    if (target.classList.contains("desktop") || target.classList.contains("desktop-brand") || target.closest(".desktop-brand") || target.classList.contains("desktop-icons")) {
      setSelectedDesktopItems([]);
      const startX = event.clientX;
      const startY = event.clientY;

      setSelectionBox({ x1: startX, y1: startY, x2: startX, y2: startY });

      function handleMouseMove(e: globalThis.MouseEvent) {
        setSelectionBox((prev) => {
          if (!prev) return null;
          return { ...prev, x2: e.clientX, y2: e.clientY };
        });
      }

      function handleMouseUp(e: globalThis.MouseEvent) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        setSelectionBox((box) => {
          if (!box) return null;
          const xMin = Math.min(box.x1, box.x2);
          const xMax = Math.max(box.x1, box.x2);
          const yMin = Math.min(box.y1, box.y2);
          const yMax = Math.max(box.y1, box.y2);

          const newlySelected: string[] = [];
          const elements = document.querySelectorAll("[data-desktop-icon-id]");
          elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const overlapX = rect.left < xMax && rect.right > xMin;
            const overlapY = rect.top < yMax && rect.bottom > yMin;
            if (overlapX && overlapY) {
              const iconId = el.getAttribute("data-desktop-icon-id");
              if (iconId) newlySelected.push(iconId);
            }
          });
          setSelectedDesktopItems(newlySelected);
          return null;
        });
      }

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
  }

  // Custom Icon mouse down logic (single click, multiselect drag, boundary limits)
  function handleIconMouseDown(itemId: string, event: MouseEvent<HTMLElement>) {
    if (event.button !== 0) return; // Only handle left clicks
    event.stopPropagation();

    const isCtrl = event.ctrlKey || event.metaKey;
    let nextSelected = [...selectedDesktopItems];

    if (isCtrl) {
      if (nextSelected.includes(itemId)) {
        nextSelected = nextSelected.filter((id) => id !== itemId);
      } else {
        nextSelected.push(itemId);
      }
    } else {
      if (!nextSelected.includes(itemId)) {
        nextSelected = [itemId];
      }
    }

    setSelectedDesktopItems(nextSelected);

    if (itemId.startsWith("file:")) {
      selectFile(itemId.replace("file:", ""));
    }

    const startX = event.clientX;
    const startY = event.clientY;

    const desktopEl = document.querySelector(".desktop-icons");
    const desktopBounds = desktopEl ? desktopEl.getBoundingClientRect() : { width: 1200, height: 700 };

    const initialPositions = nextSelected.reduce((acc, id) => {
      const index = Math.max(0, desktopItems.findIndex((item) => item.id === id));
      acc[id] = getIconPosition(id, index, desktopBounds);
      return acc;
    }, {} as Record<string, { x: number; y: number }>);

    let hasDragged = false;
    const livePositions: Record<string, { x: number; y: number }> = {};

    function handleMouseMove(e: globalThis.MouseEvent) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasDragged = true;
      }

      if (hasDragged) {
        nextSelected.forEach((id) => {
          const initPos = initialPositions[id];
          if (initPos) {
            const nextPosition = clampDesktopIconPosition({ x: initPos.x + deltaX, y: initPos.y + deltaY }, desktopBounds);
            livePositions[id] = nextPosition;
            updateDesktopIconPosition(id, nextPosition.x, nextPosition.y);
          }
        });
      }
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      // If the mouse up happened without moving, it's a simple selection reset
      if (!hasDragged && !isCtrl) {
        setSelectedDesktopItems([itemId]);
      } else if (hasDragged && desktopLayoutMode === "grid") {
        const occupiedKeys = new Set(
          desktopItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !nextSelected.includes(item.id))
            .map(({ item, index }) => getDesktopGridKey(getIconPosition(item.id, index, desktopBounds)))
        );
        nextSelected.forEach((id) => {
          const current = livePositions[id] ?? initialPositions[id];
          if (!current) return;
          const snapped = findNearestAvailableGridPosition(current, occupiedKeys, desktopBounds);
          occupiedKeys.add(getDesktopGridKey(snapped));
          updateDesktopIconPosition(id, snapped.x, snapped.y);
        });
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleIconContextMenu(itemId: string, event: MouseEvent) {
    if (!selectedDesktopItems.includes(itemId)) {
      setSelectedDesktopItems([itemId]);
      if (itemId.startsWith("file:")) {
        selectFile(itemId.replace("file:", ""));
      }
    }
  }

  return (
    <section
      className="desktop"
      aria-label={t("desktop")}
      data-context-kind="desktop"
      onMouseDown={handleDesktopMouseDown}
    >
      <div className="desktop-brand">
        <span className="brand-mark">N</span>
        <div>
          <p>NekoVirtOS</p>
          <span>{t("desktopSubtitle")}</span>
        </div>
      </div>
      <div className="desktop-layout-toggle" onMouseDown={(event) => event.stopPropagation()}>
        {(["grid", "free"] as const).map((mode) => (
          <button
            key={mode}
            className={clsx(desktopLayoutMode === mode && "is-active")}
            onClick={() => setLayoutMode(mode)}
            title={mode === "grid" ? t("desktopGridMode") : t("desktopFreeMode")}
            aria-pressed={desktopLayoutMode === mode}
          >
            <Icon icon={mode === "grid" ? "solar:widget-5-bold-duotone" : "solar:move-to-folder-bold-duotone"} width={15} height={15} />
            <span>{mode === "grid" ? t("desktopGridMode") : t("desktopFreeMode")}</span>
          </button>
        ))}
      </div>
      <div className="desktop-icons">
        {visibleApps.map((appId, index) => {
          const app = apps.find((item) => item.id === appId)!;
          const itemId = `app:${app.id}`;
          const pos = getIconPosition(itemId, index);
          return (
            <div
              key={`desktop-app:${app.id}`}
              className={clsx("desktop-icon", selectedDesktopItems.includes(itemId) && "is-selected")}
              data-app-id={app.id}
              style={{ position: "absolute", left: pos.x, top: pos.y }}
              data-context-kind="desktop-app"
              data-context-id={app.id}
              data-desktop-icon-id={itemId}
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={(e) => handleIconMouseDown(itemId, e)}
              onContextMenu={(e) => handleIconContextMenu(itemId, e)}
              onDoubleClick={() => openApp(app.id)}
            >
              <Icon icon={app.icon} width={30} height={30} />
              <span>{t(appTitleKeys[app.id])}</span>
            </div>
          );
        })}
        {desktopFiles.map((file, index) => {
          const itemId = `file:${file.id}`;
          const pos = getIconPosition(itemId, visibleApps.length + index);
          return (
            <div
              key={`desktop-file:${file.id}`}
              className={clsx("desktop-icon", "desktop-file", selectedDesktopItems.includes(itemId) && "is-selected")}
              style={{ position: "absolute", left: pos.x, top: pos.y }}
              data-context-kind="file"
              data-context-id={file.id}
              data-desktop-icon-id={itemId}
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={(e) => handleIconMouseDown(itemId, e)}
              onContextMenu={(e) => handleIconContextMenu(itemId, e)}
              onDoubleClick={() => {
                selectFile(file.id);
                openApp("notes");
              }}
            >
              <Icon icon="solar:document-text-bold-duotone" width={30} height={30} />
              <span>{file.name}</span>
            </div>
          );
        })}
      </div>
      {selectionBox ? (
        <div
          className="desktop-selection-box"
          style={{
            left: Math.min(selectionBox.x1, selectionBox.x2),
            top: Math.min(selectionBox.y1, selectionBox.y2),
            width: Math.abs(selectionBox.x2 - selectionBox.x1),
            height: Math.abs(selectionBox.y2 - selectionBox.y1),
          }}
        />
      ) : null}
    </section>
  );
}

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const windows = useDesktopStore((state) => state.windows);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const snapWindow = useDesktopStore((state) => state.snapWindow);
  const cascadeWindows = useDesktopStore((state) => state.cascadeWindows);
  const tileWindows = useDesktopStore((state) => state.tileWindows);
  const togglePinnedWindowZ = useDesktopStore((state) => state.togglePinnedWindowZ);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const createFile = useFsStore((state) => state.createFile);

  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const deleteSelectedFile = useFsStore((state) => state.deleteSelectedFile);
  const restoreFileById = useFsStore((state) => state.restoreFileById);
  const permanentlyDeleteFileById = useFsStore((state) => state.permanentlyDeleteFileById);
  const renameSelectedFile = useFsStore((state) => state.renameSelectedFile);
  const app = apps.find((item) => item.id === menu.id);
  const file = files.find((item) => item.id === menu.id);
  const windowState = windows.find((item) => item.id === menu.id);
  const left = Math.min(menu.x, globalThis.window.innerWidth - 196);
  const top = Math.min(menu.y, globalThis.window.innerHeight - 190);

  function run(action: () => void | Promise<void>) {
    void Promise.resolve(action()).finally(onClose);
  }

  async function renameFileFromMenu() {
    if (!file) return;
    selectFile(file.id);
    const nextName = window.prompt(t("renameFilePrompt"), file.name);
    if (!nextName || nextName.trim() === file.name) return;
    const result = await renameSelectedFile(nextName);
    if (result.error) {
      window.alert(result.error);
      const modifier = (globalThis as any).__desktop_state;
      modifier?.addNotification?.({
        title: t("renameFailed"),
        message: result.error,
        type: "error",
      });
    } else {
      const modifier = (globalThis as any).__desktop_state;
      modifier?.addNotification?.({
        title: t("fileRenamed"),
        message: phrase(t, "fileRenamedPrefix", nextName, "fileRenamedSuffix"),
        type: "success",
      });
    }
  }

  async function deleteFileFromMenu() {
    if (!file) return;
    selectFile(file.id);
    if (!window.confirm(phrase(t, "confirmMoveToTrashPrefix", file.name, "confirmMoveToTrashSuffix"))) return;
    await deleteSelectedFile();
    const modifier = (globalThis as any).__desktop_state;
    modifier?.addNotification?.({
      title: t("fileDeleted"),
      message: `${file.name}${t("movedToTrashSuffix")}`,
      type: "success",
    });
  }

  async function restoreFileFromMenu() {
    if (!file) return;
    await restoreFileById(file.id);
    addNotification({ title: t("restore"), message: `${file.name}${t("restoredSuffix")}`, type: "success" });
  }

  async function permanentlyDeleteFileFromMenu() {
    if (!file) return;
    if (!window.confirm(phrase(t, "confirmPermanentDeletePrefix", file.name, "confirmPermanentDeleteSuffix"))) return;
    await permanentlyDeleteFileById(file.id);
    addNotification({ title: t("fileDeleted"), message: `${file.name}${t("permanentlyDeletedSuffix")}`, type: "success" });
  }

  async function createFileFromMenu() {
    const startInlineCreate = (globalThis as any).__files_start_create as (() => void) | undefined;
    if (startInlineCreate) {
      startInlineCreate();
      return;
    }

    await createFileDirectFromMenu();
  }

  async function createFileDirectFromMenu() {
    await createFile();
    addNotification({
      title: t("fileCreated"),
      message: t("fileCreatedDefaultMessage"),
      type: "success",
    });
  }

  return (
    <div
      className="context-menu"
      style={{ left, top }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      role="menu"
    >
      {menu.kind === "desktop-app" && app ? (
        <>
          <button role="menuitem" onClick={() => run(() => openApp(app.id))}>
            <Icon icon="solar:login-2-bold-duotone" width={16} height={16} />
            {t("open")} {t(appTitleKeys[app.id])}
          </button>
          <button
            role="menuitem"
            onClick={() =>
              run(() => {
                const modifier = (globalThis as any).__desktop_state;
                if (!modifier) return;
                modifier.setHiddenDesktopApps((prev: AppId[]) => [...prev, app.id]);
              })
            }
          >
            <Icon icon="solar:eye-closed-bold-duotone" width={16} height={16} />
            {t("hideFromDesktop")}
          </button>
          <span className="context-menu-note">{t("pinnedApplication")}</span>
          <div className="context-menu-divider" />
        </>
      ) : null}
      {menu.kind === "file" && file ? (
        <>
          {file.trashed ? (
            <>
              <button role="menuitem" onClick={() => run(restoreFileFromMenu)}>
                <Icon icon="solar:undo-left-round-bold-duotone" width={16} height={16} />
                {t("restore")}
              </button>
              <button role="menuitem" onClick={() => run(permanentlyDeleteFileFromMenu)}>
                <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={16} height={16} />
                {t("deleteForever")}
              </button>
            </>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => run(() => {
                  selectFile(file.id);
                  openApp("notes");
                })}
              >
                <Icon icon="solar:document-text-bold-duotone" width={16} height={16} />
                {t("open")} {t("appNotes")}
              </button>
              <button role="menuitem" onClick={() => run(renameFileFromMenu)}>
                <Icon icon="solar:pen-new-square-bold-duotone" width={16} height={16} />
                {t("rename")}
              </button>
              <button role="menuitem" onClick={() => run(deleteFileFromMenu)}>
                <Icon icon="solar:trash-bin-trash-bold-duotone" width={16} height={16} />
                {t("moveToTrash")}
              </button>
            </>
          )}
          <div className="context-menu-divider" />
        </>
      ) : null}
      {(menu.kind === "window" || menu.kind === "taskbar-window") && windowState ? (
        <>
          <button role="menuitem" onClick={() => run(() => restoreWindow(windowState.id))}>
            <Icon icon="solar:login-2-bold-duotone" width={16} height={16} />
            {t("restore")}
          </button>
          <button role="menuitem" onClick={() => run(() => minimizeWindow(windowState.id))}>
            <span className="context-glyph">-</span>
            {t("minimize")}
          </button>
          <button role="menuitem" onClick={() => run(() => toggleMaximize(windowState.id))}>
            <span className="context-glyph">{windowState.maximized ? "□" : "▢"}</span>
            {windowState.maximized ? t("restoreSize") : t("maximize")}
          </button>
          <button role="menuitem" onClick={() => run(() => snapWindow(windowState.id, "left"))}>
            <Icon icon="solar:sidebar-minimalistic-bold-duotone" width={16} height={16} />
            Snap left
          </button>
          <button role="menuitem" onClick={() => run(() => snapWindow(windowState.id, "right"))}>
            <Icon icon="solar:sidebar-code-bold-duotone" width={16} height={16} />
            Snap right
          </button>
          <button role="menuitem" onClick={() => run(() => togglePinnedWindowZ(windowState.id))}>
            <Icon icon="solar:pin-bold-duotone" width={16} height={16} />
            Bring to front
          </button>
          <div className="context-menu-divider" />
          <button role="menuitem" onClick={() => run(() => requestCloseWindow(windowState, closeWindow))}>
            <span className="context-glyph">×</span>
            {t("close")}
          </button>
          <div className="context-menu-divider" />
        </>
      ) : null}
      {menu.kind === "files-empty" ? (
        <>
          <button role="menuitem" onClick={() => run(createFileFromMenu)}>
            <Icon icon="solar:add-circle-bold-duotone" width={16} height={16} />
            {t("createTextFile")}
          </button>
          <div className="context-menu-divider" />
        </>
      ) : null}
      {menu.kind === "desktop" ? (
        <>
          <button
            role="menuitem"
            onClick={() =>
              run(() => {
                const modifier = (globalThis as any).__desktop_state;
                if (!modifier) return;
                modifier.setHiddenDesktopApps([]);
              })
            }
          >
            <Icon icon="solar:eye-bold-duotone" width={16} height={16} />
            {t("showHiddenApplications")}
          </button>
          <div className="context-menu-divider" />
        </>
      ) : null}
      {menu.kind !== "window" && menu.kind !== "taskbar-window" && menu.kind !== "files-empty" ? (
        <button role="menuitem" onClick={() => run(createFileDirectFromMenu)}>
          <Icon icon="solar:add-circle-bold-duotone" width={16} height={16} />
          {t("newFile")}
        </button>
      ) : null}
      <button role="menuitem" onClick={() => run(cascadeWindows)}>
        <Icon icon="solar:layers-bold-duotone" width={16} height={16} />
        {t("cascadeWindows")}
      </button>
      <button role="menuitem" onClick={() => run(tileWindows)}>
        <Icon icon="solar:widget-5-bold-duotone" width={16} height={16} />
        {t("tileWindows")}
      </button>
      <button role="menuitem" onClick={() => run(resetWindowLayout)}>
        <Icon icon="solar:restart-bold-duotone" width={16} height={16} />
        {t("resetWindows")}
      </button>
    </div>
  );
}

function SystemWindow({ window }: { window: WindowState }) {
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const snapWindow = useDesktopStore((state) => state.snapWindow);
  const updateWindow = useDesktopStore((state) => state.updateWindow);
  const isActive = activeWindowId === window.id;
  const windowIcon = getAppIcon(window.appId, window.icon);
  const t = useLanguageStore((state) => state.t);
  const windowTitle = t(appTitleKeys[window.appId]);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [liveBounds, setLiveBounds] = useState(() => ({ x: window.x, y: window.y, width: window.width, height: window.height }));

  useEffect(() => {
    setLiveBounds({ x: window.x, y: window.y, width: window.width, height: window.height });
  }, [window.x, window.y, window.width, window.height]);

  function requestMinimize() {
    setIsMinimizing(true);
    globalThis.window.setTimeout(() => {
      minimizeWindow(window.id);
      setIsMinimizing(false);
    }, 170);
  }

  function restoreForDrag(event: MouseEvent | globalThis.MouseEvent) {
    if (!window.maximized) return;
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
    setLiveBounds(restored);
    updateWindow(window.id, { ...restored, maximized: false, restoreBounds: undefined });
  }

  if (window.minimized) return null;

  return (
    <Rnd
      key={window.id}
      bounds="parent"
      className={clsx("system-window", isActive && "is-active", window.maximized && "is-maximized", isMinimizing && "is-minimizing")}
      data-app-id={window.appId}
      position={{ x: liveBounds.x, y: liveBounds.y }}
      size={{ width: liveBounds.width, height: liveBounds.height }}
      disableDragging={false}
      dragHandleClassName="window-titlebar"
      enableResizing={!window.maximized}
      minWidth={380}
      minHeight={250}
      style={{ zIndex: window.z }}
      onMouseDown={() => focusWindow(window.id)}
      onDragStart={(event) => restoreForDrag(event as globalThis.MouseEvent)}
      onDrag={(_, data) => setLiveBounds((current) => ({ ...current, x: data.x, y: data.y }))}
      onDragStop={(_, data) => {
        if (data.y <= 14) {
          toggleMaximize(window.id);
          return;
        }
        if (data.x <= 14) {
          snapWindow(window.id, "left");
          return;
        }
        if (data.x + window.width >= globalThis.window.innerWidth - 14) {
          snapWindow(window.id, "right");
          return;
        }
        const snapped = snapWindowBounds({ x: data.x, y: data.y, width: window.width, height: window.height });
        setLiveBounds(snapped);
        updateWindow(window.id, { x: snapped.x, y: snapped.y });
      }}
      onResize={(_, __, ref, ___, position) => {
        setLiveBounds({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
      }}
      onResizeStop={(_, __, ref, ___, position) => {
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
      <article className="window-frame" data-context-kind="window" data-context-id={window.id}>
        <header className="window-titlebar" onDoubleClick={() => toggleMaximize(window.id)}>
          <div className="window-title">
            <Icon icon={windowIcon} width={18} height={18} />
            <span>{windowTitle}</span>
          </div>
          <div
            className="window-actions"
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <button aria-label={`Minimize ${windowTitle}`} onClick={requestMinimize}>
              <span aria-hidden="true">-</span>
            </button>
            <button aria-label={`${window.maximized ? "Restore" : "Maximize"} ${windowTitle}`} onClick={() => toggleMaximize(window.id)}>
              <span aria-hidden="true">{window.maximized ? "□" : "▢"}</span>
            </button>
            <button aria-label={`Close ${windowTitle}`} onClick={() => requestCloseWindow(window, closeWindow)}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div className="window-content">{renderApp(window)}</div>
      </article>
    </Rnd>
  );
}

function renderApp(window: WindowState) {
  const RegisteredApp = appComponentRegistry[window.appId];
  if (RegisteredApp) return <RegisteredApp />;

  switch (window.appId) {
    case "files":
      return <FilesApp />;
    case "notes":
      return <NotesApp windowId={window.id} />;
    case "browser":
      return <BrowserApp />;
    case "calculator":
      return <CalculatorApp />;
    case "calendar":
      return <CalendarApp />;
    case "tasks":
      return <TasksApp />;
    case "timer":
      return <TimerApp />;
    case "palette":
      return <PaletteApp />;
    case "settings":
      return <SettingsApp />;
    case "terminal":
      return <TerminalApp />;
    case "task-manager":
      return <TaskManagerApp />;
    case "about":
      return <AboutApp />;
  }
}

function FilesApp() {
  const [section, setSection] = useState<"home" | "files" | "recent" | "trash">("home");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<FileSortMode>("updated");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileDraft, setNewFileDraft] = useState("Untitled.md");
  const files = useFsStore((state) => state.files);
  const loaded = useFsStore((state) => state.loaded);
  const selectedFileId = useFsStore((state) => state.selectedFileId);
  const selectFile = useFsStore((state) => state.selectFile);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const deleteSelectedFile = useFsStore((state) => state.deleteSelectedFile);
  const restoreSelectedFile = useFsStore((state) => state.restoreSelectedFile);
  const permanentlyDeleteSelectedFile = useFsStore((state) => state.permanentlyDeleteSelectedFile);
  const emptyTrash = useFsStore((state) => state.emptyTrash);
  const renameSelectedFile = useFsStore((state) => state.renameSelectedFile);
  const openApp = useDesktopStore((state) => state.openApp);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null;
  const activeFiles = files.filter((file) => !file.trashed);
  const trashedFiles = files.filter((file) => file.trashed);
  const effectiveSortMode = section === "recent" ? "updated" : sortMode;
  const visibleFiles = sortFiles(
    (section === "trash" ? trashedFiles : activeFiles).filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase())),
    effectiveSortMode,
  );
  const previewText = selectedFile?.content ?? "";
  const wordCount = previewText.trim() ? previewText.trim().split(/\s+/).length : 0;
  const charSetSize = new Set(previewText).size;

  async function commitNewFile() {
    if (!newFileDraft.trim()) {
      setCreatingFile(false);
      setNewFileDraft("Untitled.md");
      return;
    }
    const result = await createNamedFile(newFileDraft);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: result.error, type: "error" });
      return;
    }
    setCreatingFile(false);
    setNewFileDraft("Untitled.md");
    if (result.file) selectFile(result.file.id);
    addNotification({ title: t("fileCreated"), message: `${result.file?.name ?? t("newFile")}${t("createdSuffix")}`, type: "success" });
  }

  function startCreateFile() {
    setSection("files");
    setCreatingFile(true);
    setNewFileDraft("Untitled.md");
  }

  (globalThis as any).__files_start_create = startCreateFile;

  function startRename(fileToRename = selectedFile) {
    if (!fileToRename) return;
    selectFile(fileToRename.id);
    setRenamingFileId(fileToRename.id);
    setRenameDraft(fileToRename.name);
  }

  async function commitRename(fileToRename = selectedFile) {
    if (!fileToRename) return;
    if (renameDraft.trim() === fileToRename.name) {
      setRenamingFileId(null);
      return;
    }
    selectFile(fileToRename.id);
    const result = await renameSelectedFile(renameDraft);
    if (result.error) {
      window.alert(result.error);
      addNotification({
        title: t("renameFailed"),
        message: result.error,
        type: "error",
      });
    } else {
      setRenamingFileId(null);
      addNotification({
        title: t("fileRenamed"),
        message: phrase(t, "fileRenamedPrefix", renameDraft, "fileRenamedSuffix"),
        type: "success",
      });
    }
  }

  async function deleteSelected(fileToDelete = selectedFile) {
    if (!fileToDelete) return;
    selectFile(fileToDelete.id);
    if (!window.confirm(phrase(t, "confirmMoveToTrashPrefix", fileToDelete.name, "confirmMoveToTrashSuffix"))) return;
    await deleteSelectedFile();
    addNotification({
      title: t("movedToTrash"),
      message: `${fileToDelete.name}${t("canRestoreFromTrashSuffix")}`,
      type: "success",
    });
  }

  async function restoreSelected(fileToRestore = selectedFile) {
    if (!fileToRestore) return;
    selectFile(fileToRestore.id);
    await restoreSelectedFile();
    setSection("files");
    addNotification({ title: t("restore"), message: `${fileToRestore.name}${t("restoredSuffix")}`, type: "success" });
  }

  async function deleteForever(fileToDelete = selectedFile) {
    if (!fileToDelete) return;
    selectFile(fileToDelete.id);
    if (!window.confirm(phrase(t, "confirmPermanentDeletePrefix", fileToDelete.name, "confirmPermanentDeleteSuffix"))) return;
    await permanentlyDeleteSelectedFile();
    addNotification({ title: t("fileDeleted"), message: `${fileToDelete.name}${t("permanentlyDeletedSuffix")}`, type: "success" });
  }

  async function emptyTrashFromFiles() {
    if (!trashedFiles.length) return;
    if (!window.confirm(phrase(t, "confirmEmptyTrashPrefix", trashedFiles.length, "confirmEmptyTrashSuffix"))) return;
    await emptyTrash();
    addNotification({ title: t("trashEmptied"), message: t("trashEmptiedMessage"), type: "success" });
  }

  return (
    <div className="files-app app-grid">
      <aside className="app-sidebar">
        <NavItem icon="solar:home-2-bold-duotone" label={t("home")} active={section === "home"} onClick={() => setSection("home")} />
        <NavItem icon="solar:folder-with-files-bold-duotone" label={t("appFiles")} active={section === "files"} onClick={() => setSection("files")} />
        <NavItem icon="solar:clock-circle-bold-duotone" label={t("recent")} active={section === "recent"} onClick={() => setSection("recent")} />
        <NavItem icon="solar:trash-bin-trash-bold-duotone" label={`${t("trash")}${trashedFiles.length ? ` (${trashedFiles.length})` : ""}`} active={section === "trash"} onClick={() => setSection("trash")} />
      </aside>
      <section className="app-main">
        <div className="app-toolbar">
          <div>
            <h2>{section === "home" ? t("home") : section === "recent" ? t("recent") : section === "trash" ? t("trash") : t("appFiles")}</h2>
            <p>{section === "trash" ? `${trashedFiles.length} ${t("trash")}` : loaded ? `${activeFiles.length} ${t("filesCount")}` : t("mountingFs")}</p>
          </div>
          <div className="toolbar-actions">
            {section === "trash" ? (
              <>
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void restoreSelected()}>
                  <Icon icon="solar:undo-left-round-bold-duotone" width={16} height={16} />
                  {t("restore")}
                </button>
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void deleteForever()}>
                  <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={16} height={16} />
                  {t("deleteForever")}
                </button>
                <button className="button-primary" disabled={!trashedFiles.length} onClick={() => void emptyTrashFromFiles()}>
                  {t("emptyTrash")}
                </button>
              </>
            ) : (
              <>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => openApp("notes")}>
                  <Icon icon="solar:login-2-bold-duotone" width={16} height={16} />
                  {t("open")}
                </button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => startRename()}>
                  <Icon icon="solar:pen-new-square-bold-duotone" width={16} height={16} />
                  {t("rename")}
                </button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => void deleteSelected()}>
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width={16} height={16} />
                  {t("delete")}
                </button>
                <button className="button-primary" onClick={startCreateFile}>
                  <Icon icon="solar:add-circle-bold" width={16} height={16} />
                  {t("newFile")}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="file-controls">
          <label className="file-search">
            <Icon icon="solar:magnifer-bold-duotone" width={16} height={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchFiles")}
              spellCheck="false"
            />
          </label>
          <label className="file-sort">
            {t("sort")}
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as FileSortMode)}>
              <option value="updated">{t("updatedSort")}</option>
              <option value="name">{t("nameSort")}</option>
              <option value="size">{t("sizeSort")}</option>
            </select>
          </label>
        </div>
        <div className="file-list" data-context-kind="files-empty">
          {creatingFile ? (
            <div className="file-row file-row-new">
              <Icon icon="solar:document-add-bold-duotone" width={22} height={22} />
              <input
                className="file-rename-input"
                autoFocus
                value={newFileDraft}
                onChange={(event) => setNewFileDraft(event.target.value)}
                onBlur={(event) => {
                  if (event.currentTarget.dataset.cancelled === "true") return;
                  void commitNewFile();
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") void commitNewFile();
                  if (event.key === "Escape") {
                    event.currentTarget.dataset.cancelled = "true";
                    setCreatingFile(false);
                  }
                }}
              />
              <span>{t("newFileLabel")}</span>
              <span>0 B</span>
            </div>
          ) : null}
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              role="button"
              tabIndex={0}
              className={clsx("file-row", selectedFileId === file.id && "is-selected")}
              data-context-kind="file"
              data-context-id={file.id}
              onClick={() => selectFile(file.id)}
              onFocus={() => selectFile(file.id)}
              onDoubleClick={() => file.trashed ? void restoreSelected(file) : openApp("notes")}
              onKeyDown={(event) => {
                if (event.key === "Enter") file.trashed ? void restoreSelected(file) : openApp("notes");
                if (event.key === "F2" && !file.trashed) startRename(file);
                if (event.key === "Delete") file.trashed ? void deleteForever(file) : void deleteSelected(file);
              }}
            >
              <Icon icon="solar:document-text-bold-duotone" width={22} height={22} />
              {renamingFileId === file.id ? (
                <input
                  className="file-rename-input"
                  autoFocus
                  value={renameDraft}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={() => void commitRename(file)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") void commitRename(file);
                    if (event.key === "Escape") setRenamingFileId(null);
                  }}
                />
              ) : (
                <span className="file-name">{file.name}</span>
              )}
              <span>{formatFileTime(file.trashed ? file.deletedAt ?? file.updatedAt : file.updatedAt)}</span>
              <span>{formatFileSize(file.content)}</span>
            </div>
          ))}
          {loaded && visibleFiles.length === 0 ? (
            <div className="empty-state">
              <Icon icon="solar:document-add-bold-duotone" width={28} height={28} />
              <p>{section === "trash" ? t("trashEmpty") : activeFiles.length === 0 ? t("noFilesYet") : t("noFilesMatch")}</p>
            </div>
          ) : null}
        </div>
      </section>
      <aside className="file-details">
        <h3>{t("details")}</h3>
        {selectedFile ? (
          <>
            <strong>{selectedFile.name}</strong>
            <dl>
              <div><dt>{t("fileSize")}</dt><dd>{formatFileSize(selectedFile.content)}</dd></div>
              <div><dt>{t("words")}</dt><dd>{wordCount}</dd></div>
              <div><dt>{t("characters")}</dt><dd>{previewText.length}</dd></div>
              <div><dt>{t("charset")}</dt><dd>{charSetSize}</dd></div>
              <div><dt>{t("updated")}</dt><dd>{formatFileTime(selectedFile.updatedAt)}</dd></div>
              {selectedFile.trashed ? <div><dt>{t("deleted")}</dt><dd>{formatFileTime(selectedFile.deletedAt ?? selectedFile.updatedAt)}</dd></div> : null}
            </dl>
            <p>{t("preview")}</p>
            <pre>{previewText.slice(0, 520) || "(empty file)"}</pre>
          </>
        ) : (
          <div className="empty-state compact">
            <Icon icon="solar:document-text-bold-duotone" width={24} height={24} />
            <p>{t("noFileDetails")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function NotesApp({ windowId }: { windowId: string }) {
  const t = useLanguageStore((state) => state.t);
  const files = useFsStore((state) => state.files);
  const selectedFileId = useFsStore((state) => state.selectedFileId);
  const saveFileDraft = useFsStore((state) => state.saveFileDraft);
  const createFile = useFsStore((state) => state.createFile);
  const [localFileId, setLocalFileId] = useState<string | null>(() => selectedFileId);
  const selectedFile = files.find((file) => !file.trashed && file.id === localFileId) ?? files.find((file) => !file.trashed && file.id === selectedFileId) ?? null;
  const [draft, setDraft] = useState(() => selectedFile?.content ?? "");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
  const [dirty, setDirty] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    setNoteWindowDirty(windowId, dirty);
    return () => clearNoteWindowDirty(windowId);
  }, [windowId, dirty]);

  useEffect(() => {
    if (!selectedFile) return;
    if (!localFileId) setLocalFileId(selectedFile.id);
    if (!dirty) setDraft(selectedFile.content);
  }, [selectedFile?.id, selectedFile?.content, dirty, localFileId]);

  useEffect(() => {
    if (viewMode === "edit") return;
    let mounted = true;
    void Promise.all([import("marked"), import("dompurify")]).then(([markedModule, domPurifyModule]) => {
      if (!mounted) return;
      const html = markedModule.marked.parse(draft, { async: false }) as string;
      setPreviewHtml(domPurifyModule.default.sanitize(html));
    }).catch(() => {
      if (mounted) setPreviewHtml(`<p>${t("markdownPreviewUnavailable")}</p>`);
    });
    return () => {
      mounted = false;
    };
  }, [draft, t, viewMode]);

  function updateDraft(value: string) {
    setDraft(value);
    setDirty(true);
  }

  async function saveLocalDraft() {
    if (!selectedFile) return;
    await saveFileDraft(selectedFile.id, draft);
    setDirty(false);
  }

  return (
    <div className="notes-app">
      <div className="app-toolbar compact">
        <div>
          <h2>{selectedFile?.name ?? t("noFileSelected")}</h2>
          <p>{selectedFile ? (dirty ? t("notesUnsaved") : t("notesSaved")) : t("createFileToBegin")}</p>
        </div>
        <div className="toolbar-actions">
          <div className="notes-view-toggle">
            {(["edit", "preview", "split"] as const).map((mode) => (
              <button key={mode} className={clsx(viewMode === mode && "is-active")} onClick={() => setViewMode(mode)} type="button">
                {mode === "edit" ? t("edit") : mode === "preview" ? t("markdownPreview") : t("splitView")}
              </button>
            ))}
          </div>
          <button className="button-ghost" onClick={() => {
            setLocalFileId(null);
            void createFile();
          }}>
            {t("newFile")}
          </button>
          <button className="button-primary" disabled={!selectedFile || !dirty} onClick={() => void saveLocalDraft()}>
            {t("save")}
          </button>
        </div>
      </div>
      {selectedFile ? (
        <div className={clsx("notes-workspace", `mode-${viewMode}`)}>
          {viewMode !== "preview" ? <textarea spellCheck="false" value={draft} onChange={(event) => updateDraft(event.target.value)} /> : null}
          {viewMode !== "edit" ? <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} /> : null}
        </div>
      ) : (
        <div className="empty-state notes-empty">
          <Icon icon="solar:notes-bold-duotone" width={34} height={34} />
          <p>{t("noLocalTextSelected")}</p>
          <button className="button-primary" onClick={() => void createFile()}>{t("createFile")}</button>
        </div>
      )}
    </div>
  );
}

function BrowserApp() {
  const t = useLanguageStore((state) => state.t);
  const bookmarks = [
    ["Neko Wiki", "https://wiki.nekolaska.vip", "solar:book-2-bold-duotone"],
    ["Neko Games", "https://game.nekolaska.vip", "solar:gamepad-bold-duotone"],
    ["Search", "https://duckduckgo.com"],
    ["MDN", "https://developer.mozilla.org"],
    ["GitHub", "https://github.com"],
    ["Wikipedia", "https://wikipedia.org"],
  ] as const;
  const [history, setHistory] = useState<string[]>(["neko://home"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [address, setAddress] = useState("neko://home");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeSlow, setIframeSlow] = useState(false);
  const currentUrl = history[historyIndex] ?? "neko://home";
  const isHome = currentUrl === "neko://home";

  useEffect(() => {
    if (isHome) return;
    setIframeLoaded(false);
    setIframeSlow(false);
    const timer = window.setTimeout(() => setIframeSlow(true), 2600);
    return () => window.clearTimeout(timer);
  }, [currentUrl, isHome]);

  function normalizeAddress(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "neko://home") return "neko://home";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  function navigate(value: string) {
    const nextUrl = normalizeAddress(value);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextUrl]);
    setHistoryIndex((current) => current + 1);
    setAddress(nextUrl);
  }

  function go(delta: number) {
    setHistoryIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), history.length - 1);
      setAddress(history[next] ?? "neko://home");
      return next;
    });
  }

  return (
    <div className="browser-app">
      <form className="browser-toolbar" onSubmit={(event) => { event.preventDefault(); navigate(address); }}>
        <button type="button" className="browser-nav" disabled={historyIndex === 0} onClick={() => go(-1)}>←</button>
        <button type="button" className="browser-nav" disabled={historyIndex >= history.length - 1} onClick={() => go(1)}>→</button>
        <button type="button" className="browser-nav" onClick={() => navigate("neko://home")}>⌂</button>
        <label className="browser-address">
          <Icon icon="solar:link-bold-duotone" width={16} height={16} />
          <input value={address} onChange={(event) => setAddress(event.target.value)} spellCheck="false" />
        </label>
        <button className="button-primary" type="submit">{t("browserGo")}</button>
        <button className="button-ghost" type="button" disabled={isHome} onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserOpen")}</button>
      </form>
      <main className="browser-page">
        {isHome ? (
          <section className="browser-home">
            <div className="browser-home-hero">
              <div className="browser-orb"><Icon icon="solar:global-bold-duotone" width={48} height={48} /></div>
              <h2>{t("appBrowser")}</h2>
              <p>{t("browserHomeText")}</p>
            </div>
            <form className="browser-home-search" onSubmit={(event) => { event.preventDefault(); navigate(address); }}>
              <Icon icon="solar:magnifer-bold-duotone" width={18} height={18} />
              <input value={address === "neko://home" ? "" : address} onChange={(event) => setAddress(event.target.value)} placeholder={t("browserSearchPlaceholder")} spellCheck="false" />
              <button type="submit">{t("browserSearch")}</button>
            </form>
            <h3>{t("browserFrequent")}</h3>
            <div className="browser-bookmarks">
              {bookmarks.map(([label, url, icon]) => (
                <button key={url} onClick={() => navigate(url)}>
                  <Icon icon={icon ?? "solar:bookmark-bold-duotone"} width={22} height={22} />
                  <strong>{label}</strong>
                  <span>{url.replace(/^https?:\/\//, "")}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="browser-frame-shell">
            <iframe key={currentUrl} src={currentUrl} title={currentUrl} onLoad={() => setIframeLoaded(true)} />
            {iframeSlow && !iframeLoaded ? (
              <div className="browser-frame-notice">
                <Icon icon="solar:shield-warning-bold-duotone" width={34} height={34} />
                <h2>{t("browserBlocked")}</h2>
                <p>{currentUrl}</p>
                <button className="button-primary" onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}>{t("browserExternal")}</button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

  function press(key: string) {
    if (key === "C") {
      setDisplay("0");
      return;
    }
    if (key === "⌫") {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : "0");
      return;
    }
    if (key === "=") {
      if (!/^[\d+\-*/().\s]+$/.test(display)) return;
      try {
        const result = Function(`"use strict"; return (${display})`)();
        setDisplay(String(Number.isFinite(result) ? Math.round(result * 100000000) / 100000000 : "Error"));
      } catch {
        setDisplay("Error");
      }
      return;
    }
    setDisplay((current) => current === "0" || current === "Error" ? key : current + key);
  }

  return (
    <div className="calculator-app">
      <output>{display}</output>
      <div className="calculator-grid">
        <button className="calculator-wide" onClick={() => press("C")}>C</button>
        <button onClick={() => press("⌫")}>⌫</button>
        {keys.map((key) => <button key={key} className={key === "=" ? "is-equals" : undefined} onClick={() => press(key)}>{key}</button>)}
      </div>
    </div>
  );
}

function CalendarApp() {
  const t = useLanguageStore((state) => state.t);
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="calendar-app">
      <header>
        <button className="button-ghost" onClick={() => moveMonth(-1)}>{t("previous")}</button>
        <div>
          <h2>{cursor.toLocaleDateString("en", { month: "long", year: "numeric" })}</h2>
          <p>{today.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
        <button className="button-ghost" onClick={() => moveMonth(1)}>{t("next")}</button>
      </header>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
        {cells.map((day, index) => {
          const isToday = day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
          return <span key={`${day}-${index}`} className={clsx(day && "has-day", isToday && "is-today")}>{day}</span>;
        })}
      </div>
    </div>
  );
}

function readTasks(): LocalTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function TasksApp() {
  const [tasks, setTasks] = useState<LocalTask[]>(readTasks);
  const [draft, setDraft] = useState("");
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask() {
    const text = draft.trim();
    if (!text) return;
    setTasks((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, done: false }, ...current]);
    setDraft("");
  }

  return (
    <div className="tasks-app">
      <form className="tasks-form" onSubmit={(event) => { event.preventDefault(); addTask(); }}>
        <input value={draft} placeholder={t("tasksPlaceholder")} onChange={(event) => setDraft(event.target.value)} />
        <button className="button-primary" type="submit">{t("addTask")}</button>
      </form>
      <div className="tasks-summary">
        <span>{tasks.filter((task) => !task.done).length} {t("pending")}</span>
        <button className="button-ghost" onClick={() => setTasks((current) => current.filter((task) => !task.done))}>{t("clearDone")}</button>
      </div>
      <div className="tasks-list">
        {tasks.length ? tasks.map((task) => (
          <label key={task.id} className={clsx("task-item", task.done && "is-done")}>
            <input type="checkbox" checked={task.done} onChange={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />
            <span>{task.text}</span>
            <button type="button" onClick={(event) => { event.preventDefault(); setTasks((current) => current.filter((item) => item.id !== task.id)); }}>×</button>
          </label>
        )) : <div className="empty-state"><p>{t("noTasks")}</p></div>}
      </div>
    </div>
  );
}

function TimerApp() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="timer-app">
      <section>
        <span>{t("localTime")}</span>
        <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
      </section>
      <section>
        <span>{t("stopwatch")}</span>
        <strong>{minutes}:{seconds}</strong>
        <div className="timer-actions">
          <button className="button-primary" onClick={() => setRunning((current) => !current)}>{running ? t("pause") : t("start")}</button>
          <button className="button-ghost" onClick={() => { setRunning(false); setElapsed(0); }}>{t("reset")}</button>
        </div>
      </section>
    </div>
  );
}

function PaletteApp() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);

  async function copyColor(color: string) {
    try {
      await navigator.clipboard.writeText(color);
      addNotification({ title: t("copiedToken"), message: `${color}${t("copiedTokenSuffix")}`, type: "success" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error" });
    }
  }

  return (
    <div className="palette-app">
      {PALETTE_COLORS.map(([name, color]) => (
        <button key={color} className="palette-swatch" onClick={() => void copyColor(color)}>
          <span style={{ background: color }} />
          <strong>{name}</strong>
          <small>{color}</small>
        </button>
      ))}
    </div>
  );
}

function SettingsApp() {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(readThemeSettings);
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const resetVirtualFiles = useFsStore((state) => state.resetVirtualFiles);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
  }, []);

  // Apply theme settings classes to html/body elements
  useEffect(() => {
    applyThemeSettings(themeSettings);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeSettings));
  }, [themeSettings]);

  async function clearCacheStorage() {
    if (!("caches" in window)) {
      addNotification({ title: t("cacheUnavailable"), message: t("cacheUnavailableMessage"), type: "warning" });
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("cacheCleared"), message: phrase(t, "cacheClearedPrefix", keys.length, "cacheClearedSuffix"), type: "success" });
  }

  async function resetLocalFiles() {
    if (!window.confirm(t("confirmResetFiles"))) return;
    await resetVirtualFiles();
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    addNotification({ title: t("virtualStorageReset"), message: t("virtualStorageResetMessage"), type: "success" });
  }

  async function clearSiteData() {
    if (!window.confirm(t("confirmClearSiteData"))) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    localStorage.clear();
    resetWindowLayout();
    await resetVirtualFiles();
    addNotification({ title: t("siteDataCleared"), message: t("siteDataClearedMessage"), type: "success" });
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function setWallpaper(wallpaperId: ThemeSettings["wallpaperId"]) {
    const wallpaper = WALLPAPERS[wallpaperId];
    if (wallpaper.url) {
      const url = wallpaper.url;
      const loaded = await new Promise<boolean>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
      });
      if (!loaded) {
        addNotification({ title: t("wallpaperLoadFailed"), message: t("wallpaperLoadFailedMessage"), type: "warning" });
        return;
      }
    }
    setThemeSettings((prev: ThemeSettings) => ({ ...prev, wallpaperId }));
    addNotification({
      title: t("wallpaperChanged"),
      message: phrase(t, "wallpaperChangedPrefix", t(wallpaper.labelKey), "wallpaperChangedSuffix"),
      type: "info",
    });
  }

  const effectiveTheme = resolveThemeMode(themeSettings.theme);
  const tokens = [
    ["Primary", `oklch(0.520 0.145 ${ACCENT_HUES[themeSettings.accentColor]})`, "kernel"],
    ["Accent", `oklch(${effectiveTheme === "dark" ? "0.760" : "0.650"} 0.115 ${ACCENT_HUES[themeSettings.accentColor]})`, "focus"],
    ["Panel", effectiveTheme === "dark" ? "oklch(0.190 0.010 255)" : "oklch(0.910 0.012 255)", "surface"],
  ];

  return (
    <div className="settings-app">
      <section className="settings-hero">
        <Icon icon="solar:cat-bold-duotone" width={42} height={42} />
        <div>
          <h2>{t("settingsHeroTitle")}</h2>
          <p>{t("settingsHeroDescription")}</p>
        </div>
      </section>

      <h3 className="settings-section-title">{t("settingsLanguage")}</h3>
      <div className="settings-select-group">
        {(["zh", "en"] as const).map((lang) => (
          <button
            key={lang}
            className={clsx("settings-btn-pill", language === lang && "is-active")}
            onClick={() => {
              setLanguage(lang);
              const nextT = useLanguageStore.getState().t;
              addNotification({
                title: nextT("languageChanged"),
                message: lang === "zh" ? nextT("languageChangedZhMessage") : nextT("languageChangedEnMessage"),
                type: "info",
              });
            }}
          >
            {lang === "zh" ? t("languageChinese") : t("languageEnglish")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsTheme")}</h3>
      <div className="settings-select-group">
        {(["system", "light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            className={clsx("settings-btn-pill", themeSettings.theme === mode && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, theme: mode }));
              addNotification({
                title: t("themeChanged"),
                message: phrase(t, "themeChangedPrefix", mode === "system" ? t("colorSystem") : mode === "light" ? t("colorLight") : t("colorDark"), "themeChangedSuffix"),
                type: "info",
              });
            }}
          >
            {mode === "system" ? t("colorSystem") : mode === "light" ? t("colorLight") : t("colorDark")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsAccent")}</h3>
      <div className="settings-select-group">
        {(["blue", "purple", "emerald", "amber"] as const).map((color) => (
          <button
            key={color}
            className={clsx("settings-btn-pill", themeSettings.accentColor === color && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, accentColor: color }));
              addNotification({
                title: t("accentUpdated"),
                message: phrase(t, "accentUpdatedPrefix", color, "accentUpdatedSuffix"),
                type: "info",
              });
            }}
          >
            {color.charAt(0).toUpperCase() + color.slice(1)}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsWallpaper")}</h3>
      <div className="wallpaper-grid">
        {(Object.entries(WALLPAPERS) as [ThemeSettings["wallpaperId"], (typeof WALLPAPERS)[ThemeSettings["wallpaperId"]]][]).map(([id, wallpaper]) => (
          <button
            key={id}
            className={clsx("wallpaper-option", themeSettings.wallpaperId === id && "is-active")}
            onClick={() => void setWallpaper(id)}
            style={wallpaper.url ? { backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0.08), oklch(0 0 0 / 0.44)), url("${wallpaper.url}")` } : undefined}
          >
            <span>{t(wallpaper.labelKey)}</span>
            <small>{wallpaper.source === "unsplash" ? t("wallpaperSourceUnsplash") : t("wallpaperSourceBuiltIn")}</small>
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsDensity")}</h3>
      <div className="settings-select-group">
        {(["cozy", "compact"] as const).map((d) => (
          <button
            key={d}
            className={clsx("settings-btn-pill", themeSettings.density === d && "is-active")}
            onClick={() => {
              setThemeSettings((prev: ThemeSettings) => ({ ...prev, density: d }));
              addNotification({
                title: t("densitySwitched"),
                message: phrase(t, "densitySwitchedPrefix", d === "cozy" ? t("densityCozy") : t("densityCompact"), "densitySwitchedSuffix"),
                type: "info",
              });
            }}
          >
            {d === "cozy" ? t("densityCozy") : t("densityCompact")}
          </button>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsTokens")}</h3>
      <div className="settings-list">
        {tokens.map(([label, value, role]) => (
          <div key={label} className="settings-row">
            <span className={clsx("swatch", `swatch-${role}`)} />
            <div>
              <strong>{label}</strong>
              <p>{value}</p>
            </div>
            <button
              className="button-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value);
                  addNotification({
                    title: t("copiedToken"),
                    message: `${label}${t("copiedTokenSuffix")}`,
                    type: "success",
                  });
                } catch {
                  addNotification({
                    title: t("copyFailed"),
                    message: t("copyFailedMessage"),
                    type: "error",
                  });
                }
              }}
            >
              {t("copy")}
            </button>
          </div>
        ))}
      </div>

      <h3 className="settings-section-title">{t("settingsData")}</h3>
      <div className="settings-list">
        <div className="settings-row data-row">
          <span className="swatch swatch-surface" />
          <div>
            <strong>{t("dataOriginStorage")}</strong>
            <p>{getStorageLabel(storage)}</p>
          </div>
          <button className="button-ghost" onClick={() => void clearCacheStorage()}>{t("clearCache")}</button>
        </div>
        <div className="settings-row data-row">
          <span className="swatch swatch-focus" />
          <div>
            <strong>{t("virtualFiles")}</strong>
            <p>{t("virtualFilesDescription")}</p>
          </div>
          <button className="button-ghost" onClick={() => void resetLocalFiles()}>{t("resetFiles")}</button>
        </div>
        <div className="settings-row data-row danger-row">
          <span className="swatch swatch-danger" />
          <div>
            <strong>{t("siteData")}</strong>
            <p>{t("siteDataDescription")}</p>
          </div>
          <button className="button-ghost" onClick={() => void clearSiteData()}>{t("clearSiteData")}</button>
        </div>
      </div>
    </div>
  );
}

function TerminalApp() {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<string[]>([
    "boot --quiet",
    "loading window-manager... ok",
    "mounting indexeddb://local-fs... ok",
    "type `help` to list commands",
  ]);
  const files = useFsStore((state) => state.files);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const deleteFileByName = useFsStore((state) => state.deleteFileByName);
  const renameFileByName = useFsStore((state) => state.renameFileByName);
  const selectFileByName = useFsStore((state) => state.selectFileByName);
  const openApp = useDesktopStore((state) => state.openApp);
  const t = useLanguageStore((state) => state.t);

  async function runCommand(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setLines([]);
      setCommand("");
      return;
    }

    const output = await executeTerminalCommand(trimmed, {
      files,
      createNamedFile,
      deleteFileByName,
      renameFileByName,
      selectFileByName,
      openNotes: () => openApp("notes"),
    });

    setLines((current) => [...current, `neko@virt-os:~$ ${trimmed}`, ...(output || [])]);
    setCommand("");
  }

  return (
    <div className="terminal-app" aria-label={t("terminalOutput")}>
      <div className="terminal-lines">
        {lines.map((line, index) => (
          <p key={`${line}-${index}`} className={line.startsWith("neko@virt-os") ? "terminal-prompt-line" : undefined}>
            {line}
          </p>
        ))}
      </div>
      <form
        className="terminal-input-line"
        onSubmit={(event) => {
          event.preventDefault();
          void runCommand(command);
        }}
      >
        <span>neko@virt-os:~$</span>
        <input
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
      </form>
    </div>
  );
}

type TerminalContext = {
  files: FsFile[];
  createNamedFile: (name: string) => Promise<FileMutationResult>;
  deleteFileByName: (name: string) => Promise<FsFile | null>;
  renameFileByName: (fromName: string, toName: string) => Promise<FileMutationResult>;
  selectFileByName: (name: string) => FsFile | null;
  openNotes: () => void;
};

async function executeTerminalCommand(command: string, context: TerminalContext) {
  const [verb, ...args] = splitCommand(command);
  const filename = args.join(" ");

  switch (verb) {
    case "ls":
      return context.files.length
        ? context.files.map((file) => `${file.name.padEnd(22, " ")} ${formatFileSize(file.content).padStart(7, " ")}  ${formatFileTime(file.updatedAt)}`)
        : ["no files found"];
    case "cat": {
      if (!filename) return ["usage: cat <file>"];
      const file = findFileByName(context.files, filename);
      if (!file) return [`cat: ${filename}: no such file`];
      return file.content ? file.content.split("\n") : ["(empty file)"];
    }
    case "touch": {
      if (!filename) return ["usage: touch <file>"];
      const result = await context.createNamedFile(filename);
      if (result.error) return [`touch: ${result.error}`];
      return result.file ? [`created or selected ${result.file.name}`] : ["touch: create failed"];
    }
    case "pwd":
      return ["nya://local/home"];
    case "date":
      return [new Date().toString()];
    case "curl":
      return runCurl(args);
    case "rm": {
      if (!filename) return ["usage: rm <file>"];
      const deleted = await context.deleteFileByName(filename);
      return deleted ? [`moved ${deleted.name} to Trash`] : [`rm: ${filename}: no such file`];
    }
    case "mv":
    case "rename": {
      const [fromName, toName, ...extra] = args;
      if (!fromName || !toName || extra.length) return [`usage: ${verb} <from> <to>`];
      const result = await context.renameFileByName(fromName, toName);
      if (result.error) return [`${verb}: ${result.error}`];
      return result.file ? [`renamed ${fromName} -> ${result.file.name}`] : [`${verb}: rename failed`];
    }
    case "open": {
      if (!filename) return ["usage: open <file>"];
      const file = context.selectFileByName(filename);
      if (!file) return [`open: ${filename}: no such file`];
      context.openNotes();
      return [`opened ${file.name} in Notes`];
    }
    case "theme":
      return ["Quiet Neko Workstation", "primary: oxblood kernel", "accent: neko focus rose", "surface: midnight desktop"];
    case "help": {
      const sub = args[0];
      if (sub) {
        switch (sub) {
          case "ls": return ["ls - List virtual files inside local IndexedDB."];
          case "cat": return ["cat <file> - Print content of a file."];
          case "touch": return ["touch <file> - Create a text file or update its modified date."];
          case "rm": return ["rm <file> - Move a text file to Trash."];
          case "mv": return ["mv <from> <to> - Rename an existing file."];
          case "open": return ["open <file> - Load a text file and bring up the Notes app."];
          case "theme": return ["theme - Print details about system design aesthetic."];
          case "pwd": return ["pwd - Print name of current virtual working directory."];
          case "date": return ["date - Display current local clock time."];
          case "curl": return ["curl <url> - Fetch an HTTP(S) URL and print the text response. Subject to browser CORS rules."];
          default: return [`No help topic found for '${sub}'`];
        }
      }
      return [
        "available commands:",
        "  ls                 list local files",
        "  cat <file>         print file content",
        "  touch <file>       create a text file",
        "  rm <file>          move a text file to Trash",
        "  mv <from> <to>     rename a text file",
        "  open <file>        select a file and open Notes",
        "  curl <url>         fetch an HTTP(S) URL",
        "  pwd                print working directory",
        "  date               print current date/time",
        "  theme              print current design theme",
        "  clear              clear terminal output",
        "",
        "Type `help <cmd>` to get detailed info on a command."
      ];
    }
  }
}

async function runCurl(args: string[]) {
  const urlArg = args.find((arg) => !arg.startsWith("-"));
  if (!urlArg) return ["usage: curl <url>"];

  let url: URL;
  try {
    url = new URL(urlArg.includes("://") ? urlArg : `https://${urlArg}`);
  } catch {
    return [`curl: invalid URL: ${urlArg}`];
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return ["curl: only http:// and https:// URLs are supported"];
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const contentType = response.headers.get("content-type") ?? "unknown";
    const text = await response.text();
    const body = text.length > 8000 ? `${text.slice(0, 8000)}\n... truncated ...` : text;
    return [
      `HTTP ${response.status} ${response.statusText}`.trim(),
      `content-type: ${contentType}`,
      "",
      ...(body ? body.split("\n") : ["(empty response)"]),
    ];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return ["curl: request timed out after 10s"];
    return ["curl: request failed. The browser may have blocked it with CORS, mixed-content, or network rules."];
  } finally {
    window.clearTimeout(timeout);
  }
}

function splitCommand(command: string) {
  const matches = command.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g);
  return Array.from(matches, (match) => match[1] ?? match[2] ?? match[3]);
}

function TaskManagerApp() {
  const t = useLanguageStore((state) => state.t);
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const files = useFsStore((state) => state.files);
  const [activeTab, setActiveTab] = useState<"processes" | "performance" | "history">("processes");
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
    const interval = setInterval(() => {
      setTick(Date.now());
      navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const memory = (performance as BrowserPerformance).memory;
  const uptime = Math.max(1, Math.floor((tick - performance.timeOrigin) / 1000));
  const appMemory = memory ? formatBytes(memory.usedJSHeapSize) : "Unavailable";
  const appLimit = memory ? formatBytes(memory.jsHeapSizeLimit) : "Unavailable";
  const deviceRows = getDeviceRows(storage, deviceInfo, t);
  const processRows = windows
    .slice()
    .sort((a, b) => b.z - a.z)
    .map((window) => {
      const app = apps.find((item) => item.id === window.appId);
      return {
        ...window,
        icon: getAppIcon(window.appId, window.icon),
        description: app ? t(appDescriptionKeys[app.id]) : "Neko process",
        status: window.minimized ? "Suspended" : activeWindowId === window.id ? "Active" : "Background",
        footprint: `${Math.max(12, Math.round((window.width * window.height) / 26000))} UI units`,
      };
    });
  const appHistoryRows = apps.map((app) => ({
    ...app,
    windows: windows.filter((window) => window.appId === app.id).length,
    status: windows.some((window) => window.appId === app.id && !window.minimized) ? "Running" : windows.some((window) => window.appId === app.id) ? "Suspended" : "Closed",
  }));

  return (
    <div className="task-manager-app">
      <aside className="task-manager-sidebar">
        <button className={clsx("task-manager-tab", activeTab === "processes" && "is-active")} onClick={() => setActiveTab("processes")}><Icon icon="solar:widget-5-bold-duotone" width={17} height={17} /> Processes</button>
        <button className={clsx("task-manager-tab", activeTab === "performance" && "is-active")} onClick={() => setActiveTab("performance")}><Icon icon="solar:graph-up-bold-duotone" width={17} height={17} /> Performance</button>
        <button className={clsx("task-manager-tab", activeTab === "history" && "is-active")} onClick={() => setActiveTab("history")}><Icon icon="solar:database-bold-duotone" width={17} height={17} /> App history</button>
      </aside>
      <main className="task-manager-main">
        <header className="task-manager-header">
          <div>
            <h2>{t("appTaskManager")}</h2>
            <p>{windows.length} running windows, {files.length} local files, uptime {Math.floor(uptime / 60)}m {uptime % 60}s</p>
          </div>
          <div className="task-manager-metrics">
            <span><strong>{navigator.hardwareConcurrency || "-"}</strong> threads</span>
            <span><strong>{appMemory}</strong> JS heap</span>
            <span><strong>{formatBytes(storage?.usage)}</strong> origin storage</span>
          </div>
        </header>

        {activeTab !== "history" ? <section className="performance-grid" aria-label={t("performanceSummary")}>
          <article>
            <span>CPU</span>
            <strong>{navigator.hardwareConcurrency || "Unavailable"} threads</strong>
            <p>Logical processors</p>
          </article>
          <article>
            <span>JS Heap</span>
            <strong>{appMemory}</strong>
            <p>{appLimit} limit</p>
          </article>
          <article>
            <span>Origin Storage</span>
            <strong>{formatBytes(storage?.usage)}</strong>
            <p>{formatBytes(storage?.quota)} quota</p>
          </article>
          <article>
            <span>Display</span>
            <strong>{window.screen.width} x {window.screen.height}</strong>
            <p>{window.devicePixelRatio.toFixed(2)}x pixel ratio</p>
          </article>
        </section> : null}

        {activeTab === "processes" ? <section className="process-table" aria-label={t("runningProcesses")}>
          <div className="process-row process-head">
            <span>Name</span>
            <span>Status</span>
            <span>Footprint</span>
            <span>Actions</span>
          </div>
          {processRows.map((process) => (
            <div key={process.id} className={clsx("process-row", activeWindowId === process.id && !process.minimized && "is-active")}>
              <span className="process-name"><Icon icon={process.icon} width={18} height={18} /><span><strong>{process.title}</strong><small>{process.description}</small></span></span>
              <span>{process.status}</span>
              <span>{process.footprint}</span>
              <span className="process-actions">
                <button onClick={() => process.minimized ? restoreWindow(process.id) : focusWindow(process.id)}>{process.minimized ? "Restore" : "Switch"}</button>
                <button disabled={process.minimized} onClick={() => minimizeWindow(process.id)}>{process.minimized ? "Minimized" : "Minimize"}</button>
                <button className="danger" onClick={() => requestCloseWindow(process, closeWindow)}>End task</button>
              </span>
            </div>
          ))}
        </section> : null}

        {activeTab === "performance" ? <section className="device-table" aria-label={t("deviceDetails")}>
          {deviceRows.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong title={value}>{value}</strong></div>
          ))}
        </section> : null}

        {activeTab === "history" ? <section className="process-table" aria-label={t("applicationHistory")}>
          <div className="process-row process-head app-history-row">
            <span>Application</span>
            <span>Status</span>
            <span>Windows</span>
            <span>Default Size</span>
          </div>
          {appHistoryRows.map((app) => (
            <div key={app.id} className="process-row app-history-row">
              <span className="process-name"><Icon icon={app.icon} width={18} height={18} /><span><strong>{t(appTitleKeys[app.id])}</strong><small>{t(appDescriptionKeys[app.id])}</small></span></span>
              <span>{app.status}</span>
              <span>{app.windows}</span>
              <span>{app.defaultSize.width} x {app.defaultSize.height}</span>
            </div>
          ))}
        </section> : null}
      </main>
    </div>
  );
}

function AboutApp() {
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
  }, []);

  const rows = getDeviceRows(storage, deviceInfo, t);

  return (
    <div className="about-app">
      <div className="about-header">
        <div className="about-mark">
          <Icon icon="solar:cat-bold-duotone" width={54} height={54} />
        </div>
        <div>
          <h2>NekoVirtOS</h2>
          <p>{t("systemInfo")}</p>
        </div>
      </div>
      <dl>
        <div><dt>{t("edition")}</dt><dd>NekoVirtOS Web</dd></div>
        <div><dt>{t("interface")}</dt><dd>Quiet Workstation</dd></div>
        <div><dt>{t("storageMode")}</dt><dd>Local-first</dd></div>
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function NavItem({ icon, label, active = false, disabled = false, onClick }: { icon: string; label: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button className={clsx("nav-item", active && "is-active")} disabled={disabled} onClick={onClick} title={disabled ? `${label} is not available yet` : undefined}>
      <Icon icon={icon} width={18} height={18} />
      {label}
    </button>
  );
}
