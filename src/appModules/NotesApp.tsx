import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useFsStore } from "../fsStore";
import { useLanguageStore } from "../languageStore";
import { clearNoteWindowDirty, getNoteWindowFile, setNoteWindowDirty, setNoteWindowFile } from "../shell/windowLifecycle";
import { useDesktopStore } from "../windowStore";

export function NotesApp({ windowId }: { windowId?: string }) {
  const t = useLanguageStore((state) => state.t);
  const files = useFsStore((state) => state.files);
  const selectedFileId = useFsStore((state) => state.selectedFileId);
  const saveFileDraft = useFsStore((state) => state.saveFileDraft);
  const createFile = useFsStore((state) => state.createFile);
  const openApp = useDesktopStore((state) => state.openApp);
  const [localFileId, setLocalFileId] = useState<string | null>(() => windowId ? getNoteWindowFile(windowId) : selectedFileId);
  const selectedFile = files.find((file) => !file.trashed && file.kind === "text" && file.id === localFileId) ?? files.find((file) => !file.trashed && file.kind === "text" && file.id === selectedFileId) ?? null;
  const [draft, setDraft] = useState(() => selectedFile?.content ?? "");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
  const [dirty, setDirty] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    if (!windowId) return;
    setNoteWindowDirty(windowId, dirty);
    return () => clearNoteWindowDirty(windowId);
  }, [windowId, dirty]);

  useEffect(() => {
    if (!windowId) return;
    const mappedFileId = getNoteWindowFile(windowId);
    if (mappedFileId && mappedFileId !== localFileId) {
      setLocalFileId(mappedFileId);
    }
  }, [windowId, localFileId]);

  useEffect(() => {
    if (!selectedFile) return;
    if (!localFileId) setLocalFileId(selectedFile.id);
    if (windowId) setNoteWindowFile(windowId, selectedFile.id);
    if (!dirty) setDraft(selectedFile.content);
  }, [selectedFile?.id, selectedFile?.content, dirty, localFileId, windowId]);

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

  async function createFileInCurrentFolder() {
    const parentId = selectedFile?.parentId ?? null;
    const file = await createFile(parentId);
    const nextWindowId = openApp("notes");
    if (nextWindowId) setNoteWindowFile(nextWindowId, file.id);
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
            void createFileInCurrentFolder();
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
          <button className="button-primary" onClick={() => void createFileInCurrentFolder()}>{t("createFile")}</button>
        </div>
      )}
    </div>
  );
}
