import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { appDescriptionKeys, appTitleKeys, getAppIcon } from "../appText";
import { apps } from "../apps";
import { useFsStore } from "../fs";
import { useLanguageStore } from "../languageStore";
import { requestCloseWindow } from "../shell/windowLifecycle";
import { type BrowserPerformance, type DeviceSnapshot, formatBytes, getDeviceRows, readHighEntropyDeviceInfo, type StorageSnapshot } from "../systemInfo";
import { useDesktopStore } from "../windowStore";

export function TaskManagerApp() {
  const t = useLanguageStore((state) => state.t);
  const windows = useDesktopStore((state) => state.windows);
  const activeWindowId = useDesktopStore((state) => state.activeWindowId);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const files = useFsStore((state) => state.files);
  const [activeTab, setActiveTab] = useState<"processes" | "performance" | "history">("processes");
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
    const interval = setInterval(() => {
      setTick(Date.now());
      navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const memory = (performance as BrowserPerformance).memory;
  const uptime = Math.max(1, Math.floor((tick - performance.timeOrigin) / 1000));
  const appMemory = memory ? formatBytes(memory.usedJSHeapSize) : "Unavailable";
  const appLimit = memory ? formatBytes(memory.jsHeapSizeLimit) : "Unavailable";
  const deviceRows = getDeviceRows(storage, deviceInfo, t);
  const processRows = windows
    .slice()
    .sort((a, b) => b.z - a.z)
    .map((window) => {
      const app = apps.find((item) => item.id === window.appId);
      return {
        ...window,
        icon: getAppIcon(window.appId, window.icon),
        description: app ? t(appDescriptionKeys[app.id]) : t("taskManagerFallbackProcess"),
        status: window.minimized ? t("taskManagerSuspended") : activeWindowId === window.id ? t("taskManagerActive") : t("taskManagerBackground"),
        footprint: `${Math.max(12, Math.round((window.width * window.height) / 26000))} ${t("taskManagerUiUnits")}`,
      };
    });
  const appHistoryRows = apps.map((app) => ({
    ...app,
    windows: windows.filter((window) => window.appId === app.id).length,
    status: windows.some((window) => window.appId === app.id && !window.minimized) ? t("taskManagerRunning") : windows.some((window) => window.appId === app.id) ? t("taskManagerSuspended") : t("taskManagerClosed"),
  }));

  return (
    <div className="task-manager-app">
      <aside className="task-manager-sidebar">
        <button className={clsx("task-manager-tab", activeTab === "processes" && "is-active")} onClick={() => setActiveTab("processes")}><Icon icon="solar:widget-5-bold-duotone" width={17} height={17} /> {t("taskManagerProcesses")}</button>
        <button className={clsx("task-manager-tab", activeTab === "performance" && "is-active")} onClick={() => setActiveTab("performance")}><Icon icon="solar:graph-up-bold-duotone" width={17} height={17} /> {t("taskManagerPerformance")}</button>
        <button className={clsx("task-manager-tab", activeTab === "history" && "is-active")} onClick={() => setActiveTab("history")}><Icon icon="solar:database-bold-duotone" width={17} height={17} /> {t("taskManagerHistory")}</button>
      </aside>
      <main className="task-manager-main">
        <header className="task-manager-header">
          <div>
            <h2>{t("appTaskManager")}</h2>
            <p>{`${t("taskManagerSummaryPrefix")}${windows.length}${t("taskManagerSummaryMiddle")}${files.length}${t("taskManagerSummarySuffix")}${Math.floor(uptime / 60)}m ${uptime % 60}s`}</p>
          </div>
          <div className="task-manager-metrics">
            <span><strong>{navigator.hardwareConcurrency || "-"}</strong> {t("taskManagerThreads")}</span>
            <span><strong>{appMemory}</strong> {t("taskManagerJsHeap")}</span>
            <span><strong>{formatBytes(storage?.usage)}</strong> {t("taskManagerOriginStorage")}</span>
          </div>
        </header>

        {activeTab !== "history" ? <section className="performance-grid" aria-label={t("performanceSummary")}>
          <article>
            <span>CPU</span>
            <strong>{navigator.hardwareConcurrency || t("unavailable")} {t("taskManagerThreads")}</strong>
            <p>{t("taskManagerLogicalProcessors")}</p>
          </article>
          <article>
            <span>{t("taskManagerJsHeap")}</span>
            <strong>{appMemory}</strong>
            <p>{appLimit} {t("taskManagerLimit")}</p>
          </article>
          <article>
            <span>{t("taskManagerOriginStorage")}</span>
            <strong>{formatBytes(storage?.usage)}</strong>
            <p>{formatBytes(storage?.quota)} {t("taskManagerQuota")}</p>
          </article>
          <article>
            <span>{t("taskManagerDisplay")}</span>
            <strong>{window.screen.width} x {window.screen.height}</strong>
            <p>{window.devicePixelRatio.toFixed(2)}x {t("taskManagerPixelRatio")}</p>
          </article>
        </section> : null}

        {activeTab === "processes" ? <section className="process-table" aria-label={t("runningProcesses")}>
          <div className="process-row process-head">
            <span>{t("taskManagerName")}</span>
            <span>{t("taskManagerStatus")}</span>
            <span>{t("taskManagerFootprint")}</span>
            <span>{t("taskManagerActions")}</span>
          </div>
          {processRows.map((process) => (
            <div key={process.id} className={clsx("process-row", activeWindowId === process.id && !process.minimized && "is-active")}>
              <span className="process-name"><Icon icon={process.icon} width={18} height={18} /><span><strong>{process.title}</strong><small>{process.description}</small></span></span>
              <span>{process.status}</span>
              <span>{process.footprint}</span>
              <span className="process-actions">
                <button onClick={() => process.minimized ? restoreWindow(process.id) : focusWindow(process.id)}>{process.minimized ? t("taskManagerRestore") : t("taskManagerSwitch")}</button>
                <button disabled={process.minimized} onClick={() => minimizeWindow(process.id)}>{process.minimized ? t("minimized") : t("minimize")}</button>
                <button className="danger" onClick={() => requestCloseWindow(process, closeWindow)}>{t("taskManagerEndTask")}</button>
              </span>
            </div>
          ))}
        </section> : null}

        {activeTab === "performance" ? <section className="device-table" aria-label={t("deviceDetails")}>
          {deviceRows.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong title={value}>{value}</strong></div>
          ))}
        </section> : null}

        {activeTab === "history" ? <section className="process-table" aria-label={t("applicationHistory")}>
          <div className="process-row process-head app-history-row">
            <span>{t("taskManagerApplication")}</span>
            <span>{t("taskManagerStatus")}</span>
            <span>{t("taskManagerWindows")}</span>
            <span>{t("taskManagerDefaultSize")}</span>
          </div>
          {appHistoryRows.map((app) => (
            <div key={app.id} className="process-row app-history-row">
              <span className="process-name"><Icon icon={app.icon} width={18} height={18} /><span><strong>{t(appTitleKeys[app.id])}</strong><small>{t(appDescriptionKeys[app.id])}</small></span></span>
              <span>{app.status}</span>
              <span>{app.windows}</span>
              <span>{app.defaultSize.width} x {app.defaultSize.height}</span>
            </div>
          ))}
        </section> : null}
      </main>
    </div>
  );
}
