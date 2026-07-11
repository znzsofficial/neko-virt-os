import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { NavItem } from "../components/NavItem";
import { translateFileError } from "../fileErrorUtils";
import { getFileOpenApp } from "../fileOpen";
import { formatFileSize, formatFileTime, sortFiles } from "../fileUtils";
import { useFsStore } from "../fsStore";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import type { FileSortMode } from "../types";
import type { FsFile } from "../virtualFs";
import { useDesktopStore } from "../windowStore";

function phrase(t: (key: TranslationKey) => string, prefix: TranslationKey, value: string | number, suffix: TranslationKey) {
  return `${t(prefix)}${value}${t(suffix)}`;
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
  const visibleFiles = sortFiles(
    (section === "recent" ? recentFiles : section === "trash" ? trashedFiles : activeFiles.filter((file) => (file.parentId ?? null) === currentFolderId)).filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase())),
    effectiveSortMode,
  );
  const previewText = selectedFile?.kind === "text" ? selectedFile.content : "";
  const wordCount = previewText.trim() ? previewText.trim().split(/\s+/).length : 0;
  const charSetSize = new Set(previewText).size;
  const folderChildrenCount = selectedFile?.kind === "folder" ? activeFiles.filter((file) => (file.parentId ?? null) === selectedFile.id).length : 0;
  const folderChain = currentFolderId ? buildFolderChain(currentFolderId, activeFiles) : [];
  const canGoBack = section === "files" && folderHistoryIndex > 0;
  const canGoForward = section === "files" && folderHistoryIndex < folderHistory.length - 1;

  async function commitNewFile() {
    if (!newFileDraft.trim()) {
      setCreatingFile(false);
      setNewFileDraft("Untitled.md");
      return;
    }
    const result = await createNamedFile(newFileDraft, currentFolderId);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    setCreatingFile(false);
    setNewFileDraft("Untitled.md");
    if (result.file) selectFile(result.file.id);
    addNotification({ title: t("fileCreated"), message: `${result.file?.name ?? t("newFile")}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
  }

  function startCreateFile() {
    setSection("files");
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

  function navigateToFolder(folderId: string | null, mode: "push" | "replace" = "push") {
    setCurrentFolderId(folderId);
    if (mode === "replace") {
      setFolderHistory((current) => current.map((entry, index) => index === folderHistoryIndex ? folderId : entry));
      return;
    }
    setFolderHistory((current) => [...current.slice(0, folderHistoryIndex + 1), folderId]);
    setFolderHistoryIndex((current) => current + 1);
  }

  function stepFolderHistory(direction: -1 | 1) {
    setFolderHistoryIndex((current) => {
      const nextIndex = current + direction;
      const nextFolderId = folderHistory[nextIndex];
      if (nextIndex < 0 || nextIndex >= folderHistory.length || nextFolderId === undefined) return current;
      setCurrentFolderId(nextFolderId);
      return nextIndex;
    });
  }

  async function createFolderInCurrentLocation() {
    const name = window.prompt(t("createFolderPrompt"), t("newFolderLabel"));
    if (!name || !name.trim()) return;
    const result = await createFolder(name, currentFolderId);
    if (result.error) {
      addNotification({ title: t("createFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    if (result.file) {
      selectFile(result.file.id);
      addNotification({ title: t("folderCreated"), message: `${result.file.name}${t("createdSuffix")}`, type: "success", category: "files", appId: "files" });
    }
  }

  useEffect(() => {
    (globalThis as any).__files_start_create = startCreateFile;
    return () => {
      if ((globalThis as any).__files_start_create === startCreateFile) {
        delete (globalThis as any).__files_start_create;
      }
    };
  });

  useEffect(() => {
    (globalThis as any).__files_create_folder = createFolderInCurrentLocation;
    return () => {
      if ((globalThis as any).__files_create_folder === createFolderInCurrentLocation) {
        delete (globalThis as any).__files_create_folder;
      }
    };
  });

  useEffect(() => {
    (globalThis as any).__files_open_folder = openFolderLocation;
    return () => {
      if ((globalThis as any).__files_open_folder === openFolderLocation) {
        delete (globalThis as any).__files_open_folder;
      }
    };
  });

  useEffect(() => {
    if (section !== "files") return;
    if (!currentFolderId) return;
    const currentExists = activeFiles.some((file) => file.id === currentFolderId && file.kind === "folder");
    if (!currentExists) {
      setCurrentFolderId(null);
      setFolderHistory((current) => current.map((entry) => entry === currentFolderId ? null : entry));
    }
  }, [activeFiles, currentFolderId, section]);

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
      window.alert(translateFileError(result.error, t));
      addNotification({ title: t("renameFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
    } else {
      setRenamingFileId(null);
      addNotification({ title: t("fileRenamed"), message: phrase(t, "fileRenamedPrefix", renameDraft, "fileRenamedSuffix"), type: "success", category: "files", appId: "files" });
    }
  }

  async function deleteSelected(fileToDelete = selectedFile) {
    if (!fileToDelete) return;
    selectFile(fileToDelete.id);
    if (!window.confirm(phrase(t, "confirmMoveToTrashPrefix", fileToDelete.name, "confirmMoveToTrashSuffix"))) return;
    await deleteSelectedFile();
    addNotification({ title: t("movedToTrash"), message: `${fileToDelete.name}${t("canRestoreFromTrashSuffix")}`, type: "success", category: "files", appId: "trash" });
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
    if (!window.confirm(phrase(t, "confirmPermanentDeletePrefix", fileToDelete.name, "confirmPermanentDeleteSuffix"))) return;
    await permanentlyDeleteSelectedFile();
    addNotification({ title: t("fileDeleted"), message: `${fileToDelete.name}${t("permanentlyDeletedSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function emptyTrashFromFiles() {
    if (!trashedFiles.length) return;
    if (!window.confirm(phrase(t, "confirmEmptyTrashPrefix", trashedFiles.length, "confirmEmptyTrashSuffix"))) return;
    await emptyTrash();
    addNotification({ title: t("trashEmptied"), message: t("trashEmptiedMessage"), type: "success", category: "files", appId: "trash" });
  }

  async function moveDraggedFile(draggedId: string, targetFolderId: string | null) {
    const result = await moveFileById(draggedId, targetFolderId);
    if (result.error) {
      addNotification({ title: t("moveFailed"), message: translateFileError(result.error, t), type: "error", category: "files", appId: "files" });
      return;
    }
    if (result.file) {
      addNotification({ title: t("itemMoved"), message: `${result.file.name}${t("itemMovedSuffix")}`, type: "success", category: "files", appId: "files" });
    }
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
            <p>{section === "trash" ? `${trashedFiles.length} ${t("trash")}` : section === "recent" ? `${recentFiles.length} ${t("filesCount")}` : currentFolder ? currentFolder.name : loaded ? `${activeFiles.filter((file) => (file.parentId ?? null) === currentFolderId).length} ${t("filesCount")}` : t("mountingFs")}</p>
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
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed || selectedFile?.kind !== "text"} onClick={() => selectedFile && openApp(getFileOpenApp(selectedFile))}><Icon icon="solar:login-2-bold-duotone" width={16} height={16} />{t("open")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => startRename()}><Icon icon="solar:pen-new-square-bold-duotone" width={16} height={16} />{t("rename")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => void deleteSelected()}><Icon icon="solar:trash-bin-trash-bold-duotone" width={16} height={16} />{t("delete")}</button>
                <button className="button-primary" onClick={() => void createFolderInCurrentLocation()}><Icon icon="solar:folder-add-bold" width={18} height={18} />{t("createFolder")}</button>
                <button className="button-primary" onClick={startCreateFile}><Icon icon="solar:add-circle-bold" width={16} height={16} />{t("newFile")}</button>
              </>
            )}
          </div>
        </div>
        {section === "files" ? <div className="file-breadcrumbs" aria-label={t("currentPath")}>{[null, ...folderChain.map((folder) => folder.id)].map((folderId, index) => <button key={folderId ?? "root"} className={clsx("button-ghost", (folderId ?? null) === currentFolderId && "is-active", dragTargetId === `crumb:${folderId ?? "root"}` && "is-drag-target")} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setInvalidDragTargetId(null); setDragTargetId(`crumb:${folderId ?? "root"}`); event.dataTransfer.dropEffect = "move"; }} onDragLeave={() => { setDragTargetId((current) => current === `crumb:${folderId ?? "root"}` ? null : current); setInvalidDragTargetId((current) => current === `crumb:${folderId ?? "root"}` ? null : current); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragTargetId(null); setInvalidDragTargetId(null); const draggedId = event.dataTransfer.getData("text/neko-file-id"); if (!draggedId) return; void moveDraggedFile(draggedId, folderId ?? null); }} onClick={() => navigateToFolder(folderId)}>{index === 0 ? t("home") : folderChain[index - 1].name}</button>)}</div> : null}
        <div className="file-controls">
          <label className="file-search"><Icon icon="solar:magnifer-bold-duotone" width={16} height={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchFiles")} spellCheck="false" /></label>
          <label className="file-sort">{t("sort")}<select value={sortMode} onChange={(event) => setSortMode(event.target.value as FileSortMode)}><option value="updated">{t("updatedSort")}</option><option value="name">{t("nameSort")}</option><option value="size">{t("sizeSort")}</option></select></label>
        </div>
        <div className={clsx("file-list", dragTargetId === "list" && "is-drag-target", invalidDragTargetId === "list" && "is-invalid-drag-target")} data-context-kind="files-empty" onDragOver={(event) => { if (section !== "files") return; event.preventDefault(); setInvalidDragTargetId(null); setDragTargetId("list"); event.dataTransfer.dropEffect = "move"; }} onDragLeave={() => { setDragTargetId((current) => current === "list" ? null : current); setInvalidDragTargetId((current) => current === "list" ? null : current); }} onDrop={(event) => { if (section !== "files") return; event.preventDefault(); setDragTargetId(null); setInvalidDragTargetId(null); const draggedId = event.dataTransfer.getData("text/neko-file-id"); if (!draggedId) return; void moveDraggedFile(draggedId, currentFolderId); }}>
          {creatingFile ? <div className="file-row file-row-new"><Icon icon="solar:document-add-bold-duotone" width={22} height={22} /><input className="file-rename-input" autoFocus value={newFileDraft} onChange={(event) => setNewFileDraft(event.target.value)} onBlur={(event) => { if (event.currentTarget.dataset.cancelled === "true") return; void commitNewFile(); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") void commitNewFile(); if (event.key === "Escape") { event.currentTarget.dataset.cancelled = "true"; setCreatingFile(false); } }} /><span>{t("newFileLabel")}</span><span>0 B</span></div> : null}
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              role="button"
              tabIndex={0}
              className={clsx("file-row", selectedFileId === file.id && "is-selected", dragTargetId === `row:${file.id}` && "is-drag-target", invalidDragTargetId === `row:${file.id}` && "is-invalid-drag-target")}
              data-context-kind="file"
              data-context-id={file.id}
              draggable={!file.trashed}
              onDragStart={(event) => {
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
              onDragLeave={() => { setDragTargetId((current) => current === `row:${file.id}` ? null : current); setInvalidDragTargetId((current) => current === `row:${file.id}` ? null : current); }}
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
              onClick={() => selectFile(file.id)}
              onFocus={() => selectFile(file.id)}
              onDoubleClick={() => file.trashed ? void restoreSelected(file) : file.kind === "folder" ? openFolderInFilesMode(file.id) : openApp(getFileOpenApp(file))}
              onKeyDown={(event) => { if (event.key === "Enter") file.trashed ? void restoreSelected(file) : file.kind === "folder" ? openFolderInFilesMode(file.id) : openApp(getFileOpenApp(file)); if (event.key === "F2" && !file.trashed) startRename(file); if (event.key === "Delete") file.trashed ? void deleteForever(file) : void deleteSelected(file); }}
            >
              <Icon className={clsx("file-row-icon", `kind-${file.kind}`, getFileColorClass(file))} icon={file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:document-text-bold-duotone"} width={22} height={22} />
              {renamingFileId === file.id ? <input className="file-rename-input" autoFocus value={renameDraft} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => void commitRename(file)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") void commitRename(file); if (event.key === "Escape") setRenamingFileId(null); }} /> : <span className="file-name">{file.name}</span>}
              <span>{formatFileTime(file.trashed ? file.deletedAt ?? file.updatedAt : file.updatedAt, language)}</span>
              <span>{file.kind === "folder" ? `${activeFiles.filter((entry) => (entry.parentId ?? null) === file.id).length} ${t("itemsCount")}` : formatFileSize(file.content)}</span>
            </div>
          ))}
          {loaded && visibleFiles.length === 0 ? <div className="empty-state"><Icon icon="solar:document-add-bold-duotone" width={28} height={28} /><p>{section === "trash" ? t("trashEmpty") : activeFiles.length === 0 ? t("noFilesYet") : t("noFilesMatch")}</p></div> : null}
        </div>
      </section>
      <aside className="file-details">
        <h3>{t("details")}</h3>
        {selectedFile ? <><strong>{selectedFile.name}</strong><dl>{selectedFile.kind === "text" ? <><div><dt>{t("fileSize")}</dt><dd>{formatFileSize(selectedFile.content)}</dd></div><div><dt>{t("words")}</dt><dd>{wordCount}</dd></div><div><dt>{t("characters")}</dt><dd>{previewText.length}</dd></div><div><dt>{t("charset")}</dt><dd>{charSetSize}</dd></div></> : <div><dt>{t("itemsCount")}</dt><dd>{folderChildrenCount}</dd></div>}<div><dt>{t("updated")}</dt><dd>{formatFileTime(selectedFile.updatedAt, language)}</dd></div>{selectedFile.trashed ? <div><dt>{t("deleted")}</dt><dd>{formatFileTime(selectedFile.deletedAt ?? selectedFile.updatedAt, language)}</dd></div> : null}</dl>{selectedFile.kind === "text" ? <><p>{t("preview")}</p><pre>{previewText.slice(0, 520) || "(empty file)"}</pre></> : null}</> : <div className="empty-state compact"><Icon icon="solar:document-text-bold-duotone" width={24} height={24} /><p>{t("noFileDetails")}</p></div>}
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
