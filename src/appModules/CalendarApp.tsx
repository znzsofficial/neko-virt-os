import { clsx } from "clsx";
import { useState } from "react";
import { useLanguageStore } from "../languageStore";

export function CalendarApp() {
  const t = useLanguageStore((state) => state.t);
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  function moveMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="calendar-app">
      <header>
        <button className="button-ghost" onClick={() => moveMonth(-1)}>{t("previous")}</button>
        <div>
          <h2>{cursor.toLocaleDateString("en", { month: "long", year: "numeric" })}</h2>
          <p>{today.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
        <button className="button-ghost" onClick={() => moveMonth(1)}>{t("next")}</button>
      </header>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
        {cells.map((day, index) => {
          const isToday = day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
          return <span key={`${day}-${index}`} className={clsx(day && "has-day", isToday && "is-today")}>{day}</span>;
        })}
      </div>
    </div>
  );
}
