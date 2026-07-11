import { Icon } from "@iconify-icon/react";
import { Rnd } from "react-rnd";
import { clsx } from "clsx";
import { flushSync } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { apps } from "./apps";
import { useFsStore } from "./fsStore";
import { useNotificationStore } from "./notificationStore";
import { useLanguageStore, type TranslationKey } from "./languageStore";
import { snapWindowBounds, useDesktopStore } from "./windowStore";
import { appDescriptionKeys, appTitleKeys, getAppIcon } from "./appText";
import { appComponentRegistry } from "./appRegistry";
import { clampDesktopIconPosition, getDesktopBoundsSize, getDesktopGridPosition, layoutItemsOnDesktopGrid, snapDesktopIconPosition } from "./desktopLayout";
import { translateFileError } from "./fileErrorUtils";
import { applyThemeSettings, readThemeSettings, THEME_STORAGE_KEY } from "./theme";
import { requestCloseWindow } from "./notesWindowState";
import { DesktopWidgets } from "./components/DesktopWidgets";
import { Launcher } from "./components/Launcher";
import { NotificationOverlay } from "./components/NotificationOverlay";
import { Taskbar } from "./components/Taskbar";
import { WindowSwitcher } from "./components/WindowSwitcher";
import { getFileOpenApp } from "./fileOpen";
import { useOsUiStore } from "./osUiStore";
import type { AppId, ContextMenuState, DesktopLayoutMode, WindowState, WorkspaceId } from "./types";

