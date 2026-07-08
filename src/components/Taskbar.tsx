import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { appTitleKeys, getAppIcon } from "../appText";
import { useLanguageStore } from "../languageStore";
import { useDesktopStore } from "../windowStore";

export function Taskbar() {
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const toggleLauncher = useDesktopStore((state) => state.toggleLauncher);
  const toggleTaskbarWindow = useDesktopStore((state) => state.toggleTaskbarWindow);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const t = useLanguageStore((state) => state.t);
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="taskbar" onMouseDown={(event) => event.stopPropagation()}>
      <button className="start-button" onClick={toggleLauncher} aria-label={t("openLauncher")}>
        <Icon icon="solar:cat-bold-duotone" width={22} height={22} />
      </button>
      <div className="taskbar-apps">
        {windows.map((window) => (
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
        <span className="tray-pill"><Icon icon="solar:database-bold-duotone" width={15} height={15} /> local</span>
        <span>{timeStr}</span>
      </div>
    </footer>
  );
}
