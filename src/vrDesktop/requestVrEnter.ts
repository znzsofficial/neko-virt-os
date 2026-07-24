import type { TranslationKey } from "../languageStore";
import { preloadVrDesktopScene } from "./VrDesktopOverlay";
import { beginVrSessionFromClick, getXrDiagnostics, getXrSystem } from "./vrSession";
import { refreshVrCapability, useVrDesktopStore } from "./vrDesktopStore";

type Notify = (payload: {
  title: string;
  message: string;
  type: "error" | "warning";
  category: "system";
  appId: "settings";
}) => void;

function notify(
  addNotification: Notify,
  t: (key: TranslationKey) => string,
  message: string,
  type: "error" | "warning" = "warning",
) {
  addNotification({
    title: t("settingsVrDesktop"),
    message,
    type,
    category: "system",
    appId: "settings",
  });
}

/**
 * Call only from a button onClick (user activation).
 *
 * - Hard fail: non-secure context or missing navigator.xr
 * - Never gate on isSessionSupported
 * - requestSession is the first browser async on this stack
 */
export function requestVrDesktopEnter(opts: {
  t: (key: TranslationKey) => string;
  addNotification: Notify;
}): Promise<"entered" | "failed"> {
  const { t, addNotification } = opts;
  const store = useVrDesktopStore.getState();
  const diag = getXrDiagnostics();

  if (!diag.secure) {
    store.setLastError(diag.summary);
    void refreshVrCapability();
    notify(addNotification, t, t("settingsVrDesktopNeedHttps"));
    return Promise.resolve("failed");
  }

  if (!getXrSystem()) {
    store.setLastError(diag.summary);
    void refreshVrCapability();
    notify(addNotification, t, t("settingsVrDesktopNoXr"));
    return Promise.resolve("failed");
  }

  store.setPhase("entering");
  store.setLastError(null);
  void preloadVrDesktopScene();

  return beginVrSessionFromClick()
    .then(() => {
      store.markEntered();
      return "entered" as const;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : "Error";
      const detail = `${name}: ${message || "requestSession failed"} · ${getXrDiagnostics().summary}`;
      console.error("[vrDesktop] requestSession failed", err);
      store.failEnter(detail);
      notify(
        addNotification,
        t,
        detail.length > 160 ? `${detail.slice(0, 157)}…` : detail,
        "error",
      );
      void refreshVrCapability();
      return "failed" as const;
    });
}
