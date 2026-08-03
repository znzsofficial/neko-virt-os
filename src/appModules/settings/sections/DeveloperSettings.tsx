import { Icon } from "@iconify-icon/react";
import type { TranslationKey } from "../../../languageStore";
import type { DeveloperPrefs } from "../../../system/developerPrefs";
import type { AppId } from "../../../types";
import { SettingsChoiceGroup, SettingsSwitch } from "../components/SettingsControls";

function SettingsRowLabel({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-row-label"><Icon icon={icon} width={15} height={15} /><strong>{children}</strong></span>;
}

type Props = {
  t: (key: TranslationKey) => string;
  developerPrefs: DeveloperPrefs;
  setDeveloperPrefs: (patch: Partial<DeveloperPrefs>) => void;
  openApp: (appId: AppId) => string | null;
};

export function DeveloperSettings({ t, developerPrefs, setDeveloperPrefs, openApp }: Props) {
  return (
    <div className="settings-stack">
      <header className="settings-pane-head">
        <h2 id="settings-heading-developer">{t("settingsNavDeveloper")}</h2>
      </header>

      <section className="settings-card">
        <header className="settings-card-head">
          <span className="settings-card-title"><Icon icon="solar:play-circle-bold-duotone" width={16} height={16} /><strong>{t("settingsAnimationQuality")}</strong></span>
        </header>
        <SettingsChoiceGroup
          label={t("settingsAnimationQuality")}
          value={developerPrefs.animationQuality}
          onChange={(animationQuality) => setDeveloperPrefs({ animationQuality })}
          options={([
            { id: "fluid" as const, label: t("settingsAnimationFluid"), icon: "solar:bolt-bold-duotone" },
            { id: "power" as const, label: t("settingsAnimationPower"), icon: "solar:battery-charge-bold-duotone" },
          ]).map((item) => ({ value: item.id, label: item.label, content: <><span className="settings-choice-icon"><Icon icon={item.icon} width={16} height={16} /></span><strong>{item.label}</strong></> }))}
        />
      </section>

      <section className="settings-card">
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:graph-up-bold-duotone">{t("settingsShowFps")}</SettingsRowLabel>
          <SettingsSwitch checked={developerPrefs.showFps} label={t("settingsShowFps")} onChange={(checked) => setDeveloperPrefs({ showFps: checked })} />
        </div>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:ruler-cross-pen-bold-duotone">{t("settingsDebugBorders")}</SettingsRowLabel>
          <SettingsSwitch checked={developerPrefs.debugBorders} label={t("settingsDebugBorders")} onChange={(checked) => setDeveloperPrefs({ debugBorders: checked })} />
        </div>
      </section>

      <section className="settings-card">
        <header className="settings-card-head">
          <span className="settings-card-title"><Icon icon="boxicons:vr-headset-filled" width={16} height={16} /><strong>{t("settingsVrDesktop")}</strong></span>
          <span className="settings-badge-muted">{t("settingsVrDesktopExperimental")}</span>
        </header>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:settings-bold-duotone">{t("vrDesktopSettingsLead")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" onClick={() => openApp("vr-desktop")}>{t("vrDesktopSettingsOpen")}</button>
        </div>
      </section>
    </div>
  );
}
