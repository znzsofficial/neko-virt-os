import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { appTitleKeys, getAppIcon } from "../appText";
import { ControlCenter } from "./ControlCenter";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { useOsUiStore } from "../osUiStore";
import { buildMonthCells, WEEKDAY_KEYS } from "../shared/calendar/monthGrid";
import { formatClockTime } from "../system/systemPrefs";
import { useDesktopStore } from "../windowStore";

export function Taskbar() {
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const toggleLauncher = useDesktopStore((state) => state.toggleLauncher);
  const toggleTaskbarWindow = useDesktopStore((state) => state.toggleTaskbarWindow);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const activeWorkspace = useOsUiStore((state) => state.activeWorkspace);
  const toggleNotificationCenter = useOsUiStore((state) => state.toggleNotificationCenter);
  const controlCenterOpen = useOsUiStore((state) => state.controlCenterOpen);
  const toggleControlCenter = useOsUiStore((state) => state.toggleControlCenter);
  const setControlCenterOpen = useOsUiStore((state) => state.setControlCenterOpen);
  const dndEnabled = useOsUiStore((state) => state.notificationPrefs.dndEnabled);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const taskbarShowLabels = useOsUiStore((state) => state.systemPrefs.taskbarShowLabels);
  const taskbarAutoHide = useOsUiStore((state) => state.systemPrefs.taskbarAutoHide);
  const historyCount = useNotificationStore((state) => state.history.length);
  const liveCount = useNotificationStore((state) => state.notifications.length);
  const t = useLanguageStore((state) => state.t);
  const [timeStr, setTimeStr] = useState("");
  const [clockOpen, setClockOpen] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();
  const cells = useMemo(
    () => buildMonthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const workspaceWindows = useMemo(
    () => windows.filter((window) => (window.workspaceId ?? 0) === activeWorkspace),
    [windows, activeWorkspace],
  );

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(formatClockTime(now, hour12));
      setCursor((current) => current.getMonth() === now.getMonth() && current.getFullYear() === now.getFullYear() ? current : new Date(now.getFullYear(), now.getMonth(), 1));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [hour12]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!clockRef.current?.contains(target)) setClockOpen(false);
      if (!controlRef.current?.contains(target)) setControlCenterOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [setControlCenterOpen]);

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <footer
      className={clsx("taskbar", taskbarAutoHide && "is-autohide", !taskbarShowLabels && "is-icons-only")}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button className="start-button" onClick={toggleLauncher} aria-label={t("openLauncher")}>
        <Icon icon="solar:cat-bold-duotone" width={22} height={22} />
      </button>

      <div className="taskbar-apps">
        {workspaceWindows.map((window) => (
          <button
            key={window.id}
            className={clsx(
              "taskbar-item",
              "is-running",
              activeWindowId === window.id && !window.minimized && "is-active",
              window.minimized && "is-minimized",
              !taskbarShowLabels && "is-icon-only",
            )}
            data-context-kind="taskbar-window"
            data-context-id={window.id}
            data-app-id={window.appId}
            title={t(appTitleKeys[window.appId])}
            onClick={() => toggleTaskbarWindow(window.id)}
          >
            <Icon icon={getAppIcon(window.appId, window.icon)} width={18} height={18} />
            {taskbarShowLabels ? <span>{t(appTitleKeys[window.appId])}</span> : null}
          </button>
        ))}
      </div>
      <div className="system-tray">
        <button className="tray-button" onClick={resetWindowLayout} title={t("resetWindowLayoutLabel")} aria-label={t("resetWindowLayoutLabel")}>
          <Icon icon="solar:restart-bold-duotone" width={15} height={15} />
        </button>
        <button
          type="button"
          className="tray-button tray-notify"
          onClick={toggleNotificationCenter}
          title={t("notificationCenter")}
          aria-label={t("notificationCenter")}
        >
          <Icon icon="solar:bell-bold-duotone" width={15} height={15} />
          {liveCount || historyCount ? <em>{liveCount || historyCount}</em> : null}
        </button>
        <div className="tray-control" ref={controlRef}>
          <button
            type="button"
            className={clsx("tray-button", controlCenterOpen && "is-active")}
            onClick={() => {
              setClockOpen(false);
              toggleControlCenter();
            }}
            title={t("controlCenter")}
            aria-label={t("controlCenter")}
            aria-haspopup="dialog"
            aria-expanded={controlCenterOpen}
          >
            <Icon icon="solar:widget-4-bold-duotone" width={15} height={15} />
          </button>
          <ControlCenter />
        </div>
        <span className={clsx("tray-pill", dndEnabled && "is-dnd")}>
          <Icon icon={dndEnabled ? "solar:moon-sleep-bold-duotone" : "solar:database-bold-duotone"} width={15} height={15} />
          {dndEnabled ? t("notificationDndToggle") : t("localLabel")}
        </span>
        <div className="tray-clock" ref={clockRef}>
          <button
            type="button"
            className="tray-clock-button"
            onClick={() => {
              setControlCenterOpen(false);
              setClockOpen((open) => !open);
            }}
            aria-haspopup="dialog"
            aria-expanded={clockOpen}
          >
            <span>{timeStr}</span>
          </button>
          {clockOpen ? (
            <div className="tray-clock-panel" role="dialog" aria-label={t("appCalendar")}>
              <div className="tray-clock-header">
                <button type="button" className="button-ghost" onClick={() => moveMonth(-1)}>{t("previous")}</button>
                <div>
                  <strong>{cursor.toLocaleDateString([], { month: "long", year: "numeric" })}</strong>
                  <p>{today.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>
                </div>
                <button type="button" className="button-ghost" onClick={() => moveMonth(1)}>{t("next")}</button>
              </div>
              <div className="tray-clock-bigtime">{formatClockTime(today, hour12)}</div>
              <div className="calendar-grid tray-clock-grid">
                {WEEKDAY_KEYS.map((dayKey) => <strong key={dayKey}>{t(dayKey)}</strong>)}
                {cells.map((day, index) => {
                  const isToday = day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
                  return <span key={`${day}-${index}`} className={clsx(day && "has-day", isToday && "is-today")}>{day}</span>;
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
