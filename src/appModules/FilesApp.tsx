import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { NavItem } from "../components/NavItem";
import { appAlert, appConfirm, appPrompt } from "../dialogStore";
import { setOwnedLocalStorageItem } from "../system/persistenceGate";
import {
  formatFileSize,
  formatFileTime,
  getFileOpenApp,
  sortFiles,
  translateFileError,
  useFsStore,
  type FsFile,
} from "../fs";
import { downloadBlob } from "../system/downloadStore";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import type { FileSortMode } from "../types";
import { registerFilesBridgeHandlers } from "../shell/filesBridge";
import { phrase } from "../shell/phrase";
import { useDesktopStore } from "../windowStore";

const DETAILS_WIDTH_KEY = "neko-virt-os.files-details-width.v1";
const DETAILS_WIDTH_DEFAULT = 250;
const DETAILS_WIDTH_MIN = 180;
const DETAILS_WIDTH_MAX = 420;

function readDetailsWidth() {
  try {
    const raw = Number(localStorage.getItem(DETAILS_WIDTH_KEY));
    if (!Number.isFinite(raw)) return DETAILS_WIDTH_DEFAULT;
    return Math.min(DETAILS_WIDTH_MAX, Math.max(DETAILS_WIDTH_MIN, Math.round(raw)));
  } catch {
    return DETAILS_WIDTH_DEFAULT;
  }
}

function writeDetailsWidth(width: number) {
  try {
    setOwnedLocalStorageItem(DETAILS_WIDTH_KEY, String(width));
  } catch {
    // ignore
  }
}

