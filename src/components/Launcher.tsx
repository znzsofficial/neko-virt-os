import { Icon } from "@iconify-icon/react";
import { useMemo, useState } from "react";
import { apps, type AppId } from "../apps";
import { appDescriptionKeys, appTitleKeys } from "../appText";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useLauncherStore } from "../launcherStore";
import { useDesktopStore } from "../windowStore";

export function Launcher() {
  const openApp = useDesktopStore((state) => state.openApp);
  const closeLauncher = useDesktopStore((state) => state.closeLauncher);
  const pinnedAppIds = useLauncherStore((state) => state.pinnedAppIds);
  const recentAppIds = useLauncherStore((state) => state.recentAppIds);
  const togglePinnedApp = useLauncherStore((state) => state.togglePinnedApp);
  const t = useLanguageStore((state) => state.t);
  const [query, setQuery] = useState("");
  const appMap = useMemo(() => new Map(apps.map((app) => [app.id, app])), []);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredApps = apps.filter((app) => {
    if (!normalizedQuery) return true;
    return t(appTitleKeys[app.id]).toLowerCase().includes(normalizedQuery) || t(appDescriptionKeys[app.id]).toLowerCase().includes(normalizedQuery);
  });
  const pinnedApps = pinnedAppIds.map((id) => appMap.get(id)).filter((app): app is NonNullable<typeof app> => Boolean(app)).filter((app) => filteredApps.includes(app));
  const recentApps = recentAppIds.map((id) => appMap.get(id)).filter((app): app is NonNullable<typeof app> => Boolean(app)).filter((app) => filteredApps.includes(app) && !pinnedApps.includes(app));
  const allApps = filteredApps.filter((app) => !pinnedApps.includes(app) && !recentApps.includes(app));

  function launch(appId: AppId) {
    openApp(appId);
    closeLauncher();
  }

  return (
    <section className="launcher" onMouseDown={(event) => event.stopPropagation()}>
      <div className="launcher-header">
        <div>
          <h1>{t("launcherTitle")}</h1>
          <p>{t("launcherSubtitle")}</p>
        </div>
        <Icon icon="solar:cat-bold-duotone" width={28} height={28} />
      </div>
      <label className="launcher-search">
        <Icon icon="solar:magnifer-bold-duotone" width={16} height={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("launcherSearchPlaceholder")} />
      </label>
      <div className="launcher-body">
        {pinnedApps.length ? <LauncherSection title={t("pinnedApplication")} sectionApps={pinnedApps} onLaunch={launch} onTogglePinned={togglePinnedApp} t={t} /> : null}
        {recentApps.length ? <LauncherSection title={t("recent")} sectionApps={recentApps} onLaunch={launch} onTogglePinned={togglePinnedApp} t={t} /> : null}
        <LauncherSection title={t("launcherAllApps")} sectionApps={allApps} onLaunch={launch} onTogglePinned={togglePinnedApp} t={t} />
      </div>
    </section>
  );
}

function LauncherSection({
  title,
  sectionApps,
  onLaunch,
  onTogglePinned,
  t,
}: {
  title: string;
  sectionApps: readonly (typeof apps)[number][];
  onLaunch: (appId: AppId) => void;
  onTogglePinned: (appId: AppId) => void;
  t: (key: TranslationKey) => string;
}) {
  if (!sectionApps.length) return null;
  return (
    <section className="launcher-section">
      <div className="launcher-section-header">
        <h2>{title}</h2>
      </div>
      <div className="launcher-grid">
        {sectionApps.map((app) => (
          <div key={app.id} className="launcher-app" data-app-id={app.id}>
            <button type="button" className="launcher-app-main" onClick={() => onLaunch(app.id)}>
              <Icon icon={app.icon} width={28} height={28} />
              <strong>{t(appTitleKeys[app.id])}</strong>
              <span>{t(appDescriptionKeys[app.id])}</span>
            </button>
            <button
              type="button"
              className="launcher-pin"
              aria-label={t("pinnedApplication")}
              onClick={() => onTogglePinned(app.id)}
            >
              <Icon icon="solar:pin-bold-duotone" width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
