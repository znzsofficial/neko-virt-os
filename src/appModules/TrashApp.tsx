import { Icon } from "@iconify-icon/react";
import { formatFileTime } from "../fs";
import { appConfirm } from "../dialogStore";
import { useFsStore } from "../fs";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useNotificationStore } from "../notificationStore";

function phrase(t: (key: TranslationKey) => string, prefix: TranslationKey, value: string | number, suffix: TranslationKey) {
  return `${t(prefix)}${value}${t(suffix)}`;
}

export function TrashApp() {
  const files = useFsStore((state) => state.files);
  const selectedFileId = useFsStore((state) => state.selectedFileId);
  const selectFile = useFsStore((state) => state.selectFile);
  const restoreFileById = useFsStore((state) => state.restoreFileById);
  const permanentlyDeleteFileById = useFsStore((state) => state.permanentlyDeleteFileById);
  const emptyTrash = useFsStore((state) => state.emptyTrash);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const trashedFiles = files.filter((file) => file.trashed).sort((a, b) => (b.deletedAt ?? b.updatedAt) - (a.deletedAt ?? a.updatedAt));
  const selectedFile = trashedFiles.find((file) => file.id === selectedFileId) ?? trashedFiles[0] ?? null;

  async function restoreEntry(id: string) {
    const file = trashedFiles.find((entry) => entry.id === id);
    if (!file) return;
    await restoreFileById(id);
    addNotification({ title: t("restore"), message: `${file.name}${t("restoredSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function deleteForever(id: string) {
    const file = trashedFiles.find((entry) => entry.id === id);
    if (!file) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmPermanentDeletePrefix", file.name, "confirmPermanentDeleteSuffix"),
      confirmLabel: t("deleteForever"),
      danger: true,
    });
    if (!ok) return;
    await permanentlyDeleteFileById(id);
    addNotification({ title: t("fileDeleted"), message: `${file.name}${t("permanentlyDeletedSuffix")}`, type: "success", category: "files", appId: "trash" });
  }

  async function clearTrash() {
    if (!trashedFiles.length) return;
    const ok = await appConfirm({
      title: t("dialogConfirmTitle"),
      message: phrase(t, "confirmEmptyTrashPrefix", trashedFiles.length, "confirmEmptyTrashSuffix"),
      confirmLabel: t("emptyTrash"),
      danger: true,
    });
    if (!ok) return;
    await emptyTrash();
    addNotification({ title: t("trashEmptied"), message: t("trashEmptiedMessage"), type: "success", category: "files", appId: "trash" });
  }

  return (
    <div className="trash-app">
      <div className="app-toolbar compact">
        <div>
          <h2>{t("appTrash")}</h2>
          <p>{trashedFiles.length ? `${trashedFiles.length} ${t("itemsCount")}` : t("trashEmpty")}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="button-ghost" disabled={!selectedFile} onClick={() => selectedFile ? void restoreEntry(selectedFile.id) : undefined}>
            <Icon icon="solar:undo-left-round-bold-duotone" width={16} height={16} />
            {t("restore")}
          </button>
          <button type="button" className="button-ghost" disabled={!selectedFile} onClick={() => selectedFile ? void deleteForever(selectedFile.id) : undefined}>
            <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={16} height={16} />
            {t("deleteForever")}
          </button>
          <button type="button" className="button-primary" disabled={!trashedFiles.length} onClick={() => void clearTrash()}>
            {t("emptyTrash")}
          </button>
        </div>
      </div>
      <div className="trash-list">
        {trashedFiles.length ? trashedFiles.map((file) => (
          <button
            key={file.id}
            type="button"
            className={`trash-row${selectedFile?.id === file.id ? " is-selected" : ""}`}
            onClick={() => selectFile(file.id)}
            onDoubleClick={() => void restoreEntry(file.id)}
          >
            <Icon icon={file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:file-text-bold-duotone"} width={18} height={18} />
            <span className="file-name">{file.name}</span>
            <span>{file.kind === "folder" ? t("createFolder") : t("appNotes")}</span>
            <span>{formatFileTime(file.deletedAt ?? file.updatedAt, language)}</span>
          </button>
        )) : (
          <div className="empty-state">
            <Icon icon="solar:trash-bin-trash-bold-duotone" width={34} height={34} />
            <p>{t("trashEmpty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
