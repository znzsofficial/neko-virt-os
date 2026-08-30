import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useEffect, useId } from "react";
import { useLanguageStore } from "../languageStore";
import { useOsUiStore, type WorkspaceId } from "../osUiStore";
import { useDesktopStore } from "../windowStore";
import { requestVrDesktopEnter } from "../vrDesktop/requestVrEnter";
import { refreshVrCapability, useVrDesktopStore } from "../vrDesktop/vrDesktopStore";
import { useNotificationStore } from "../notificationStore";

const WORKSPACES: WorkspaceId[] = [0, 1, 2];

export function ControlCenter() {
  const t = useLanguageStore((state) => state.t);
  const open = useOsUiStore((state) => state.controlCenterOpen);
  const setControlCenterOpen = useOsUiStore((state) => state.setControlCenterOpen);
  const dndEnabled = useOsUiStore((state) => state.notificationPrefs.dndEnabled);
  const setNotificationPrefs = useOsUiStore((state) => state.setNotificationPrefs);
  const activeWorkspace = useOsUiStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useOsUiStore((state) => state.setActiveWorkspace);
  const lockSession = useOsUiStore((state) => state.lockSession);
  const setNotificationCenterOpen = useOsUiStore((state) => state.setNotificationCenterOpen);
  const openApp = useDesktopStore((state) => state.openApp);
  const vrEnabled = useVrDesktopStore((state) => state.prefs.enabled);
  const vrPhase = useVrDesktopStore((state) => state.phase);
  const vrCapability = useVrDesktopStore((state) => state.capability);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const windows = useDesktopStore((state) => state.windows);

  const vrUnavailableReasonId = useId();
  const vrUnavailable = vrCapability === "unavailable" || vrCapability === "limited";
  const vrUnavailableReason = vrCapability === "unavailable" ? t("settingsVrDesktopNeedHttps") : t("settingsVrDesktopNoXr");

  // Refresh when panel opens (secure context / xr may change after navigation).
  useEffect(() => {
    if (!open || !vrEnabled) return;
    void refreshVrCapability();
  }, [open, vrEnabled]);

  if (!open) return null;

  function switchWorkspace(workspace: WorkspaceId) {
    setActiveWorkspace(workspace);
    const top = windows
      .filter((window) => (window.workspaceId ?? 0) === workspace)
      .slice()
      .sort((a, b) => b.z - a.z)[0];
    if (top) {
      restoreWindow(top.id);
      focusWindow(top.id);
      return;
    }
    useDesktopStore.setState({ activeWindowId: null });
  }

  return (
    <div className="control-center-panel" role="dialog" aria-label={t("controlCenter")}>
      <div className="control-center-grid">
        <button
          type="button"
          className={clsx("control-center-tile", dndEnabled && "is-active")}
          aria-pressed={dndEnabled}
          onClick={() => setNotificationPrefs({ dndEnabled: !dndEnabled })}
        >
          <Icon icon="solar:moon-sleep-bold-duotone" width={18} height={18} />
          <span>{t("notificationDndToggle")}</span>
        </button>
      </div>

      <div className="control-center-section">
        <span className="control-center-label">{t("workspaces")}</span>
        <div className="control-center-workspaces">
          {WORKSPACES.map((workspace) => (
            <button
              key={workspace}
              type="button"
              className={clsx("control-center-ws", activeWorkspace === workspace && "is-active")}
              aria-pressed={activeWorkspace === workspace}
              onClick={() => switchWorkspace(workspace)}
            >
              {workspace + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="control-center-actions">
        <button
          type="button"
          className="control-center-action"
          onClick={() => {
            setControlCenterOpen(false);
            setNotificationCenterOpen(true);
          }}
        >
          <Icon icon="solar:bell-bold-duotone" width={16} height={16} />
          {t("notificationCenter")}
        </button>
        <button
          type="button"
          className="control-center-action"
          onClick={() => {
            setControlCenterOpen(false);
            openApp("settings");
          }}
        >
          <Icon icon="solar:settings-bold-duotone" width={16} height={16} />
          {t("appSettings")}
        </button>
        {vrEnabled ? (
          <button
            type="button"
            className="control-center-action"
            disabled={vrUnavailable || vrPhase === "entering" || vrPhase === "active"}
            aria-describedby={vrUnavailable ? vrUnavailableReasonId : undefined}
            title={vrUnavailable ? vrUnavailableReason : t("settingsVrDesktop")}
            onClick={() => {
              // requestSession must start on this stack (Quest user activation).
              const enter = requestVrDesktopEnter({ t, addNotification });
              setControlCenterOpen(false);
              void enter;
            }}
          >
            <Icon icon="boxicons:vr-headset-filled" width={16} height={16} />
            {vrPhase === "entering"
              ? t("settingsVrDesktopEntering")
              : t("settingsVrDesktop")}
          </button>
        ) : null}
        {vrEnabled && vrUnavailable ? <span id={vrUnavailableReasonId} className="settings-visually-hidden">{vrUnavailableReason}</span> : null}
        <button
          type="button"
          className="control-center-action"
          title={t("settingsMmdVrShowcase")}
          onClick={() => {
            setControlCenterOpen(false);
            window.location.assign("./mmd-vr.html");
          }}
        >
          <Icon icon="solar:clapperboard-edit-bold-duotone" width={16} height={16} />
          {t("settingsMmdVrShowcase")}
        </button>
        <button
          type="button"
          className="control-center-action"
          onClick={() => {
            lockSession();
          }}
        >
          <Icon icon="solar:lock-keyhole-bold-duotone" width={16} height={16} />
          {t("lockSession")}
        </button>
      </div>
    </div>
  );
}