function replaceCount(template: string, n: number) {
  return template.replace("{n}", String(n));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function FilesApp() {
  const [section, setSection] = useState<"home" | "files" | "recent" | "trash">("home");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<FileSortMode>("updated");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileDraft, setNewFileDraft] = useState("Untitled.md");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [invalidDragTargetId, setInvalidDragTargetId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<(string | null)[]>([null]);
  const [folderHistoryIndex, setFolderHistoryIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(readDetailsWidth);
  const importInputRef = useRef<HTMLInputElement>(null);
  const filesRootRef = useRef<HTMLDivElement | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const files = useFsStore((state) => state.files);
  const loaded = useFsStore((state) => state.loaded);
  const selectedFileId = useFsStore((state) => state.selectedFileId);
  const selectFile = useFsStore((state) => state.selectFile);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const deleteSelectedFile = useFsStore((state) => state.deleteSelectedFile);
  const deleteFilesByIds = useFsStore((state) => state.deleteFilesByIds);
  const restoreSelectedFile = useFsStore((state) => state.restoreSelectedFile);
  const permanentlyDeleteSelectedFile = useFsStore((state) => state.permanentlyDeleteSelectedFile);
  const emptyTrash = useFsStore((state) => state.emptyTrash);
  const renameSelectedFile = useFsStore((state) => state.renameSelectedFile);
  const createFolder = useFsStore((state) => state.createFolder);
  const moveFileById = useFsStore((state) => state.moveFileById);
  const openApp = useDesktopStore((state) => state.openApp);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);

  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null;
  const activeFiles = files.filter((file) => !file.trashed);
  const trashedFiles = files.filter((file) => file.trashed);
  const currentFolder = activeFiles.find((file) => file.id === currentFolderId && file.kind === "folder") ?? null;
  const recentFiles = activeFiles.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const effectiveSortMode = section === "recent" ? "updated" : sortMode;
  const listFolderId = section === "home" ? null : currentFolderId;
  const visibleFiles = sortFiles(
    (section === "recent"
      ? recentFiles
      : section === "trash"
        ? trashedFiles
        : activeFiles.filter((file) => (file.parentId ?? null) === listFolderId)
    ).filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase())),
    effectiveSortMode,
  );
  const previewText = selectedFile?.kind === "text" ? selectedFile.content : "";
  const wordCount = previewText.trim() ? previewText.trim().split(/\s+/).length : 0;
  const charSetSize = new Set(previewText).size;
  const folderChildrenCount = selectedFile?.kind === "folder"
    ? activeFiles.filter((file) => (file.parentId ?? null) === selectedFile.id).length
    : 0;
  const folderChain = currentFolderId && section === "files" ? buildFolderChain(currentFolderId, activeFiles) : [];
  const canGoBack = section === "files" && folderHistoryIndex > 0;
  const canGoForward = section === "files" && folderHistoryIndex < folderHistory.length - 1;
  const multiCount = selectedIds.length;
  const selectedPath = useMemo(
    () => (selectedFile ? formatEntryPath(selectedFile, activeFiles) : ""),
    [activeFiles, selectedFile],
  );

  function goHome() {
    setSection("home");
    setCurrentFolderId(null);
    setFolderHistory([null]);
    setFolderHistoryIndex(0);
    setSelectedIds([]);
    setAnchorId(null);
  }

  function setSelection(ids: string[], primaryId?: string | null) {
    const unique = [...new Set(ids.filter(Boolean))];
    setSelectedIds(unique);
    const nextPrimary = primaryId && unique.includes(primaryId) ? primaryId : unique[unique.length - 1] ?? null;
    if (nextPrimary) selectFile(nextPrimary);
  }

  function selectSingle(fileId: string) {
    setSelection([fileId], fileId);
    setAnchorId(fileId);
  }

  function toggleSelect(fileId: string) {
    setSelectedIds((current) => {
      const next = current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId];
      const primary = next.includes(fileId) ? fileId : next[next.length - 1] ?? null;
      if (primary) selectFile(primary);
      return next;
    });
    setAnchorId(fileId);
  }

  function selectRange(toId: string) {
    const fromId = anchorId ?? selectedFileId ?? toId;
    const fromIndex = visibleFiles.findIndex((file) => file.id === fromId);
    const toIndex = visibleFiles.findIndex((file) => file.id === toId);
    if (fromIndex < 0 || toIndex < 0) {
      selectSingle(toId);
      return;
    }
    const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const range = visibleFiles.slice(start, end + 1).map((file) => file.id);
    setSelection(range, toId);
  }

  function handleRowPointerDown(event: ReactMouseEvent, file: FsFile) {
    // Only left button; selection must run on mousedown so focus handlers cannot wipe multi-select.
    if (event.button !== 0) return;
    if (event.shiftKey) {
      event.preventDefault();
      selectRange(file.id);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      toggleSelect(file.id);
      return;
    }
    // Plain click: select immediately so drag-start already has the right set.
    if (!selectedIdsRef.current.includes(file.id) || selectedIdsRef.current.length > 1) {
      selectSingle(file.id);
    }
  }

  function handleRowFocus(file: FsFile) {
    // Keyboard focus only: never collapse multi-select while modifiers are held.
    // Pointer multi-select is handled in pointerdown; skip if already part of selection.
    if (selectedIdsRef.current.includes(file.id)) return;
    selectSingle(file.id);
  }

  const beginDetailsResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = detailsWidth;
    const rootWidth = filesRootRef.current?.clientWidth ?? window.innerWidth;
    const dynamicMax = Math.max(DETAILS_WIDTH_MIN, Math.min(DETAILS_WIDTH_MAX, Math.floor(rootWidth * 0.45)));
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    document.body.classList.add("files-resizing-details");

    function onMove(moveEvent: PointerEvent) {
      const next = Math.min(dynamicMax, Math.max(DETAILS_WIDTH_MIN, Math.round(startWidth - (moveEvent.clientX - startX))));
      setDetailsWidth(next);
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
      document.body.classList.remove("files-resizing-details");
      setDetailsWidth((current) => {
        writeDetailsWidth(current);
        return current;
      });
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }, [detailsWidth]);

  async function commitNewFile() {
    if (!newFileDraft.trim()) {
      setCreatingFile(false);
      setNewFileDraft("Untitled.md");
      return;
    }
    const parentId = section === "home" ? null : currentFolderId;
    const result = await createNamedFile(newFileDraft, parentId);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    setCreatingFile(false);
    setNewFileDraft("Untitled.md");
    if (result.file) selectSingle(result.file.id);
    addNotification({ title: t("fileCreated"), message: `${result.file?.name ?? t("newFile")}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
  }

  const folderHistoryIndexRef = useRef(folderHistoryIndex);
  folderHistoryIndexRef.current = folderHistoryIndex;
  const folderHistoryRef = useRef(folderHistory);
  folderHistoryRef.current = folderHistory;
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const currentFolderIdRef = useRef(currentFolderId);
  currentFolderIdRef.current = currentFolderId;

  function navigateToFolder(folderId: string | null, mode: "push" | "replace" = "push") {
    setCurrentFolderId(folderId);
    setSelectedIds([]);
    setAnchorId(null);
    if (mode === "replace") {
      const historyIndex = folderHistoryIndexRef.current;
      setFolderHistory((current) => current.map((entry, index) => (index === historyIndex ? folderId : entry)));
      return;
    }
    setFolderHistory((current) => [...current.slice(0, folderHistoryIndexRef.current + 1), folderId]);
    setFolderHistoryIndex((current) => current + 1);
  }

  function startCreateFile() {
    if (sectionRef.current === "home") setSection("files");
    setCreatingFile(true);
    setNewFileDraft("Untitled.md");
  }

  function openFolderLocation(folderId: string | null) {
    setSection("files");
    navigateToFolder(folderId);
  }

  function openFolderInFilesMode(folderId: string | null) {
    setSection("files");
    navigateToFolder(folderId);
  }

  function stepFolderHistory(direction: -1 | 1) {
    setFolderHistoryIndex((current) => {
      const nextIndex = current + direction;
      const nextFolderId = folderHistoryRef.current[nextIndex];
      if (nextIndex < 0 || nextIndex >= folderHistoryRef.current.length || nextFolderId === undefined) return current;
      setCurrentFolderId(nextFolderId);
      setSelectedIds([]);
      setAnchorId(null);
      return nextIndex;
    });
  }

  async function createFolderInCurrentLocation() {
    const name = await appPrompt({
      title: t("dialogPromptTitle"),
      message: t("createFolderPrompt"),
      defaultValue: t("newFolderLabel"),
      confirmLabel: t("createFolder"),
    });
    if (!name || !name.trim()) return;
    const parentId = sectionRef.current === "home" ? null : currentFolderIdRef.current;
    const result = await createFolder(name, parentId);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    if (result.file) {
      selectSingle(result.file.id);
      addNotification({ title: t("folderCreated"), message: `${result.file.name}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
    }
  }

  // Stable bridge handlers (refs hold latest section/folder); register once per mount.
  const bridgeHandlersRef = useRef({
    startCreateFile,
    createFolder: createFolderInCurrentLocation,
    openFolder: openFolderLocation,
  });
  bridgeHandlersRef.current.startCreateFile = startCreateFile;
  bridgeHandlersRef.current.createFolder = createFolderInCurrentLocation;
  bridgeHandlersRef.current.openFolder = openFolderLocation;

  useEffect(() => {
    return registerFilesBridgeHandlers({
      startCreateFile: () => bridgeHandlersRef.current.startCreateFile(),
      createFolder: () => bridgeHandlersRef.current.createFolder(),
      openFolder: (folderId) => bridgeHandlersRef.current.openFolder(folderId),
    });
  }, []);

  useEffect(() => {
    if (section !== "files") return;
    if (!currentFolderId) return;
    const currentExists = activeFiles.some((file) => file.id === currentFolderId && file.kind === "folder");
    if (!currentExists) {
      setCurrentFolderId(null);
      setFolderHistory((current) => current.map((entry) => (entry === currentFolderId ? null : entry)));
    }
  }, [activeFiles, currentFolderId, section]);

  useEffect(() => {
    // Drop multi-selection entries that no longer exist in the current list.
    setSelectedIds((current) => {
      if (!current.length) return current;
      const visible = new Set(visibleFiles.map((file) => file.id));
      const next = current.filter((id) => visible.has(id) || files.some((file) => file.id === id));
      return next.length === current.length ? current : next;
    });
  }, [files, visibleFiles]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || renamingFileId || creatingFile) return;
      if (event.key === "Escape") {
        setSelectedIds(selectedFileId ? [selectedFileId] : []);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && section !== "trash") {
        event.preventDefault();
        const ids = visibleFiles.map((file) => file.id);
        setSelection(ids, selectedFileId ?? ids[0] ?? null);
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (section === "trash") return;
      if (!selectedIds.length && !selectedFileId) return;
      event.preventDefault();
      void deleteSelection();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function startRename(fileToRename = selectedFile) {
    if (!fileToRename || multiCount > 1) return;
    selectSingle(fileToRename.id);
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
      await appAlert({ title: t("renameFailed"), message: translateFileError(result.error, t) });
      addNotification({ title: t("renameFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
    } else {
      setRenamingFileId(null);
      addNotification({ title: t("fileRenamed"), message: phrase(t, "fileRenamedPrefix", renameDraft, "fileRenamedSuffix"), type: "success", category: "files", appId: "files" });
    }
  }

  async function deleteSelection(fileToDelete = selectedFile) {
    const ids = selectedIds.length
      ? selectedIds
      : fileToDelete && !fileToDelete.trashed
        ? [fileToDelete.id]
        : [];
    if (!ids.length) return;
    if (ids.length === 1) {
      const only = files.find((file) => file.id === ids[0]);
      if (!only) return;
      selectFile(only.id);
      const okOne = await appConfirm({
        title: t("dialogConfirmTitle"),
        message: phrase(t, "confirmMoveToTrashPrefix", only.name, "confirmMoveToTrashSuffix"),
        confirmLabel: t("delete"),
        danger: true,
      });
      if (!okOne) return;
      await deleteSelectedFile();
      setSelectedIds([]);
      addNotification({ title: t("movedToTrash"), message: `${only.name}${t("canRestoreFromTrashSuffix")}`, type: "success", category: "files", appId: "trash" });
      return;
    }
    const okBatch = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmBatchTrashPrefix", ids.length, "confirmBatchTrashSuffix"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!okBatch) return;
    const count = await deleteFilesByIds(ids);
    setSelectedIds([]);
    addNotification({
      title: t("movedToTrash"),
      message: replaceCount(t("filesBatchMovedToTrash"), count),
      type: "success",
      category: "files",
      appId: "trash",
    });
  }

  async function restoreSelected(fileToRestore = selectedFile) {
    if (!fileToRestore) return;
    selectFile(fileToRestore.id);
    await restoreSelectedFile();
    setSection("files");
    addNotification({ title: t("restore"), message: `${fileToRestore.name}${t("restoredSuffix")}`, type: "success", category: "files", appId: "files" });
  }

  async function deleteForever(fileToDelete = selectedFile) {
    if (!fileToDelete) return;
    selectFile(fileToDelete.id);
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmPermanentDeletePrefix", fileToDelete.name, "confirmPermanentDeleteSuffix"),
      confirmLabel: t("deleteForever"),
      danger: true,
    });
    if (!ok) return;
    await permanentlyDeleteSelectedFile();
    setSelectedIds([]);
    addNotification({ title: t("fileDeleted"), message: `${fileToDelete.name}${t("permanentlyDeletedSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function emptyTrashFromFiles() {
    if (!trashedFiles.length) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmEmptyTrashPrefix", trashedFiles.length, "confirmEmptyTrashSuffix"),
      confirmLabel: t("emptyTrash"),
      danger: true,
    });
    if (!ok) return;
    await emptyTrash();
    setSelectedIds([]);
    addNotification({ title: t("trashEmptied"), message: t("trashEmptiedMessage"), type: "success", category: "files", appId: "trash" });
  }

  async function moveDraggedFile(draggedId: string, targetFolderId: string | null) {
    const ids = selectedIds.includes(draggedId) && selectedIds.length > 1 ? selectedIds : [draggedId];
    let moved = 0;
    let lastError: string | null = null;
    for (const id of ids) {
      if (id === targetFolderId) continue;
      const result = await moveFileById(id, targetFolderId);
      if (result.error) {
        lastError = result.error;
        continue;
      }
      if (result.file) moved += 1;
    }
    if (lastError && !moved) {
      addNotification({ title: t("moveFailed"), message: translateFileError(lastError as any, t), type: "error", category: "files", appId: "files" });
      return;
    }
    if (moved) {
      addNotification({
        title: t("itemMoved"),
        message: moved === 1
          ? `${files.find((f) => f.id === ids[0])?.name ?? ""}${t("itemMovedSuffix")}`
          : replaceCount(t("filesSelectedCount"), moved) + t("itemMovedSuffix"),
        type: "success",
        category: "files",
        appId: "files",
      });
    }
  }

  async function importTextFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const parentId = section === "home" ? null : currentFolderId;
    let imported = 0;
    let skipped = 0;
    for (const file of Array.from(fileList)) {
      const isText =
        file.type.startsWith("text/")
        || file.type === "application/json"
        || file.type === "application/javascript"
        || /\.(txt|md|json|csv|log|ts|tsx|js|jsx|css|html|xml|yml|yaml)$/i.test(file.name);
      if (!isText) {
        skipped += 1;
        continue;
      }
      try {
        const content = await file.text();
        const result = await createNamedFile(file.name, parentId);
        if (result.error || !result.file) {
          skipped += 1;
          continue;
        }
        await useFsStore.getState().saveFileDraft(result.file.id, content);
        imported += 1;
        selectSingle(result.file.id);
      } catch {
        skipped += 1;
      }
    }
    if (imported) {
      addNotification({
        title: t("fileCreated"),
        message: replaceCount(t("filesImportDone"), imported) + (skipped ? ` · ${t("filesImportSkipBinary")}` : ""),
        type: "success",
        category: "files",
        appId: "files",
      });
    } else {
      addNotification({
        title: t("filesImportFailed"),
        message: skipped ? t("filesImportSkipBinary") : t("filesImportFailed"),
        type: "warning",
        category: "files",
        appId: "files",
      });
    }
    if (importInputRef.current) importInputRef.current.value = "";
  }

  function downloadSelectedText() {
    if (!selectedFile || selectedFile.kind !== "text") return;
    const blob = new Blob([selectedFile.content], { type: "text/plain;charset=utf-8" });
    downloadBlob({
      blob,
      name: selectedFile.name || "download.txt",
      source: t("appFiles"),
      register: false,
      revokeAfterMs: 30_000,
    });
    addNotification({ title: t("filesDownload"), message: t("filesDownloadDone"), type: "success", category: "files", appId: "files" });
  }

  async function copySelectedPath() {
    if (!selectedPath) return;
    try {
      await navigator.clipboard.writeText(selectedPath);
      addNotification({ title: t("filesCopyPath"), message: t("filesPathCopied"), type: "success", category: "files", appId: "files" });
    } catch {
      addNotification({ title: t("filesCopyPath"), message: t("filesPathCopyFailed"), type: "error", category: "files", appId: "files" });
    }
  }

  const toolbarSubtitle = (() => {
    if (section === "trash") return `${trashedFiles.length} ${t("trash")}`;
    if (section === "recent") return `${recentFiles.length} ${t("filesCount")}`;
    if (multiCount > 1) return replaceCount(t("filesSelectedCount"), multiCount);
    if (section === "files" && currentFolder) return currentFolder.name;
    if (!loaded) return t("mountingFs");
    const count = activeFiles.filter((file) => (file.parentId ?? null) === listFolderId).length;
    return `${count} ${t("filesCount")}`;
  })();

  return (
    <div
      ref={filesRootRef}
      className="files-app app-grid"
      style={{ ["--files-details-width" as string]: `${detailsWidth}px` }}
    >
      <aside className="app-sidebar">
        <NavItem icon="solar:home-2-bold-duotone" label={t("home")} active={section === "home"} onClick={goHome} />
        <NavItem icon="solar:folder-with-files-bold-duotone" label={t("appFiles")} active={section === "files"} onClick={() => setSection("files")} />
        <NavItem icon="solar:clock-circle-bold-duotone" label={t("recent")} active={section === "recent"} onClick={() => setSection("recent")} />
        <NavItem icon="solar:trash-bin-trash-bold-duotone" label={`${t("trash")}${trashedFiles.length ? ` (${trashedFiles.length})` : ""}`} active={section === "trash"} onClick={() => setSection("trash")} />
      </aside>
      <section className="app-main">
        <div className="app-toolbar">
          <div>
            <h2>{section === "home" ? t("home") : section === "recent" ? t("recent") : section === "trash" ? t("trash") : t("appFiles")}</h2>
            <p>{toolbarSubtitle}</p>
          </div>
          <div className="toolbar-actions">
            {section === "trash" ? (
              <>
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void restoreSelected()}><Icon icon="solar:undo-left-round-bold-duotone" width={16} height={16} />{t("restore")}</button>
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void deleteForever()}><Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={16} height={16} />{t("deleteForever")}</button>
                <button className="button-primary" disabled={!trashedFiles.length} onClick={() => void emptyTrashFromFiles()}>{t("emptyTrash")}</button>
              </>
            ) : (
              <>
                {section === "files" ? <button className="button-ghost" disabled={!canGoBack} onClick={() => stepFolderHistory(-1)}><Icon icon="solar:alt-arrow-left-line-duotone" width={16} height={16} />{t("back")}</button> : null}
                {section === "files" ? <button className="button-ghost" disabled={!canGoForward} onClick={() => stepFolderHistory(1)}><Icon icon="solar:alt-arrow-right-line-duotone" width={16} height={16} />{t("forward")}</button> : null}
                {section === "files" ? <button className="button-ghost" disabled={!currentFolderId} onClick={() => navigateToFolder(currentFolder?.parentId ?? null)}><Icon icon="solar:alt-arrow-up-line-duotone" width={16} height={16} />{t("goUp")}</button> : null}
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed || selectedFile?.kind !== "text" || multiCount > 1} onClick={() => selectedFile && openApp(getFileOpenApp(selectedFile))}><Icon icon="solar:login-2-bold-duotone" width={16} height={16} />{t("open")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed || multiCount > 1} onClick={() => startRename()}><Icon icon="solar:pen-new-square-bold-duotone" width={16} height={16} />{t("rename")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed || multiCount > 1 || selectedFile?.kind !== "text"} onClick={downloadSelectedText}><Icon icon="solar:download-minimalistic-bold-duotone" width={16} height={16} />{t("filesDownload")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed || multiCount > 1} onClick={() => void copySelectedPath()}><Icon icon="solar:copy-bold-duotone" width={16} height={16} />{t("filesCopyPath")}</button>
                <button className="button-ghost" disabled={(!selectedIds.length && !selectedFileId) || Boolean(selectedFile?.trashed)} onClick={() => void deleteSelection()}><Icon icon="solar:trash-bin-trash-bold-duotone" width={16} height={16} />{t("delete")}</button>
                <button className="button-ghost" onClick={() => importInputRef.current?.click()}><Icon icon="solar:upload-minimalistic-bold-duotone" width={16} height={16} />{t("filesImport")}</button>
                <input ref={importInputRef} type="file" multiple accept=".txt,.md,.json,.csv,.log,.ts,.tsx,.js,.jsx,.css,.html,.xml,.yml,.yaml,text/*" hidden onChange={(event) => void importTextFiles(event.target.files)} />
                <button className="button-primary" onClick={() => void createFolderInCurrentLocation()}><Icon icon="solar:folder-add-bold" width={18} height={18} />{t("createFolder")}</button>
                <button className="button-primary" onClick={startCreateFile}><Icon icon="solar:add-circle-bold" width={16} height={16} />{t("newFile")}</button>
              </>
            )}
          </div>
        </div>
        {section === "files" ? (
          <div className="file-breadcrumbs" aria-label={t("currentPath")}>
            {[null, ...folderChain.map((folder) => folder.id)].map((folderId, index) => (
              <button
                key={folderId ?? "root"}
                className={clsx("button-ghost", (folderId ?? null) === currentFolderId && "is-active", dragTargetId === `crumb:${folderId ?? "root"}` && "is-drag-target")}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setInvalidDragTargetId(null);
                  setDragTargetId(`crumb:${folderId ?? "root"}`);
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => {
                  setDragTargetId((current) => (current === `crumb:${folderId ?? "root"}` ? null : current));
                  setInvalidDragTargetId((current) => (current === `crumb:${folderId ?? "root"}` ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragTargetId(null);
                  setInvalidDragTargetId(null);
                  const draggedId = event.dataTransfer.getData("text/neko-file-id");
                  if (!draggedId) return;
                  void moveDraggedFile(draggedId, folderId ?? null);
                }}
                onClick={() => navigateToFolder(folderId)}
              >
                {index === 0 ? t("home") : folderChain[index - 1].name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="file-controls">
          <label className="file-search">
            <Icon icon="solar:magnifer-bold-duotone" width={16} height={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchFiles")} spellCheck="false" />
          </label>
          <label className="file-sort">
            {t("sort")}
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as FileSortMode)}>
              <option value="updated">{t("updatedSort")}</option>
              <option value="name">{t("nameSort")}</option>
              <option value="size">{t("sizeSort")}</option>
            </select>
          </label>
          <span className="file-select-hint">{t("filesSelectHint")}</span>
        </div>
        <div
          className={clsx("file-list", dragTargetId === "list" && "is-drag-target", invalidDragTargetId === "list" && "is-invalid-drag-target")}
          data-context-kind="files-empty"
          onDragOver={(event) => {
            if (section !== "files" && section !== "home") return;
            event.preventDefault();
            setInvalidDragTargetId(null);
            setDragTargetId("list");
            event.dataTransfer.dropEffect = "move";
          }}
          onDragLeave={() => {
            setDragTargetId((current) => (current === "list" ? null : current));
            setInvalidDragTargetId((current) => (current === "list" ? null : current));
          }}
          onDrop={(event) => {
            if (section !== "files" && section !== "home") return;
            event.preventDefault();
            setDragTargetId(null);
            setInvalidDragTargetId(null);
            const draggedId = event.dataTransfer.getData("text/neko-file-id");
            if (!draggedId) return;
            void moveDraggedFile(draggedId, listFolderId);
          }}
        >
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
          {visibleFiles.map((file) => {
            const isSelected = selectedIds.includes(file.id) || selectedFileId === file.id;
            return (
              <div
                key={file.id}
                role="button"
                tabIndex={0}
                className={clsx(
                  "file-row",
                  isSelected && "is-selected",
                  selectedIds.length > 1 && selectedIds.includes(file.id) && "is-multi-selected",
                  dragTargetId === `row:${file.id}` && "is-drag-target",
                  invalidDragTargetId === `row:${file.id}` && "is-invalid-drag-target",
                )}
                data-context-kind="file"
                data-context-id={file.id}
                draggable={!file.trashed}
                onDragStart={(event) => {
                  if (!selectedIdsRef.current.includes(file.id)) selectSingle(file.id);
                  event.dataTransfer.setData("text/neko-file-id", file.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (file.kind !== "folder" || file.trashed) {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragTargetId(null);
                    setInvalidDragTargetId(`row:${file.id}`);
                    event.dataTransfer.dropEffect = "none";
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setInvalidDragTargetId(null);
                  setDragTargetId(`row:${file.id}`);
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => {
                  setDragTargetId((current) => (current === `row:${file.id}` ? null : current));
                  setInvalidDragTargetId((current) => (current === `row:${file.id}` ? null : current));
                }}
                onDrop={(event) => {
                  if (file.kind !== "folder" || file.trashed) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setDragTargetId(null);
                  setInvalidDragTargetId(null);
                  const draggedId = event.dataTransfer.getData("text/neko-file-id");
                  if (!draggedId || draggedId === file.id) return;
                  void moveDraggedFile(draggedId, file.id);
                }}
                onMouseDown={(event) => handleRowPointerDown(event, file)}
                onFocus={() => handleRowFocus(file)}
                onDoubleClick={() => {
                  if (file.trashed) {
                    void restoreSelected(file);
                    return;
                  }
                  if (file.kind === "folder") openFolderInFilesMode(file.id);
                  else openApp(getFileOpenApp(file));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    file.trashed ? void restoreSelected(file) : file.kind === "folder" ? openFolderInFilesMode(file.id) : openApp(getFileOpenApp(file));
                  }
                  if (event.key === "F2" && !file.trashed) startRename(file);
                  if (event.key === "Delete") file.trashed ? void deleteForever(file) : void deleteSelection(file);
                }}
              >
                <Icon className={clsx("file-row-icon", `kind-${file.kind}`, getFileColorClass(file))} icon={file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:document-text-bold-duotone"} width={22} height={22} />
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
                <span>{formatFileTime(file.trashed ? file.deletedAt ?? file.updatedAt : file.updatedAt, language)}</span>
                <span>{file.kind === "folder" ? `${activeFiles.filter((entry) => (entry.parentId ?? null) === file.id).length} ${t("itemsCount")}` : formatFileSize(file.content)}</span>
              </div>
            );
          })}
          {loaded && visibleFiles.length === 0 ? (
            <div className="empty-state">
              <Icon icon="solar:document-add-bold-duotone" width={28} height={28} />
              <p>{section === "trash" ? t("trashEmpty") : activeFiles.length === 0 ? t("noFilesYet") : t("noFilesMatch")}</p>
            </div>
          ) : null}
        </div>
      </section>
      <div
        className="files-details-handle"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={t("filesResizeDetails")}
        aria-valuemin={DETAILS_WIDTH_MIN}
        aria-valuemax={DETAILS_WIDTH_MAX}
        aria-valuenow={detailsWidth}
        title={t("filesResizeDetails")}
        onPointerDown={beginDetailsResize}
        onDoubleClick={() => {
          setDetailsWidth(DETAILS_WIDTH_DEFAULT);
          writeDetailsWidth(DETAILS_WIDTH_DEFAULT);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 24 : 8;
          let next = detailsWidth;
          if (event.key === "ArrowLeft") next = detailsWidth + step;
          else if (event.key === "ArrowRight") next = detailsWidth - step;
          else if (event.key === "Home") next = DETAILS_WIDTH_MIN;
          else if (event.key === "End") next = DETAILS_WIDTH_MAX;
          else return;
          event.preventDefault();
          const rootWidth = filesRootRef.current?.clientWidth ?? window.innerWidth;
          const dynamicMax = Math.max(DETAILS_WIDTH_MIN, Math.min(DETAILS_WIDTH_MAX, Math.floor(rootWidth * 0.45)));
          next = Math.min(dynamicMax, Math.max(DETAILS_WIDTH_MIN, next));
          setDetailsWidth(next);
          writeDetailsWidth(next);
        }}
      />
      <aside className="file-details">
        <h3>{t("details")}</h3>
        {selectedFile ? (
          <>
            <strong>{selectedFile.name}</strong>
            {multiCount > 1 ? <p className="file-details-multi">{replaceCount(t("filesSelectedCount"), multiCount)}</p> : null}
            <dl>
              {selectedPath ? (
                <div>
                  <dt>{t("filesLocation")}</dt>
                  <dd title={selectedPath}>{selectedPath}</dd>
                </div>
              ) : null}
              {selectedFile.kind === "text" ? (
                <>
                  <div>
                    <dt>{t("fileSize")}</dt>
                    <dd>{formatFileSize(selectedFile.content)}</dd>
                  </div>
                  <div>
                    <dt>{t("words")}</dt>
                    <dd>{wordCount}</dd>
                  </div>
                  <div>
                    <dt>{t("characters")}</dt>
                    <dd>{previewText.length}</dd>
                  </div>
                  <div>
                    <dt>{t("charset")}</dt>
                    <dd>{charSetSize}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt>{t("itemsCount")}</dt>
                  <dd>{folderChildrenCount}</dd>
                </div>
              )}
              <div>
                <dt>{t("updated")}</dt>
                <dd>{formatFileTime(selectedFile.updatedAt, language)}</dd>
              </div>
              {selectedFile.trashed ? (
                <div>
                  <dt>{t("deleted")}</dt>
                  <dd>{formatFileTime(selectedFile.deletedAt ?? selectedFile.updatedAt, language)}</dd>
                </div>
              ) : null}
            </dl>
            {selectedFile.kind === "text" && multiCount <= 1 ? (
              <>
                <p>{t("preview")}</p>
                <pre>{previewText.slice(0, 520) || "(empty file)"}</pre>
              </>
            ) : null}
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

function getFileColorClass(file: FsFile) {
  if (file.kind === "folder") return "tone-folder";
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md")) return "tone-markdown";
  if (lowerName.endsWith(".json")) return "tone-data";
  if (lowerName.endsWith(".txt")) return "tone-text";
  return "tone-generic";
}

function buildFolderChain(currentFolderId: string, files: FsFile[]) {
  const chain: typeof files = [];
  let cursor = files.find((file) => file.id === currentFolderId && file.kind === "folder") ?? null;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? files.find((file) => file.id === cursor?.parentId && file.kind === "folder") ?? null : null;
  }
  return chain;
}

function formatEntryPath(file: FsFile, files: FsFile[]) {
  const parts: string[] = [];
  let parentId = file.parentId;
  while (parentId) {
    const parent = files.find((item) => item.id === parentId && item.kind === "folder");
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentId;
  }
  parts.push(file.name);
  return `/${parts.join("/")}`;
}
