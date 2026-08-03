import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { setOwnedLocalStorageItem } from "../system/persistenceGate";

type ClipboardEntry = { id: string; text: string; createdAt: number };

const CLIPBOARD_HISTORY_STORAGE_KEY = "neko-virt-os.clipboard-history.v1";

function readClipboardHistory(): ClipboardEntry[] {
  try {
    const raw = localStorage.getItem(CLIPBOARD_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((entry) => ({
        id: String(entry.id ?? ""),
        text: String(entry.text ?? ""),
        createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
      }))
      .filter((entry) => entry.id && entry.text);
  } catch {
    return [];
  }
}

export function ClipboardApp() {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<ClipboardEntry[]>(readClipboardHistory);
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    try {
      setOwnedLocalStorageItem(CLIPBOARD_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore quota / private mode
    }
  }, [history]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setDraft(text);
      addNotification({ title: t("clipboardLoaded"), message: t("clipboardLoadedMessage"), type: "success", category: "apps", appId: "clipboard" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("clipboardReadFailedMessage"), type: "error", category: "apps", appId: "clipboard" });
    }
  }

  async function copyDraft() {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      addNotification({ title: t("clipboardCopied"), message: t("clipboardCopiedMessage"), type: "success", category: "apps", appId: "clipboard" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error", category: "apps", appId: "clipboard" });
    }
  }

  function saveSnippet() {
    const text = draft.trim();
    if (!text) return;
    setHistory((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, createdAt: Date.now() }, ...current.filter((entry) => entry.text !== text)].slice(0, 12));
    addNotification({ title: t("clipboardSaved"), message: t("clipboardSavedMessage"), type: "success", category: "apps", appId: "clipboard" });
  }

  return (
    <div className="clipboard-app">
      <div className="app-toolbar compact">
        <div>
          <h2>{t("appClipboard")}</h2>
          <p>{history.length ? `${history.length} ${t("itemsCount")}` : t("clipboardNoItems")}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="button-ghost" onClick={() => void pasteFromClipboard()}>
            <Icon icon="solar:clipboard-text-bold-duotone" width={16} height={16} />
            {t("clipboardPaste")}
          </button>
          <button type="button" className="button-ghost" disabled={!draft.trim()} onClick={() => void copyDraft()}>
            <Icon icon="solar:copy-bold-duotone" width={16} height={16} />
            {t("copy")}
          </button>
          <button type="button" className="button-primary" disabled={!draft.trim()} onClick={saveSnippet}>
            {t("clipboardSaveSnippet")}
          </button>
        </div>
      </div>
      <div className="clipboard-layout">
        <div className="clipboard-editor">
          <textarea value={draft} placeholder={t("clipboardPlaceholder")} onChange={(event) => setDraft(event.target.value)} />
        </div>
        <div className="clipboard-history">
          <div className="clipboard-history-header">
            <strong>{t("clipboardHistory")}</strong>
            <button type="button" className="button-ghost" disabled={!history.length} onClick={() => setHistory([])}>
              {t("clearNotifications")}
            </button>
          </div>
          {history.length ? history.map((entry) => (
            <button key={entry.id} type="button" className="clipboard-item" onClick={() => setDraft(entry.text)}>
              <strong>{new Date(entry.createdAt).toLocaleString()}</strong>
              <span>{entry.text}</span>
            </button>
          )) : (
            <div className="empty-state compact">
              <Icon icon="solar:clipboard-remove-bold-duotone" width={28} height={28} />
              <p>{t("clipboardNoItems")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
