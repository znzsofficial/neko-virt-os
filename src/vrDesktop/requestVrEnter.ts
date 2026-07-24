import type { TranslationKey } from "../languageStore";
import { useMmdVrStore } from "../mmdVrShowcase/mmdVrStore";
import { requestImmersiveEnter } from "../xr";
import { preloadVrDesktopScene } from "./preloadVrDesktopScene";
import { beginVrSessionFromClick } from "./vrSession";
import { refreshVrCapability, useVrDesktopStore } from "./vrDesktopStore";

type Notify = (payload: {
  title: string;
  message: string;
  type: "error" | "warning";
  category: "system";
  appId: "settings";
}) => void;

/**
 * Call only from a button onClick (user activation).
 */
export function requestVrDesktopEnter(opts: {
  t: (key: TranslationKey) => string;
  addNotification: Notify;
}): Promise<"entered" | "failed"> {
  const { t, addNotification } = opts;
  const store = useVrDesktopStore.getState();

  return requestImmersiveEnter({
    isSelfBusy: () =>
      store.overlayOpen || store.phase === "entering" || store.phase === "active",
    getBlockerMessage: () => {
      const mmdVr = useMmdVrStore.getState();
      if (mmdVr.overlayOpen || mmdVr.phase === "entering" || mmdVr.phase === "active") {
        return t("settingsMmdVrNeedExitShowcase");
      }
      return null;
    },
    setEntering: () => store.setPhase("entering"),
    setLastError: (v) => store.setLastError(v),
    openOverlay: () => store.openOverlay(),
    preloadScene: () => {
      void preloadVrDesktopScene();
    },
    beginSessionFromClick: beginVrSessionFromClick,
    markEntered: () => store.markEntered(),
    failEnter: (detail) => store.failEnter(detail),
    notify: (message, type = "warning") => {
      addNotification({
        title: t("settingsVrDesktop"),
        message,
        type,
        category: "system",
        appId: "settings",
      });
    },
    needHttpsMessage: t("settingsVrDesktopNeedHttps"),
    noXrMessage: t("settingsVrDesktopNoXr"),
    logTag: "vrDesktop",
    refreshCapability: () => {
      void refreshVrCapability();
    },
  });
}
