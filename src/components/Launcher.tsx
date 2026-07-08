import { Icon } from "@iconify-icon/react";
import { apps } from "../apps";
import { appDescriptionKeys, appTitleKeys } from "../appText";
import { useLanguageStore } from "../languageStore";
import { useDesktopStore } from "../windowStore";

export function Launcher() {
  const openApp = useDesktopStore((state) => state.openApp);
  const t = useLanguageStore((state) => state.t);

  return (
    <section className="launcher" onMouseDown={(event) => event.stopPropagation()}>
      <div className="launcher-header">
        <div>
          <h1>{t("launcherTitle")}</h1>
          <p>{t("launcherSubtitle")}</p>
        </div>
        <Icon icon="solar:cat-bold-duotone" width={28} height={28} />
      </div>
      <div className="launcher-grid">
        {apps.map((app) => (
          <button key={app.id} className="launcher-app" data-app-id={app.id} onClick={() => openApp(app.id)}>
            <Icon icon={app.icon} width={28} height={28} />
            <strong>{t(appTitleKeys[app.id])}</strong>
            <span>{t(appDescriptionKeys[app.id])}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
