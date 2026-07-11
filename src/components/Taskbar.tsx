import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { appTitleKeys, getAppIcon } from "../appText";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { useOsUiStore, type WorkspaceId } from "../osUiStore";
import { useDesktopStore } from "../windowStore";

const weekdayKeys = ["weekdaySun", "weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu", "weekdayFri", "weekdaySat"] as const;
const WORKSPACES: WorkspaceId[] = [0, 1, 2];

export function Taskbar() {
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const toggleLauncher = useDesktopStore((state) => state.toggleLauncher);
  const toggleTaskbarWindow = useDesktopStore((state) => state.toggleTaskbarWindow);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const activeWorkspace = useOsUiStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useOsUiStore((state) => state.setActiveWorkspace);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const toggleNotificationCenter = useOsUiStore((state) => state.toggleNotificationCenter);
  const historyCount = useNotificationStore((state) => state.history.length);
  const liveCount = useNotificationStore((state) => state.notifications.length);
  const t = useLanguageStore((state) => state.t);
  const [timeStr, setTimeStr] = useState("");
  const [clockOpen, setClockOpen] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = useMemo(() => Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  }), [daysInMonth, startOffset]);
  const workspaceWindows = useMemo(
    () => windows.filter((window) => (window.workspaceId ?? 0) === activeWorkspace),
    [windows, activeWorkspace],
  );

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
      setCursor((current) => current.getMonth() === now.getMonth() && current.getFullYear() === now.getFullYear() ? current : new Date(now.getFullYear(), now.getMonth(), 1));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!clockRef.current?.contains(event.target as Node)) setClockOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function switchWorkspace(workspace: WorkspaceId) {
    setActiveWorkspace(workspace);
    const top = windows
      .filter((window) => (window.workspaceId ?? 0) === workspace)
      .slice()
      .sort((a, b) => b.z - a.z)[0];
    if (top) {
      restoreWindow(top.id);
      focusWindow(top.id);
      return;
    }
    useDesktopStore.setState({ activeWindowId: null });
  }

  return (
    <footer className="taskbar" onMouseDown={(event) => event.stopPropagation()}>
      <button className="start-button" onClick={toggleLauncher} aria-label={t("openLauncher")}>
        <Icon icon="solar:cat-bold-duotone" width={22} height={22} />
      </button>

      <div className="workspace-switcher" aria-label={t("workspaces")}>
        {WORKSPACES.map((workspace) => (
          <button
            key={workspace}
            type="button"
            className={clsx("workspace-dot", activeWorkspace === workspace && "is-active")}
            onClick={() => switchWorkspace(workspace)}
            title={`${t("workspace")} ${workspace + 1}`}
            aria-pressed={activeWorkspace === workspace}
          >
            {workspace + 1}
          </button>
        ))}
      </div>

      <div className="taskbar-apps">
        {workspaceWindows.map((window) => (
          <button
            key={window.id}
            className={clsx("taskbar-item", activeWindowId === window.id && !window.minimized && "is-active", window.minimized && "is-minimized")}
            data-context-kind="taskbar-window"
            data-context-id={window.id}
            data-app-id={window.appId}
            onClick={() => toggleTaskbarWindow(window.id)}
          >
            <Icon icon={getAppIcon(window.appId, window.icon)} width={18} height={18} />
            <span>{t(appTitleKeys[window.appId])}</span>
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
        <span className="tray-pill"><Icon icon="solar:database-bold-duotone" width={15} height={15} /> {t("localLabel")}</span>
        <div className="tray-clock" ref={clockRef}>
          <button type="button" className="tray-clock-button" onClick={() => setClockOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={clockOpen}>
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
              <div className="tray-clock-bigtime">{today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
              <div className="calendar-grid tray-clock-grid">
                {weekdayKeys.map((dayKey) => <strong key={dayKey}>{t(dayKey)}</strong>)}
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