const CommandPalette = lazy(() => import("./components/CommandPalette").then((module) => ({ default: module.CommandPalette })));

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
  const activeWorkspace = useOsUiStore((state) => state.activeWorkspace);
  const initFs = useFsStore((state) => state.init);
  const t = useLanguageStore((state) => state.t);
  const workspaceWindows = windows.filter((window) => (window.workspaceId ?? 0) === activeWorkspace);
  const switcherWindows = workspaceWindows.slice().sort((a, b) => b.z - a.z);

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
        {workspaceWindows.map((window) => (
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
  const [desktopDragTarget, setDesktopDragTarget] = useState<string | null>(null);
  const [desktopInvalidDragTarget, setDesktopInvalidDragTarget] = useState<string | null>(null);
  const [draggingIconIds, setDraggingIconIds] = useState<string[]>([]);
  const [desktopBounds, setDesktopBounds] = useState({ width: 1200, height: 700 });
  const desktopIconsRef = useRef<HTMLDivElement | null>(null);
  const openApp = useDesktopStore((state) => state.openApp);
  const updateDesktopIconPosition = useDesktopStore((state) => state.updateDesktopIconPosition);
  const desktopLayoutMode = useDesktopStore((state) => state.desktopLayoutMode);
  const setDesktopLayoutMode = useDesktopStore((state) => state.setDesktopLayoutMode);
  const desktopIconPositions = useDesktopStore((state) => state.desktopIconPositions);
  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const deleteSelectedFile = useFsStore((state) => state.deleteSelectedFile);
  const deleteFileById = useFsStore((state) => state.deleteFileById);
  const moveFileById = useFsStore((state) => state.moveFileById);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const desktopApps: AppId[] = ["files", "notes", "browser", "calculator", "calendar", "tasks", "timer", "palette", "mmd-studio", "settings", "task-manager", "about"];
  const [pinnedDesktopApps, setPinnedDesktopApps] = useState<AppId[]>(desktopApps);
  const [hiddenDesktopApps, setHiddenDesktopApps] = useState<AppId[]>([]);
  const desktopFiles = files.filter((file) => !file.trashed && (file.parentId ?? null) === null).slice(0, 4);

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
  const desktopItemIdsKey = [
    ...visibleApps.map((id) => `app:${id}`),
    ...desktopFiles.map((file) => `file:${file.id}`),
  ].join("|");
  const desktopItemIds = useMemo(
    () => (desktopItemIdsKey ? desktopItemIdsKey.split("|") : []),
    [desktopItemIdsKey],
  );

  useLayoutEffect(() => {
    const node = desktopIconsRef.current;
    if (!node) return;

    function measure() {
      const next = getDesktopBoundsSize(node);
      setDesktopBounds((current) => (
        current.width === next.width && current.height === next.height ? current : next
      ));
    }

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function getDesktopItemIds() {
    return desktopItemIds;
  }

  function getIconPosition(itemId: string, index: number, bounds = desktopBounds) {
    const saved = desktopIconPositions[itemId];
    if (desktopLayoutMode === "free" || draggingIconIds.includes(itemId)) {
      return clampDesktopIconPosition(saved ?? getDesktopGridPosition(index, bounds), bounds);
    }
    return snapDesktopIconPosition(saved ?? getDesktopGridPosition(index, bounds), bounds);
  }

  function applyGridLayout(
    itemIds: string[],
    seedPositions: Record<string, { x: number; y: number } | undefined>,
    bounds = desktopBounds,
  ) {
    const laidOut = layoutItemsOnDesktopGrid(itemIds, seedPositions, bounds);
    Object.entries(laidOut).forEach(([id, position]) => {
      updateDesktopIconPosition(id, position.x, position.y);
    });
    return laidOut;
  }

  // Repair overlaps / out-of-bounds cells whenever the grid geometry or item set changes.
  useEffect(() => {
    if (desktopLayoutMode !== "grid" || draggingIconIds.length) return;
    if (!desktopItemIds.length) return;

    const seeds = Object.fromEntries(
      desktopItemIds.map((id, index) => [id, desktopIconPositions[id] ?? getDesktopGridPosition(index, desktopBounds)]),
    );
    const laidOut = layoutItemsOnDesktopGrid(desktopItemIds, seeds, desktopBounds);
    const needsWrite = desktopItemIds.some((id) => {
      const current = desktopIconPositions[id];
      const next = laidOut[id];
      return !current || current.x !== next.x || current.y !== next.y;
    });
    if (!needsWrite) return;
    Object.entries(laidOut).forEach(([id, position]) => {
      updateDesktopIconPosition(id, position.x, position.y);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reflow on geometry/item-set/mode, not every position write
  }, [desktopBounds.width, desktopBounds.height, desktopItemIdsKey, desktopLayoutMode, draggingIconIds.length]);

  function setLayoutMode(mode: DesktopLayoutMode) {
    if (mode === "grid") {
      const bounds = getDesktopBoundsSize(desktopIconsRef.current);
      setDesktopBounds(bounds);
      const itemIds = getDesktopItemIds();
      const seeds = Object.fromEntries(
        itemIds.map((id, index) => [id, desktopIconPositions[id] ?? getDesktopGridPosition(index, bounds)]),
      );
      applyGridLayout(itemIds, seeds, bounds);
    }
    setDesktopLayoutMode(mode);
    addNotification({
      title: mode === "grid" ? t("desktopGridMode") : t("desktopFreeMode"),
      message: mode === "grid" ? t("desktopGridModeMessage") : t("desktopFreeModeMessage"),
      type: "info",
      category: "system",
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
                filesToDelete.map(async (f) => deleteFileById(f.id))
              ).then(() => {
                (globalThis as any).__desktop_state?.addNotification({
                  title: t("filesDeleted"),
                message: phrase(t, "filesDeletedPrefix", filesToDelete.length, "filesDeletedSuffix"),
                type: "success",
                category: "files",
                appId: "files",
              });
            });
            setSelectedDesktopItems([]);
          }
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedDesktopItems, files, deleteFileById]);

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

    const dragBounds = getDesktopBoundsSize(desktopIconsRef.current);
    setDesktopBounds(dragBounds);

    const initialPositions = nextSelected.reduce((acc, id) => {
      const index = Math.max(0, desktopItems.findIndex((item) => item.id === id));
      // Use stored/free coords as drag origin (not re-snapped mid-interaction).
      acc[id] = clampDesktopIconPosition(
        desktopIconPositions[id] ?? getDesktopGridPosition(index, dragBounds),
        dragBounds,
      );
      return acc;
    }, {} as Record<string, { x: number; y: number }>);

    let hasDragged = false;
    const livePositions: Record<string, { x: number; y: number }> = {};
    const draggedFileIds = nextSelected.filter((id) => id.startsWith("file:")).map((id) => id.replace("file:", ""));
    let lastPointer = { x: startX, y: startY };

    function getDesktopDropTarget(clientX: number, clientY: number) {
      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (!target) return { kind: "none" as const, targetId: null };
      const icon = target.closest<HTMLElement>("[data-desktop-file-id]");
      if (icon) {
        const folderId = icon.dataset.desktopFileId ?? null;
        const folder = files.find((file) => file.id === folderId) ?? null;
        if (folder?.kind === "folder") return { kind: "folder" as const, targetId: folder.id };
        return { kind: "invalid" as const, targetId: folderId };
      }
      if (target.closest(".desktop-icons") || target.closest(".desktop")) return { kind: "root" as const, targetId: null };
      return { kind: "none" as const, targetId: null };
    }

    function handleMouseMove(e: globalThis.MouseEvent) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      lastPointer = { x: e.clientX, y: e.clientY };

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        if (!hasDragged) setDraggingIconIds(nextSelected);
        hasDragged = true;
      }

      if (hasDragged) {
        if (draggedFileIds.length) {
          const dropTarget = getDesktopDropTarget(e.clientX, e.clientY);
          if (dropTarget.kind === "folder") {
            setDesktopDragTarget(`desktop:${dropTarget.targetId}`);
            setDesktopInvalidDragTarget(null);
          } else if (dropTarget.kind === "root") {
            setDesktopDragTarget("desktop-root");
            setDesktopInvalidDragTarget(null);
          } else if (dropTarget.kind === "invalid") {
            setDesktopDragTarget(null);
            setDesktopInvalidDragTarget(`desktop:${dropTarget.targetId}`);
          } else {
            setDesktopDragTarget(null);
            setDesktopInvalidDragTarget(null);
          }
        }
        nextSelected.forEach((id) => {
          const initPos = initialPositions[id];
          if (initPos) {
            const nextPosition = clampDesktopIconPosition({ x: initPos.x + deltaX, y: initPos.y + deltaY }, dragBounds);
            livePositions[id] = nextPosition;
            updateDesktopIconPosition(id, nextPosition.x, nextPosition.y);
          }
        });
      }
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setDraggingIconIds([]);

      if (!hasDragged && !isCtrl) {
        setSelectedDesktopItems([itemId]);
      }

      let movedIntoFolder = false;
      if (hasDragged && draggedFileIds.length) {
        const dropTarget = getDesktopDropTarget(lastPointer.x, lastPointer.y);
        if (dropTarget.kind === "folder") {
          movedIntoFolder = true;
          const parentId = dropTarget.targetId;
          void Promise.all(draggedFileIds.map((fileId) => moveFileById(fileId, parentId))).then((results) => {
            const firstError = results.find((result) => result.error)?.error;
            if (firstError) {
              addNotification({ title: t("moveFailed"), message: translateFileError(firstError, t), type: "error", category: "files", appId: "files" });
              if (desktopLayoutMode === "grid") {
                const dropBounds = getDesktopBoundsSize(desktopIconsRef.current);
                const itemIds = getDesktopItemIds();
                const seeds: Record<string, { x: number; y: number } | undefined> = { ...desktopIconPositions };
                nextSelected.forEach((id) => {
                  seeds[id] = livePositions[id] ?? initialPositions[id] ?? seeds[id];
                });
                applyGridLayout(itemIds, seeds, dropBounds);
              }
              return;
            }
            const movedCount = results.filter((result) => result.file).length;
            if (movedCount) {
              addNotification({ title: t("itemMoved"), message: `${movedCount} ${t("itemsCount")}`, type: "success", category: "files", appId: "files" });
            }
            if (desktopLayoutMode === "grid") {
              const dropBounds = getDesktopBoundsSize(desktopIconsRef.current);
              const remainingIds = getDesktopItemIds().filter((id) => !draggedFileIds.some((fileId) => id === `file:${fileId}`));
              applyGridLayout(remainingIds, { ...desktopIconPositions }, dropBounds);
            }
          });
        } else if (dropTarget.kind === "root") {
          void Promise.all(draggedFileIds.map((fileId) => moveFileById(fileId, null))).then((results) => {
            const firstError = results.find((result) => result.error)?.error;
            if (firstError) {
              addNotification({ title: t("moveFailed"), message: translateFileError(firstError, t), type: "error", category: "files", appId: "files" });
            }
          });
        }
      }

      // Always deconflict after any grid drag (apps + files). File-only path used to skip this and overlap.
      if (hasDragged && desktopLayoutMode === "grid" && !movedIntoFolder) {
        const dropBounds = getDesktopBoundsSize(desktopIconsRef.current);
        setDesktopBounds(dropBounds);
        const itemIds = getDesktopItemIds();
        const seeds: Record<string, { x: number; y: number } | undefined> = { ...desktopIconPositions };
        nextSelected.forEach((id) => {
          seeds[id] = livePositions[id] ?? initialPositions[id] ?? seeds[id];
        });
        applyGridLayout(itemIds, seeds, dropBounds);
      }

      setDesktopDragTarget(null);
      setDesktopInvalidDragTarget(null);
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
      <DesktopWidgets />
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
      {desktopDragTarget === "desktop-root" ? (
        <div className="desktop-root-drop-target" aria-hidden="true">
          <Icon icon="solar:home-angle-bold-duotone" width={18} height={18} />
          <span>{t("dropToHome")}</span>
        </div>
      ) : null}
      <div className="desktop-icons" ref={desktopIconsRef}>
        {visibleApps.map((appId, index) => {
          const app = apps.find((item) => item.id === appId)!;
          const itemId = `app:${app.id}`;
          const pos = getIconPosition(itemId, index, desktopBounds);
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
          const pos = getIconPosition(itemId, visibleApps.length + index, desktopBounds);
          return (
            <div
              key={`desktop-file:${file.id}`}
              className={clsx("desktop-icon", "desktop-file", selectedDesktopItems.includes(itemId) && "is-selected", desktopDragTarget === `desktop:${file.id}` && "is-drag-target", desktopInvalidDragTarget === `desktop:${file.id}` && "is-invalid-drag-target")}
              style={{ position: "absolute", left: pos.x, top: pos.y }}
              data-context-kind="file"
              data-context-id={file.id}
              data-desktop-file-id={file.id}
              data-desktop-icon-id={itemId}
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={(e) => handleIconMouseDown(itemId, e)}
              onContextMenu={(e) => handleIconContextMenu(itemId, e)}
              onDoubleClick={() => {
                selectFile(file.id);
                if (file.kind === "folder") {
                  const openFolder = (globalThis as any).__files_open_folder as ((folderId: string | null) => void) | undefined;
                  openFolder?.(file.id);
                  openApp("files");
                  return;
                }
                openApp(getFileOpenApp(file));
              }}
            >
              <Icon icon={file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:document-text-bold-duotone"} width={30} height={30} />
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
  const moveWindowToWorkspace = useDesktopStore((state) => state.moveWindowToWorkspace);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const createFile = useFsStore((state) => state.createFile);
  const createFolder = useFsStore((state) => state.createFolder);

  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const deleteFileById = useFsStore((state) => state.deleteFileById);
  const restoreFileById = useFsStore((state) => state.restoreFileById);
  const permanentlyDeleteFileById = useFsStore((state) => state.permanentlyDeleteFileById);
  const renameFileById = useFsStore((state) => state.renameFileById);
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
    const nextName = window.prompt(t("renameFilePrompt"), file.name);
    if (!nextName || nextName.trim() === file.name) return;
    const result = await renameFileById(file.id, nextName);
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
    if (!window.confirm(phrase(t, "confirmMoveToTrashPrefix", file.name, "confirmMoveToTrashSuffix"))) return;
    await deleteFileById(file.id);
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
    addNotification({ title: t("restore"), message: `${file.name}${t("restoredSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function permanentlyDeleteFileFromMenu() {
    if (!file) return;
    if (!window.confirm(phrase(t, "confirmPermanentDeletePrefix", file.name, "confirmPermanentDeleteSuffix"))) return;
    await permanentlyDeleteFileById(file.id);
    addNotification({ title: t("fileDeleted"), message: `${file.name}${t("permanentlyDeletedSuffix")}`, type: "success", category: "files", appId: "trash" });
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
      category: "files",
      appId: "files",
    });
  }

  async function createFolderFromMenu() {
    const startCreateFolder = (globalThis as any).__files_create_folder as (() => void) | undefined;
    if (startCreateFolder) {
      startCreateFolder();
      return;
    }

    const name = window.prompt(t("createFolderPrompt"), t("newFolderLabel"));
    if (!name || !name.trim()) return;
    const result = await createFolder(name);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: result.error, type: "error", category: "files", appId: "files" });
      return;
    }
    addNotification({ title: t("folderCreated"), message: `${result.file?.name ?? t("newFolderLabel")}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
  }

  function openFileFromMenu() {
    if (!file || file.trashed) return;
    selectFile(file.id);
    if (file.kind === "folder") {
      const openFolder = (globalThis as any).__files_open_folder as ((folderId: string | null) => void) | undefined;
      openFolder?.(file.id);
      openApp("files");
      return;
    }
    openApp(getFileOpenApp(file));
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
          <button role="menuitem" onClick={() => run(() => { openApp(app.id); })}>
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
                onClick={() => run(openFileFromMenu)}
              >
                <Icon icon={file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:document-text-bold-duotone"} width={16} height={16} />
                {file.kind === "folder" ? t("openFolder") : `${t("open")} ${t("appNotes")}`}
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
            {t("snapLeft")}
          </button>
          <button role="menuitem" onClick={() => run(() => snapWindow(windowState.id, "right"))}>
            <Icon icon="solar:sidebar-code-bold-duotone" width={16} height={16} />
            {t("snapRight")}
          </button>
          <button role="menuitem" onClick={() => run(() => togglePinnedWindowZ(windowState.id))}>
            <Icon icon="solar:pin-bold-duotone" width={16} height={16} />
            {t("bringToFront")}
          </button>
          <div className="context-menu-divider" />
          {([0, 1, 2] as WorkspaceId[]).map((workspace) => (
            <button
              key={workspace}
              role="menuitem"
              onClick={() => run(() => moveWindowToWorkspace(windowState.id, workspace))}
            >
              <Icon icon="solar:layers-minimalistic-bold-duotone" width={16} height={16} />
              {t("moveToWorkspace")} {workspace + 1}
            </button>
          ))}
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
          <button role="menuitem" onClick={() => run(createFolderFromMenu)}>
            <Icon icon="solar:folder-with-files-bold-duotone" width={16} height={16} />
            {t("createFolder")}
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
        <>
          <button role="menuitem" onClick={() => run(createFileDirectFromMenu)}>
            <Icon icon="solar:add-circle-bold-duotone" width={16} height={16} />
            {t("newFile")}
          </button>
          <button role="menuitem" onClick={() => run(createFolderFromMenu)}>
            <Icon icon="solar:folder-with-files-bold-duotone" width={16} height={16} />
            {t("createFolder")}
          </button>
        </>
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
      cancel=".window-content, .window-actions, .window-actions *, input, textarea, button, select, option, a, iframe, label"
      enableResizing={!window.maximized}
      minWidth={380}
      minHeight={250}
      style={{ zIndex: window.z }}
      onMouseDown={() => focusWindow(window.id)}
      onDragStart={() => {}}
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
        <header
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
            <button type="button" aria-label={`${t("minimizeWindowLabel")}${windowTitle}`} onClick={requestMinimize}>
              <span aria-hidden="true">-</span>
            </button>
            <button
              type="button"
              aria-label={`${window.maximized ? t("restoreWindowLabel") : t("maximizeWindowLabel")}${windowTitle}`}
              onClick={() => toggleMaximize(window.id)}
            >
              <span aria-hidden="true">{window.maximized ? "□" : "▢"}</span>
            </button>
            <button type="button" aria-label={`${t("closeWindowLabel")}${windowTitle}`} onClick={() => requestCloseWindow(window, closeWindow)}>
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
