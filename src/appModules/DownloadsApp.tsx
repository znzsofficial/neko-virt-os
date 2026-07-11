import { Icon } from "@iconify-icon/react";
import { formatBytes } from "../formatUtils";
import { useDownloadStore } from "../downloadStore";
import { useLanguageStore } from "../languageStore";

export function DownloadsApp() {
  const entries = useDownloadStore((state) => state.entries);
  const removeDownload = useDownloadStore((state) => state.removeDownload);
  const clearDownloads = useDownloadStore((state) => state.clearDownloads);
  const t = useLanguageStore((state) => state.t);

  return (
    <div className="downloads-app">
      <div className="app-toolbar compact">
        <div>
          <h2>{t("appDownloads")}</h2>
          <p>{entries.length ? `${entries.length} ${t("itemsCount")}` : t("downloadsEmpty")}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="button-ghost" disabled={!entries.length} onClick={clearDownloads}>
            {t("downloadsClear")}
          </button>
        </div>
      </div>
      <div className="downloads-list">
        {entries.length ? entries.map((entry) => (
          <article key={entry.id} className="download-item">
            <div className="download-meta">
              <div>
                <strong>{entry.name}</strong>
                <p>{entry.source} · {new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <span>{entry.size ? formatBytes(entry.size) : t("unavailable")}</span>
            </div>
            <div className="download-actions-row">
              <span>{entry.url ? t("downloadsReady") : t("downloadsSessionOnly")}</span>
              <div className="toolbar-actions">
                {entry.url ? <a className="button-ghost" href={entry.url} download={entry.name}>{t("downloadsSaveAgain")}</a> : null}
                <button type="button" className="button-ghost" onClick={() => removeDownload(entry.id)}>{t("delete")}</button>
              </div>
            </div>
          </article>
        )) : (
          <div className="empty-state">
            <Icon icon="solar:download-bold-duotone" width={34} height={34} />
            <p>{t("downloadsEmpty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
