import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useLanguageStore } from "../languageStore";
import {
  buildMonthCells,
  dateKey,
  daysInMonth,
  WEEKDAY_KEYS,
} from "../shared/calendar/monthGrid";
import {
  readCalendarEvents,
  writeCalendarEvents,
  type LocalCalendarEvent,
} from "../shared/calendar/storage";

type CalendarEvent = LocalCalendarEvent;

export function CalendarApp() {
  const t = useLanguageStore((state) => state.t);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [events, setEvents] = useState<CalendarEvent[]>(readCalendarEvents);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const today = new Date();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const maxDay = daysInMonth(year, month);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const selectedKey = dateKey(year, month, Math.min(selectedDay, maxDay));
  const dayEvents = useMemo(
    () => events.filter((event) => event.date === selectedKey).sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [events, selectedKey],
  );
  const eventDays = useMemo(() => new Set(events.map((event) => event.date)), [events]);

  useEffect(() => {
    writeCalendarEvents(events);
  }, [events]);

  function moveMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      const nextMax = daysInMonth(next.getFullYear(), next.getMonth());
      setSelectedDay((day) => Math.min(day, nextMax));
      return next;
    });
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.getDate());
  }

  function addEvent() {
    const title = draftTitle.trim();
    if (!title) return;
    setEvents((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: selectedKey,
        title,
        time: draftTime || undefined,
      },
      ...current,
    ]);
    setDraftTitle("");
    setDraftTime("");
  }

  return (
    <div className="calendar-app">
      <header>
        <button type="button" className="button-ghost" onClick={() => moveMonth(-1)}>{t("previous")}</button>
        <div>
          <h2>{cursor.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
          <p>{today.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
        <div className="calendar-header-actions">
          <button type="button" className="button-ghost" onClick={goToday}>{t("calendarToday")}</button>
          <button type="button" className="button-ghost" onClick={() => moveMonth(1)}>{t("next")}</button>
        </div>
      </header>
      <div className="calendar-body">
        <div className="calendar-grid">
          {WEEKDAY_KEYS.map((dayKey) => <strong key={dayKey}>{t(dayKey)}</strong>)}
          {cells.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />;
            const key = dateKey(cursor.getFullYear(), cursor.getMonth(), day);
            const isToday = day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
            const isSelected = day === selectedDay;
            const hasEvents = eventDays.has(key);
            return (
              <button
                key={key}
                type="button"
                className={clsx("has-day", isToday && "is-today", isSelected && "is-selected", hasEvents && "has-events")}
                onClick={() => setSelectedDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
        <aside className="calendar-day-panel">
          <h3>{selectedKey}</h3>
          <form
            className="calendar-event-form"
            onSubmit={(event) => {
              event.preventDefault();
              addEvent();
            }}
          >
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={t("calendarEventPlaceholder")}
            />
            <input type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} />
            <button type="submit" className="button-primary">{t("calendarAddEvent")}</button>
          </form>
          <div className="calendar-event-list">
            {dayEvents.length ? dayEvents.map((event) => (
              <div key={event.id} className="calendar-event-item">
                <div>
                  {event.time ? <small>{event.time}</small> : null}
                  <strong>{event.title}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}
                >
                  ×
                </button>
              </div>
            )) : <p className="calendar-empty">{t("calendarNoEvents")}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
