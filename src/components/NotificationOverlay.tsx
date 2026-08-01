import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { useOsUiStore } from "../osUiStore";
import { useDesktopStore } from "../windowStore";
import type { AppId, NotificationCategory } from "../types";
import type { TranslationKey } from "../languageStore";

const CATEGORIES: NotificationCategory[] = ["system", "files", "apps", "media"];
const categoryKeys: Record<NotificationCategory, TranslationKey> = {
  system: "notificationCategorySystem",
  files: "notificationCategoryFiles",
  apps: "notificationCategoryApps",
  media: "notificationCategoryMedia",
};

export function NotificationOverlay() {
  const notifications = useNotificationStore((state) => state.notifications);
  const history = useNotificationStore((state) => state.history);
  const dismissNotification = useNotificationStore((state) => state.dismissNotification);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const clearHistory = useNotificationStore((state) => state.clearHistory);
  const centerOpen = useOsUiStore((state) => state.notificationCenterOpen);
  const setCenterOpen = useOsUiStore((state) => state.setNotificationCenterOpen);
  const prefs = useOsUiStore((state) => state.notificationPrefs);
  const setPrefs = useOsUiStore((state) => state.setNotificationPrefs);
  const openApp = useDesktopStore((state) => state.openApp);
  const t = useLanguageStore((state) => state.t);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  const filteredHistory = useMemo(
    () => history.filter((item) => filter === "all" || (item.category ?? "system") === filter),
    [filter, history],
  );

  function activateNotification(appId?: AppId) {
    if (appId) openApp(appId);
    setCenterOpen(false);
  }

  return (
    <>
      <div className="notification-overlay" aria-live="assertive">
        {notifications.length ? (
          <div className="notification-toolbar">
            <span>{`${t("notificationCountPrefix")}${notifications.length}${t("notificationCountSuffix")}`}</span>
            <button type="button" className="notification-clear" onClick={clearNotifications}>
              {t("clearNotifications")}
            </button>
          </div>
        ) : null}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={clsx("notification-toast", n.type, n.appId && "is-clickable", n.leaving && "is-leaving")}
            onClick={() => {
              if (!n.appId) return;
              activateNotification(n.appId);
              dismissNotification(n.id);
            }}
          >
            <div className="notification-icon">
              {n.type === "success" && <Icon icon="solar:check-circle-bold" width={20} height={20} />}
              {n.type === "error" && <Icon icon="solar:danger-bold" width={20} height={20} />}
              {n.type === "warning" && <Icon icon="solar:info-square-bold" width={20} height={20} />}
              {(!n.type || n.type === "info") && <Icon icon="solar:bell-bold" width={20} height={20} />}
            </div>
            <div className="notification-content">
              <h3>{n.title}</h3>
              <p>{n.message}</p>
              <small>{t(categoryKeys[n.category ?? "system"])}</small>
            </div>
            <button
              className="notification-close"
              onClick={(event) => {
                event.stopPropagation();
                dismissNotification(n.id);
              }}
              aria-label={t("closeNotification")}
            >
              <Icon icon="solar:close-circle-bold" width={16} height={16} />
            </button>
            {n.duration !== 0 && n.createdAt ? <div className="notification-progress" style={{ ["--notification-duration" as string]: `${n.duration ?? 3500}ms` }} /> : null}
          </div>
        ))}
      </div>

      {centerOpen ? (
        <div className="notification-center" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div>
              <strong>{t("notificationCenter")}</strong>
              <p>{prefs.dndEnabled ? t("notificationDndOn") : t("notificationDndOff")}</p>
            </div>
            <button type="button" className="button-ghost" onClick={() => setCenterOpen(false)}>{t("close")}</button>
          </header>

          <div className="notification-dnd">
            <label>
              <input
                type="checkbox"
                checked={prefs.dndEnabled}
                onChange={(event) => setPrefs({ dndEnabled: event.target.checked })}
              />
              {t("notificationDndToggle")}
            </label>
            <div className="notification-dnd-times">
              <input type="time" value={prefs.dndStart} onChange={(event) => setPrefs({ dndStart: event.target.value })} />
              <span>—</span>
              <input type="time" value={prefs.dndEnd} onChange={(event) => setPrefs({ dndEnd: event.target.value })} />
            </div>
          </div>

          <div className="notification-filters">
            <button type="button" className={filter === "all" ? "is-active" : undefined} onClick={() => setFilter("all")}>{t("tasksFilterAll")}</button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={filter === category ? "is-active" : undefined}
                onClick={() => setFilter(category)}
              >
                {t(categoryKeys[category])}
              </button>
            ))}
          </div>

          <div className="notification-history">
            {filteredHistory.length ? filteredHistory.map((item) => (
              <button
                key={`${item.id}-history`}
                type="button"
                className="notification-history-item"
                onClick={() => activateNotification(item.appId)}
              >
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{t(categoryKeys[item.category ?? "system"])}</small>
              </button>
            )) : <p className="notification-empty">{t("notificationEmpty")}</p>}
          </div>

          <footer>
            <button type="button" className="button-ghost" onClick={clearHistory}>{t("notificationClearHistory")}</button>
          </footer>
        </div>
      ) : null}
    </>
  );
}
