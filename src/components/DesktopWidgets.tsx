import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { getPendingTasks, getUpcomingEvents } from "../localData";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import { formatBytes } from "../systemInfo";
import { useDesktopStore } from "../windowStore";
import { useFsStore } from "../fs";

export function DesktopWidgets() {
  const t = useLanguageStore((state) => state.t);
  const collapsed = useOsUiStore((state) => state.widgetsCollapsed);
  const setWidgetsCollapsed = useOsUiStore((state) => state.setWidgetsCollapsed);
  const openApp = useDesktopStore((state) => state.openApp);
  const windows = useDesktopStore((state) => state.windows);
  const files = useFsStore((state) => state.files);
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState(() => getPendingTasks(4));
  const [events, setEvents] = useState(() => getUpcomingEvents(3));
  const [heap, setHeap] = useState("—");

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(new Date());
      setTasks(getPendingTasks(4));
      setEvents(getUpcomingEvents(3));
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setHeap(memory ? formatBytes(memory.usedJSHeapSize) : "—");
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

  return (
    <aside className="desktop-widgets" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <strong>{t("widgetsTitle")}</strong>
        <button type="button" className="button-ghost" onClick={() => setWidgetsCollapsed(true)}>{t("widgetsHide")}</button>
      </header>

      <section className="desktop-widget" onDoubleClick={() => openApp("timer")}>
        <span>{t("localTime")}</span>
        <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
        <small>{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</small>
      </section>

      <section className="desktop-widget" onDoubleClick={() => openApp("tasks")}>
        <span>{t("widgetsTasks")}</span>
        {tasks.length ? tasks.map((task) => (
          <p key={task.id}>{task.text}</p>
        )) : <p className="is-muted">{t("noTasks")}</p>}
      </section>

      <section className="desktop-widget" onDoubleClick={() => openApp("calendar")}>
        <span>{t("widgetsEvents")}</span>
        {events.length ? events.map((event) => (
          <p key={event.id}>
            <small>{event.date}{event.time ? ` ${event.time}` : ""}</small>
            {event.title}
          </p>
        )) : <p className="is-muted">{t("calendarNoEvents")}</p>}
      </section>

      <section className="desktop-widget" onDoubleClick={() => openApp("task-manager")}>
        <span>{t("widgetsSystem")}</span>
        <p>{t("widgetsWindows")}: {windows.length}</p>
        <p>{t("widgetsFiles")}: {files.filter((file) => !file.trashed).length}</p>
        <p>{t("widgetsHeap")}: {heap}</p>
      </section>
    </aside>
  );
}
