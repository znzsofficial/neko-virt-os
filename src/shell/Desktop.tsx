import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { apps } from "../apps";
import { appTitleKeys } from "../appText";
import { DesktopWidgets } from "../components/DesktopWidgets";
import { appConfirm } from "../dialogStore";
import { clampDesktopIconPosition, getDesktopBoundsSize, getDesktopGridPosition, layoutItemsOnDesktopGrid, snapDesktopIconPosition } from "../desktopLayout";
import { translateFileError } from "../fs";
import { getFileOpenApp } from "../fs";
import { useFsStore } from "../fs";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { useOsUiStore } from "../osUiStore";
import { useDesktopStore } from "../windowStore";
import { useDesktopPinsStore } from "./desktopPinsStore";
import { openFilesFolder } from "./filesBridge";
import { phrase, pluralize } from "./phrase";

export function Desktop() {
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
  const desktopIconPositions = useDesktopStore((state) => state.desktopIconPositions);
  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const deleteFileById = useFsStore((state) => state.deleteFileById);
  const moveFileById = useFsStore((state) => state.moveFileById);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const pinnedDesktopApps = useDesktopPinsStore((state) => state.pinnedDesktopApps);
  const hiddenDesktopApps = useDesktopPinsStore((state) => state.hiddenDesktopApps);
  const desktopFiles = files.filter((file) => !file.trashed && (file.parentId ?? null) === null).slice(0, 4);

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

  // Selection box and delete key logic
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete") return;
      if (useOsUiStore.getState().sessionLocked) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector(".app-dialog-backdrop, .mmd-modal-backdrop")) return;
      if (selectedDesktopItems.length === 0) return;
      const fileIdsToDelete = selectedDesktopItems
        .filter((item) => item.startsWith("file:"))
        .map((item) => item.replace("file:", ""));

      if (fileIdsToDelete.length > 0) {
        const filesToDelete = files.filter((f) => fileIdsToDelete.includes(f.id));
        const names = filesToDelete.map((f) => f.name).join(", ");
        void appConfirm({
          title: t("dialogConfirmTitle"),
          message: phrase(t, "confirmDeletePrefix", names, "confirmDeleteSuffix"),
          confirmLabel: t("delete"),
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          void Promise.all(filesToDelete.map(async (f) => deleteFileById(f.id))).then(() => {
            addNotification({
              title: t("filesDeleted"),
              message: phrase(t, "filesDeletedPrefix", filesToDelete.length, "filesDeletedSuffix"),
              type: "success",
              category: "files",
              appId: "files",
            });
          });
          setSelectedDesktopItems([]);
        });
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedDesktopItems, files, deleteFileById, addNotification, t]);

  function handleDesktopMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    
    if (target.closest(".desktop-icon")) {
      return;
    }

    if (target.classList.contains("desktop") || target.classList.contains("desktop-icons")) {
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
              addNotification({ title: t("itemMoved"), message: `${movedCount}${pluralize(t, movedCount, "movedItemsOne", "movedItemsOther")}`, type: "success", category: "files", appId: "files" });
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
      <DesktopWidgets />
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
              role="button"
              tabIndex={0}
              aria-pressed={selectedDesktopItems.includes(itemId) || undefined}
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
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                openApp(app.id);
              }}
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
              role="button"
              tabIndex={0}
              aria-pressed={selectedDesktopItems.includes(itemId) || undefined}
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
                  openFilesFolder(file.id);
                  openApp("files");
                  return;
                }
                openApp(getFileOpenApp(file));
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                selectFile(file.id);
                if (file.kind === "folder") {
                  openFilesFolder(file.id);
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
