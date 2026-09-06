import { Icon } from "@iconify-icon/react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { getPendingTasks, getUpcomingEvents, type LocalCalendarEvent, type LocalTaskItem } from "../system/localData";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import { formatBytes } from "../system/systemInfo";
import { formatClockTime } from "../system/systemPrefs";
import { useDesktopStore } from "../windowStore";
import { useFsStore } from "../fs";
import type { AppId } from "../types";

const SIGNATURE_TEXT_LIMIT = 64;

function taskSignature(tasks: LocalTaskItem[]) {
  return tasks.map((task) => `${task.id}:${task.priority}:${task.due ?? ""}:${task.done ? 1 : 0}:${task.text.slice(0, SIGNATURE_TEXT_LIMIT)}`).join(",");
}

function eventSignature(events: LocalCalendarEvent[]) {
  return events.map((event) => `${event.id}:${event.date}:${event.time ?? ""}:${event.title.slice(0, SIGNATURE_TEXT_LIMIT)}`).join(",");
}

export function DesktopWidgets() {
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const collapsed = useOsUiStore((state) => state.widgetsCollapsed);
  const setWidgetsCollapsed = useOsUiStore((state) => state.setWidgetsCollapsed);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const openApp = useDesktopStore((state) => state.openApp);
  const windowCount = useDesktopStore((state) => state.windows.length);
  const fileCount = useFsStore((state) => state.files.filter((file) => !file.trashed).length);
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState(() => getPendingTasks(4));
  const [events, setEvents] = useState(() => getUpcomingEvents(3));
  const [heap, setHeap] = useState("—");

  useEffect(() => {
    const tick = window.setInterval(() => {
      const nextNow = new Date();
      setNow((current) => (
        current.getHours() === nextNow.getHours() && current.getMinutes() === nextNow.getMinutes() ? current : nextNow
      ));
      const nextTasks = getPendingTasks(4);
      setTasks((current) => (taskSignature(current) === taskSignature(nextTasks) ? current : nextTasks));
      const nextEvents = getUpcomingEvents(3);
      setEvents((current) => (eventSignature(current) === eventSignature(nextEvents) ? current : nextEvents));
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const nextHeap = memory ? formatBytes(memory.usedJSHeapSize) : "—";
      setHeap((current) => (current === nextHeap ? current : nextHeap));
    }, 2000);
    return () => window.clearInterval(tick);
  }, []);

  if (collapsed) {
    return (
      <button type="button" className="desktop-widgets-toggle" onClick={() => setWidgetsCollapsed(false)}>
        <Icon icon="solar:widget-2-bold-duotone" width={16} height={16} />
        {t("widgetsShow")}
      </button>
    );
  }

  function activateOnKey(appId: AppId) {
    return (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openApp(appId);
    };
  }

  return (
    <aside className="desktop-widgets" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <strong>{t("widgetsTitle")}</strong>
        <button type="button" className="button-ghost" onClick={() => setWidgetsCollapsed(true)}>{t("widgetsHide")}</button>
      </header>

      <section
        className="desktop-widget tint-sky"
        role="button"
        tabIndex={0}
        onClick={() => openApp("timer")}
        onKeyDown={activateOnKey("timer")}
      >
        <span>{t("localTime")}</span>
        <strong>{formatClockTime(now, hour12)}</strong>
        <small>{now.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", { weekday: "short", month: "short", day: "numeric" })}</small>
      </section>

      <section
        className="desktop-widget tint-mint"
        role="button"
        tabIndex={0}
        onClick={() => openApp("tasks")}
        onKeyDown={activateOnKey("tasks")}
      >
        <span>{t("widgetsTasks")}</span>
        {tasks.length ? tasks.map((task) => (
          <p key={task.id}>{task.text}</p>
        )) : <p className="is-muted">{t("noTasks")}</p>}
      </section>

      <section
        className="desktop-widget tint-violet"
        role="button"
        tabIndex={0}
        onClick={() => openApp("calendar")}
        onKeyDown={activateOnKey("calendar")}
      >
        <span>{t("widgetsEvents")}</span>
        {events.length ? events.map((event) => (
          <p key={event.id}>
            <small>{event.date}{event.time ? ` ${event.time}` : ""}</small>
            {event.title}
          </p>
        )) : <p className="is-muted">{t("calendarNoEvents")}</p>}
      </section>

      <section
        className="desktop-widget tint-amber"
        role="button"
        tabIndex={0}
        onClick={() => openApp("task-manager")}
        onKeyDown={activateOnKey("task-manager")}
      >
        <span>{t("widgetsSystem")}</span>
        <p>{t("widgetsWindows")}: {windowCount}</p>
        <p>{t("widgetsFiles")}: {fileCount}</p>
        <p>{t("widgetsHeap")}: {heap}</p>
      </section>
    </aside>
  );
}
