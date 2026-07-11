import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";

export function NotificationOverlay() {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const t = useLanguageStore((state) => state.t);

  return (
    <div className="notification-overlay" aria-live="assertive">
      {notifications.length ? (
        <div className="notification-toolbar">
          <span>{notifications.length}</span>
          <button type="button" className="notification-clear" onClick={clearNotifications}>
            {t("clearNotifications")}
          </button>
        </div>
      ) : null}
      {notifications.map((n) => (
        <div key={n.id} className={clsx("notification-toast", n.type)}>
          <div className="notification-icon">
            {n.type === "success" && <Icon icon="solar:check-circle-bold" width={20} height={20} />}
            {n.type === "error" && <Icon icon="solar:danger-bold" width={20} height={20} />}
            {n.type === "warning" && <Icon icon="solar:info-square-bold" width={20} height={20} />}
            {(!n.type || n.type === "info") && <Icon icon="solar:bell-bold" width={20} height={20} />}
          </div>
          <div className="notification-content">
            <h3>{n.title}</h3>
            <p>{n.message}</p>
          </div>
          <button className="notification-close" onClick={() => removeNotification(n.id)} aria-label={t("closeNotification")}>
            <Icon icon="solar:close-circle-bold" width={16} height={16} />
          </button>
          {n.duration !== 0 && n.createdAt ? <div className="notification-progress" style={{ ["--notification-duration" as string]: `${n.duration ?? 3500}ms` }} /> : null}
        </div>
      ))}
    </div>
  );
}
