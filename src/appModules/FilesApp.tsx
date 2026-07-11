import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useState } from "react";
import { NavItem } from "../components/NavItem";
import { formatFileSize, formatFileTime, sortFiles } from "../fileUtils";
import { useFsStore } from "../fsStore";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import type { FileSortMode } from "../types";
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
      addNotification({ title: t("renameFailed"), message: result.error, type: "error" });
    } else {
      setRenamingFileId(null);
      addNotification({ title: t("fileRenamed"), message: phrase(t, "fileRenamedPrefix", renameDraft, "fileRenamedSuffix"), type: "success" });
    }
  }

  async function deleteSelected(fileToDelete = selectedFile) {
    if (!fileToDelete) return;
    selectFile(fileToDelete.id);
    if (!window.confirm(phrase(t, "confirmMoveToTrashPrefix", fileToDelete.name, "confirmMoveToTrashSuffix"))) return;
    await deleteSelectedFile();
    addNotification({ title: t("movedToTrash"), message: `${fileToDelete.name}${t("canRestoreFromTrashSuffix")}`, type: "success" });
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
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void restoreSelected()}><Icon icon="solar:undo-left-round-bold-duotone" width={16} height={16} />{t("restore")}</button>
                <button className="button-ghost" disabled={!selectedFile?.trashed} onClick={() => void deleteForever()}><Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={16} height={16} />{t("deleteForever")}</button>
                <button className="button-primary" disabled={!trashedFiles.length} onClick={() => void emptyTrashFromFiles()}>{t("emptyTrash")}</button>
              </>
            ) : (
              <>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => openApp("notes")}><Icon icon="solar:login-2-bold-duotone" width={16} height={16} />{t("open")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => startRename()}><Icon icon="solar:pen-new-square-bold-duotone" width={16} height={16} />{t("rename")}</button>
                <button className="button-ghost" disabled={!selectedFileId || selectedFile?.trashed} onClick={() => void deleteSelected()}><Icon icon="solar:trash-bin-trash-bold-duotone" width={16} height={16} />{t("delete")}</button>
                <button className="button-primary" onClick={startCreateFile}><Icon icon="solar:add-circle-bold" width={16} height={16} />{t("newFile")}</button>
              </>
            )}
          </div>
        </div>
        <div className="file-controls">
          <label className="file-search"><Icon icon="solar:magnifer-bold-duotone" width={16} height={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchFiles")} spellCheck="false" /></label>
          <label className="file-sort">{t("sort")}<select value={sortMode} onChange={(event) => setSortMode(event.target.value as FileSortMode)}><option value="updated">{t("updatedSort")}</option><option value="name">{t("nameSort")}</option><option value="size">{t("sizeSort")}</option></select></label>
        </div>
        <div className="file-list" data-context-kind="files-empty">
          {creatingFile ? <div className="file-row file-row-new"><Icon icon="solar:document-add-bold-duotone" width={22} height={22} /><input className="file-rename-input" autoFocus value={newFileDraft} onChange={(event) => setNewFileDraft(event.target.value)} onBlur={(event) => { if (event.currentTarget.dataset.cancelled === "true") return; void commitNewFile(); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") void commitNewFile(); if (event.key === "Escape") { event.currentTarget.dataset.cancelled = "true"; setCreatingFile(false); } }} /><span>{t("newFileLabel")}</span><span>0 B</span></div> : null}
          {visibleFiles.map((file) => (
            <div key={file.id} role="button" tabIndex={0} className={clsx("file-row", selectedFileId === file.id && "is-selected")} data-context-kind="file" data-context-id={file.id} onClick={() => selectFile(file.id)} onFocus={() => selectFile(file.id)} onDoubleClick={() => file.trashed ? void restoreSelected(file) : openApp("notes")} onKeyDown={(event) => { if (event.key === "Enter") file.trashed ? void restoreSelected(file) : openApp("notes"); if (event.key === "F2" && !file.trashed) startRename(file); if (event.key === "Delete") file.trashed ? void deleteForever(file) : void deleteSelected(file); }}>
              <Icon icon="solar:document-text-bold-duotone" width={22} height={22} />
              {renamingFileId === file.id ? <input className="file-rename-input" autoFocus value={renameDraft} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => void commitRename(file)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") void commitRename(file); if (event.key === "Escape") setRenamingFileId(null); }} /> : <span className="file-name">{file.name}</span>}
              <span>{formatFileTime(file.trashed ? file.deletedAt ?? file.updatedAt : file.updatedAt)}</span>
              <span>{formatFileSize(file.content)}</span>
            </div>
          ))}
          {loaded && visibleFiles.length === 0 ? <div className="empty-state"><Icon icon="solar:document-add-bold-duotone" width={28} height={28} /><p>{section === "trash" ? t("trashEmpty") : activeFiles.length === 0 ? t("noFilesYet") : t("noFilesMatch")}</p></div> : null}
        </div>
      </section>
      <aside className="file-details">
        <h3>{t("details")}</h3>
        {selectedFile ? <><strong>{selectedFile.name}</strong><dl><div><dt>{t("fileSize")}</dt><dd>{formatFileSize(selectedFile.content)}</dd></div><div><dt>{t("words")}</dt><dd>{wordCount}</dd></div><div><dt>{t("characters")}</dt><dd>{previewText.length}</dd></div><div><dt>{t("charset")}</dt><dd>{charSetSize}</dd></div><div><dt>{t("updated")}</dt><dd>{formatFileTime(selectedFile.updatedAt)}</dd></div>{selectedFile.trashed ? <div><dt>{t("deleted")}</dt><dd>{formatFileTime(selectedFile.deletedAt ?? selectedFile.updatedAt)}</dd></div> : null}</dl><p>{t("preview")}</p><pre>{previewText.slice(0, 520) || "(empty file)"}</pre></> : <div className="empty-state compact"><Icon icon="solar:document-text-bold-duotone" width={24} height={24} /><p>{t("noFileDetails")}</p></div>}
      </aside>
    </div>
  );
}
