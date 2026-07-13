import { Icon } from "@iconify-icon/react";
import { apps } from "../apps";
import { appTitleKeys } from "../appText";
import { appAlert, appConfirm, appPrompt } from "../dialogStore";
import { translateFileError } from "../fileErrorUtils";
import { getFileOpenApp } from "../fileOpen";
import { useFsStore } from "../fsStore";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import type { ContextMenuState, WorkspaceId } from "../types";
import { useDesktopStore } from "../windowStore";
import { useDesktopPinsStore } from "./desktopPinsStore";
import { openFilesFolder, startFilesCreateFile, startFilesCreateFolder, useFilesBridgeStore } from "./filesBridge";
import { phrase } from "./phrase";
import { requestCloseWindow } from "./windowLifecycle";

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const hideApp = useDesktopPinsStore((state) => state.hideApp);
  const showAllApps = useDesktopPinsStore((state) => state.showAllApps);
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
    const nextName = await appPrompt({
      title: t("dialogPromptTitle"),
      message: t("renameFilePrompt"),
      defaultValue: file.name,
      confirmLabel: t("rename"),
    });
    if (!nextName || nextName.trim() === file.name) return;
    const result = await renameFileById(file.id, nextName);
    if (result.error) {
      await appAlert({
        title: t("renameFailed"),
        message: translateFileError(result.error, t),
      });
      addNotification({
        title: t("renameFailed"),
        message: translateFileError(result.error, t),
        type: "error",
      });
    } else {
      addNotification({
        title: t("fileRenamed"),
        message: phrase(t, "fileRenamedPrefix", nextName, "fileRenamedSuffix"),
        type: "success",
      });
    }
  }

  async function deleteFileFromMenu() {
    if (!file) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmMoveToTrashPrefix", file.name, "confirmMoveToTrashSuffix"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    await deleteFileById(file.id);
    addNotification({
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
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmPermanentDeletePrefix", file.name, "confirmPermanentDeleteSuffix"),
      confirmLabel: t("deleteForever"),
      danger: true,
    });
    if (!ok) return;
    await permanentlyDeleteFileById(file.id);
    addNotification({ title: t("fileDeleted"), message: `${file.name}${t("permanentlyDeletedSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function createFileFromMenu() {
    if (useFilesBridgeStore.getState().startCreateFile) {
      startFilesCreateFile();
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
    if (useFilesBridgeStore.getState().createFolder) {
      await startFilesCreateFolder();
      return;
    }

    const name = await appPrompt({
      title: t("dialogPromptTitle"),
      message: t("createFolderPrompt"),
      defaultValue: t("newFolderLabel"),
      confirmLabel: t("createFolder"),
    });
    if (!name || !name.trim()) return;
    const result = await createFolder(name);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    addNotification({ title: t("folderCreated"), message: `${result.file?.name ?? t("newFolderLabel")}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
  }

  function openFileFromMenu() {
    if (!file || file.trashed) return;
    selectFile(file.id);
    if (file.kind === "folder") {
      openFilesFolder(file.id);
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
            onClick={() => run(() => hideApp(app.id))}
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
            onClick={() => run(() => showAllApps())}
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
