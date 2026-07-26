import { Icon } from "@iconify-icon/react";
import { useEffect, useId } from "react";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";
import { SettingsChoiceGroup, SettingsSwitch } from "./settings/components/SettingsControls";
import { requestVrDesktopEnter } from "../vrDesktop/requestVrEnter";
import {
  formatVrCapabilityHint,
  refreshVrCapability,
  useVrDesktopStore,
  type VrAntialiasPref,
  type VrDprPref,
  type VrFrameRatePref,
  type VrFramebufferScalePref,
  type VrFoveationPref,
  type VrFloorDetailPref,
  type VrPanelScalePref,
} from "../vrDesktop/vrDesktopStore";
import { formatVrProfileSummary, getVrRenderProfile } from "../vrDesktop/vrQuality";
import { XR_THEME_COLORS, getXrAccentTokens, type XrThemeColor } from "../xr";

export function VrDesktopSettingsApp() {
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const prefs = useVrDesktopStore((state) => state.prefs);
  const setPrefs = useVrDesktopStore((state) => state.setPrefs);
  const capability = useVrDesktopStore((state) => state.capability);
  const sessionSupported = useVrDesktopStore((state) => state.sessionSupported);
  const phase = useVrDesktopStore((state) => state.phase);
  const lastError = useVrDesktopStore((state) => state.lastError);
  const capabilityHintId = useId();
  const enterDisabled = !prefs.enabled || capability === "unavailable" || capability === "limited" || phase === "entering" || phase === "active";

  useEffect(() => {
    if (prefs.enabled) void refreshVrCapability();
  }, [prefs.enabled]);

  return (
    <div className="settings-app vr-settings-app">
      <div className="settings-stack">
        <header className="settings-pane-head">
          <div>
            <h2>{t("settingsVrDesktop")}</h2>
            <p className="settings-inline-hint">{t("vrDesktopSettingsLead")}</p>
          </div>
          <span className="settings-badge-muted">{t("settingsVrDesktopExperimental")}</span>
        </header>

        <section className="settings-card">
          <header className="settings-card-head"><strong>{t("settingsVrThemeColor")}</strong></header>
          <ThemeColorSwatches value={prefs.themeColor} label={t("settingsVrThemeColor")} onChange={(themeColor) => setPrefs({ themeColor })} />
        </section>

        <section className="settings-card">
          <div className="settings-row-line">
            <span className="settings-row-label"><Icon icon="solar:check-circle-bold-duotone" width={15} height={15} /><strong>{t("settingsVrDesktopEnable")}</strong></span>
            <SettingsSwitch checked={prefs.enabled} label={t("settingsVrDesktopEnable")} onChange={(enabled) => setPrefs({ enabled })} />
          </div>
          <div className="settings-row-line">
            <div>
              <strong>{phase === "entering" ? t("settingsVrDesktopEntering") : t("settingsVrDesktopEnter")}</strong>
              <p id={capabilityHintId} className="settings-inline-hint settings-control-reason">
                {capability === "unavailable" ? t("settingsVrDesktopNeedHttps") : capability === "limited" ? t("settingsVrDesktopNoXr") : formatVrCapabilityHint(capability, sessionSupported)}
                {lastError ? ` · ${lastError}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="settings-btn-pill"
              disabled={enterDisabled}
              aria-describedby={capabilityHintId}
              onClick={() => void requestVrDesktopEnter({ t, addNotification })}
            >
              {t("settingsVrDesktopEnter")}
            </button>
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-head"><strong>{t("settingsVrDesktopQuality")}</strong></header>
          <SettingsChoiceGroup
            label={t("settingsVrDesktopQuality")}
            value={prefs.renderQuality}
            className="settings-choice-grid cols-3"
            onChange={(renderQuality) => setPrefs({ renderQuality })}
            options={([
              ["high", "settingsVrDesktopQualityHigh", "solar:star-bold-duotone"],
              ["balanced", "settingsVrDesktopQualityBalanced", "solar:widget-bold-duotone"],
              ["low", "settingsVrDesktopQualityLow", "solar:battery-charge-bold-duotone"],
            ] as const).map(([value, key, icon]) => ({ value, label: t(key), content: <><span className="settings-choice-icon"><Icon icon={icon} width={16} height={16} /></span><strong>{t(key)}</strong></> }))}
          />
          <p className="settings-inline-hint">{formatVrProfileSummary(getVrRenderProfile(prefs), language)}</p>
          <p className="settings-inline-hint">{t("settingsVrDesktopQualityHint")}</p>
        </section>

        <section className="settings-card vr-settings-fine-grid">
          <VrPillGroup label={t("settingsVrDesktopDpr")} value={prefs.dprPref} onChange={(dprPref) => setPrefs({ dprPref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["1", "1x"], ["1.25", "1.25x"], ["1.5", "1.5x"]] as const} />
          <VrPillGroup label={t("settingsVrDesktopFramebufferScale")} value={prefs.framebufferScalePref} onChange={(framebufferScalePref) => setPrefs({ framebufferScalePref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["0.7", "70%"], ["0.85", "85%"], ["1", "100%"]] as const} />
          <VrPillGroup label={t("settingsVrDesktopFoveation")} value={prefs.foveationPref} onChange={(foveationPref) => setPrefs({ foveationPref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["off", t("settingsVrDesktopAaOff")], ["medium", t("settingsVrDesktopPanelScaleMedium")], ["high", t("settingsVrDesktopPanelScaleHigh")]] as const} />
          <VrPillGroup label={t("settingsVrDesktopPanelScale")} value={prefs.panelScalePref} onChange={(panelScalePref) => setPrefs({ panelScalePref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["low", t("settingsVrDesktopPanelScaleLow")], ["medium", t("settingsVrDesktopPanelScaleMedium")], ["high", t("settingsVrDesktopPanelScaleHigh")]] as const} />
          <VrPillGroup label={t("settingsVrDesktopFloorDetail")} value={prefs.floorDetailPref} onChange={(floorDetailPref) => setPrefs({ floorDetailPref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["low", t("settingsVrDesktopPanelScaleLow")], ["medium", t("settingsVrDesktopPanelScaleMedium")], ["high", t("settingsVrDesktopPanelScaleHigh")]] as const} />
          <VrPillGroup label={t("settingsVrDesktopFrameRate")} value={prefs.frameRatePref} onChange={(frameRatePref) => setPrefs({ frameRatePref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["high", t("settingsVrDesktopFrameRateHigh")], ["mid", t("settingsVrDesktopFrameRateMid")], ["low", t("settingsVrDesktopFrameRateLow")]] as const} />
          <VrPillGroup label={t("settingsVrDesktopAntialias")} value={prefs.antialiasPref} onChange={(antialiasPref) => setPrefs({ antialiasPref })} options={[["auto", t("settingsVrDesktopQualityAuto")], ["on", t("settingsVrDesktopAaOn")], ["off", t("settingsVrDesktopAaOff")]] as const} />
        </section>

        <section className="settings-card">
          <div className="settings-row-line"><strong>{t("settingsVrDesktopSoftEdges")}</strong><SettingsSwitch checked={prefs.softEdges} disabled={!getVrRenderProfile(prefs).allowSoftEdges} label={t("settingsVrDesktopSoftEdges")} onChange={(softEdges) => setPrefs({ softEdges })} /></div>
          <div className="settings-row-line"><strong>{t("settingsVrDesktopShowFps")}</strong><SettingsSwitch checked={prefs.showFps} label={t("settingsVrDesktopShowFps")} onChange={(showFps) => setPrefs({ showFps })} /></div>
          <div className="settings-row-line"><strong>{t("settingsVrDesktopResetLayout")}</strong><button type="button" className="settings-btn-pill" onClick={() => useVrDesktopStore.getState().resetLayout()}>{t("settingsVrDesktopResetLayout")}</button></div>
        </section>
      </div>
    </div>
  );
}

function ThemeColorSwatches({ value, label, onChange }: { value: XrThemeColor; label: string; onChange: (value: XrThemeColor) => void }) {
  return (
    <div className="settings-accent-row" role="group" aria-label={label}>
      {XR_THEME_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`settings-accent-swatch${value === color ? " is-active" : ""}`}
          style={{ background: getXrAccentTokens(color).primary }}
          aria-label={`${label}: ${color}`}
          aria-pressed={value === color}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function VrPillGroup<T extends VrDprPref | VrPanelScalePref | VrFrameRatePref | VrAntialiasPref | VrFramebufferScalePref | VrFoveationPref | VrFloorDetailPref>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return (
    <div className="vr-settings-fine-group">
      <strong>{label}</strong>
      <SettingsChoiceGroup label={label} value={value} className="settings-select-group" optionClassName="settings-btn-pill" onChange={onChange} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} />
    </div>
  );
}
