import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore } from "../osUiStore";
import { formatClockTime } from "../systemPrefs";

export function LockScreen() {
  const t = useLanguageStore((state) => state.t);
  const unlockSession = useOsUiStore((state) => state.unlockSession);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
        event.preventDefault();
        unlockSession();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlockSession]);

  return (
    <div
      className="os-lock-screen"
      role="dialog"
      aria-label={t("lockSession")}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => unlockSession()}
    >
      <div className="os-lock-content">
        <Icon className="boot-cat" icon="solar:cat-bold-duotone" width={48} height={48} />
        <div className="os-lock-time">
          {formatClockTime(now, hour12)}
        </div>
        <p className="os-lock-date">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <button
          type="button"
          className="os-lock-unlock"
          onClick={(event) => {
            event.stopPropagation();
            unlockSession();
          }}
        >
          {t("unlockSession")}
        </button>
      </div>
    </div>
  );
}
