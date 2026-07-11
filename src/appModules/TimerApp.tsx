import { useEffect, useRef, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";

type TimerMode = "clock" | "stopwatch" | "countdown";

const PRESETS = [5, 15, 25, 45];

function formatSeconds(total: number) {
  const safe = Math.max(0, total);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TimerApp() {
  const t = useLanguageStore((state) => state.t);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [mode, setMode] = useState<TimerMode>("countdown");
  const [now, setNow] = useState(() => new Date());
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownTotal, setCountdownTotal] = useState(25 * 60);
  const [countdownLeft, setCountdownLeft] = useState(25 * 60);
  const [customMinutes, setCustomMinutes] = useState("25");
  const notifiedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const interval = setInterval(() => setStopwatchElapsed((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!countdownRunning) return;
    const interval = setInterval(() => {
      setCountdownLeft((current) => {
        if (current <= 1) {
          setCountdownRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownRunning]);

  useEffect(() => {
    if (countdownLeft !== 0 || notifiedRef.current) return;
    notifiedRef.current = true;
    addNotification({ title: t("timerCompleteTitle"), message: t("timerCompleteMessage"), type: "success", category: "apps", appId: "timer", sticky: true, duration: 5000 });
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(t("timerCompleteTitle"), { body: t("timerCompleteMessage") });
      }
    } catch {
      // ignore notification failures
    }
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      window.setTimeout(() => {
        oscillator.stop();
        void context.close();
      }, 180);
    } catch {
      // ignore audio failures
    }
  }, [countdownLeft, addNotification, t]);

  function applyPreset(minutes: number) {
    const total = minutes * 60;
    setCustomMinutes(String(minutes));
    setCountdownTotal(total);
    setCountdownLeft(total);
    setCountdownRunning(false);
    notifiedRef.current = false;
  }

  function applyCustom() {
    const minutes = Math.max(1, Math.min(180, Number(customMinutes) || 1));
    applyPreset(minutes);
  }

  async function requestNotifyPermission() {
    if (!("Notification" in window)) return;
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }

  return (
    <div className="timer-app">
      <div className="timer-mode-tabs">
        {([
          ["countdown", t("countdown")],
          ["stopwatch", t("stopwatch")],
          ["clock", t("localTime")],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? "is-active" : undefined}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "clock" ? (
        <section>
          <span>{t("localTime")}</span>
          <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
          <p>{now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </section>
      ) : null}

      {mode === "stopwatch" ? (
        <section>
          <span>{t("stopwatch")}</span>
          <strong>{formatSeconds(stopwatchElapsed)}</strong>
          <div className="timer-actions">
            <button type="button" className="button-primary" onClick={() => setStopwatchRunning((current) => !current)}>
              {stopwatchRunning ? t("pause") : t("start")}
            </button>
            <button
              type="button"
              className="button-ghost"
              disabled={!stopwatchRunning && stopwatchElapsed === 0}
              onClick={() => setLaps((current) => [stopwatchElapsed, ...current].slice(0, 20))}
            >
              {t("timerLap")}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setStopwatchRunning(false);
                setStopwatchElapsed(0);
                setLaps([]);
              }}
            >
              {t("reset")}
            </button>
          </div>
          {laps.length ? (
            <div className="timer-laps">
              {laps.map((lap, index) => (
                <div key={`${lap}-${index}`}>
                  <span>#{laps.length - index}</span>
                  <strong>{formatSeconds(lap)}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === "countdown" ? (
        <section>
          <span>{t("countdown")}</span>
          <strong className={countdownLeft === 0 ? "is-done" : undefined}>{formatSeconds(countdownLeft)}</strong>
          <div className="timer-presets">
            {PRESETS.map((minutes) => (
              <button key={minutes} type="button" className="button-ghost" onClick={() => applyPreset(minutes)}>
                {minutes}{t("timerMinutesSuffix")}
              </button>
            ))}
          </div>
          <div className="timer-custom">
            <input
              type="number"
              min={1}
              max={180}
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
            />
            <button type="button" className="button-ghost" onClick={applyCustom}>{t("timerApply")}</button>
            <button type="button" className="button-ghost" onClick={() => void requestNotifyPermission()}>{t("timerEnableNotify")}</button>
          </div>
          <div className="timer-actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                if (countdownLeft <= 0) {
                  setCountdownLeft(countdownTotal);
                  notifiedRef.current = false;
                }
                setCountdownRunning((current) => !current);
              }}
            >
              {countdownRunning ? t("pause") : t("start")}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setCountdownRunning(false);
                setCountdownLeft(countdownTotal);
                notifiedRef.current = false;
              }}
            >
              {t("reset")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
