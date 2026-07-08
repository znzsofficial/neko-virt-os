import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { getAppIcon } from "../appText";
import { useLanguageStore } from "../languageStore";
import type { WindowState } from "../types";

export function WindowSwitcher({ windows, selectedIndex }: { windows: WindowState[]; selectedIndex: number }) {
  const t = useLanguageStore((state) => state.t);
  return (
    <section className="window-switcher" aria-label={t("switchWindows")}>
      <div className="window-switcher-panel">
        <h2>{t("switchWindows")}</h2>
        <div className="window-switcher-grid">
          {windows.map((window, index) => (
            <div key={window.id} className={clsx("window-switcher-item", index === selectedIndex && "is-selected", window.minimized && "is-minimized")} data-app-id={window.appId}>
              <Icon icon={getAppIcon(window.appId, window.icon)} width={28} height={28} />
              <strong>{window.title}</strong>
              <span>{window.minimized ? t("minimized") : t("running")}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
