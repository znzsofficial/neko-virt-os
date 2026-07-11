import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";

export function TimerApp() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="timer-app">
      <section>
        <span>{t("localTime")}</span>
        <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
      </section>
      <section>
        <span>{t("stopwatch")}</span>
        <strong>{minutes}:{seconds}</strong>
        <div className="timer-actions">
          <button className="button-primary" onClick={() => setRunning((current) => !current)}>{running ? t("pause") : t("start")}</button>
          <button className="button-ghost" onClick={() => { setRunning(false); setElapsed(0); }}>{t("reset")}</button>
        </div>
      </section>
    </div>
  );
}
