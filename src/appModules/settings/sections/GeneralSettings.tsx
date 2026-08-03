import { Icon } from "@iconify-icon/react";
import type { TranslationKey } from "../../../languageStore";
import type { DeveloperPrefs } from "../../../system/developerPrefs";
import type { AutoLockMinutes, SystemPrefs } from "../../../system/systemPrefs";
import type { DesktopLayoutMode } from "../../../types";
import { SettingsChoiceGroup, SettingsSwitch } from "../components/SettingsControls";

type Props = {
  t: (key: TranslationKey) => string;
  language: "zh" | "en";
  setLanguage: (language: "zh" | "en") => void;
  systemPrefs: SystemPrefs;
  setSystemPrefs: (patch: Partial<SystemPrefs>) => void;
  developerPrefs: DeveloperPrefs;
  setDeveloperPrefs: (patch: Partial<DeveloperPrefs>) => void;
  widgetsCollapsed: boolean;
  setWidgetsCollapsed: (collapsed: boolean) => void;
  desktopLayoutMode: DesktopLayoutMode;
  setDesktopLayoutMode: (mode: DesktopLayoutMode) => void;
};

function CardTitle({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-card-title"><Icon icon={icon} width={16} height={16} /><strong>{children}</strong></span>;
}

function RowLabel({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-row-label"><Icon icon={icon} width={15} height={15} /><strong>{children}</strong></span>;
}

export function GeneralSettings({ t, language, setLanguage, systemPrefs, setSystemPrefs, developerPrefs, setDeveloperPrefs, widgetsCollapsed, setWidgetsCollapsed, desktopLayoutMode, setDesktopLayoutMode }: Props) {
  return <div className="settings-stack">
    <header className="settings-pane-head"><h2 id="settings-heading-general">{t("settingsNavGeneral")}</h2></header>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:global-bold-duotone">{t("settingsLanguage")}</CardTitle></header>
      <SettingsChoiceGroup label={t("settingsLanguage")} value={language} onChange={setLanguage} options={( ["zh", "en"] as const).map((lang) => ({ value: lang, label: lang === "zh" ? t("languageChinese") : t("languageEnglish"), content: <><span className="settings-choice-icon"><Icon icon={lang === "zh" ? "solar:global-bold-duotone" : "solar:text-bold-duotone"} width={16} height={16} /></span><strong>{lang === "zh" ? t("languageChinese") : t("languageEnglish")}</strong></> }))} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:clock-circle-bold-duotone">{t("settingsTimeFormat")}</CardTitle></header>
      <SettingsChoiceGroup label={t("settingsTimeFormat")} value={systemPrefs.hour12 ? "12" : "24"} onChange={(value) => setSystemPrefs({ hour12: value === "12" })} options={[{ value: "24", label: t("settingsTime24h"), content: <><span className="settings-choice-icon"><Icon icon="solar:clock-circle-bold-duotone" width={16} height={16} /></span><strong>{t("settingsTime24h")}</strong></> }, { value: "12", label: t("settingsTime12h"), content: <><span className="settings-choice-icon"><Icon icon="solar:history-bold-duotone" width={16} height={16} /></span><strong>{t("settingsTime12h")}</strong></> }]} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:lock-keyhole-bold-duotone">{t("settingsAutoLock")}</CardTitle></header>
      <SettingsChoiceGroup label={t("settingsAutoLock")} value={String(systemPrefs.autoLockMinutes)} className="settings-select-group" optionClassName="settings-btn-pill" onChange={(value) => setSystemPrefs({ autoLockMinutes: Number(value) as AutoLockMinutes })} options={[0, 5, 15, 30].map((minutes) => ({ value: String(minutes), label: t(minutes === 0 ? "settingsAutoLockNever" : `settingsAutoLock${minutes}` as TranslationKey) }))} />
    </section>
    <section className="settings-card">
      <div className="settings-row-line"><RowLabel icon="solar:text-bold-duotone">{t("settingsTaskbarLabels")}</RowLabel><SettingsSwitch checked={systemPrefs.taskbarShowLabels} label={t("settingsTaskbarLabels")} onChange={(checked) => setSystemPrefs({ taskbarShowLabels: checked })} /></div>
      <div className="settings-row-line"><RowLabel icon="solar:eye-bold-duotone">{t("settingsTaskbarAutoHide")}</RowLabel><SettingsSwitch checked={systemPrefs.taskbarAutoHide} label={t("settingsTaskbarAutoHide")} onChange={(checked) => setSystemPrefs({ taskbarAutoHide: checked })} /></div>
      <div className="settings-row-line"><RowLabel icon="solar:widget-2-bold-duotone">{t("settingsDesktopWidgets")}</RowLabel><SettingsSwitch checked={!widgetsCollapsed} label={t("settingsDesktopWidgets")} onChange={(checked) => setWidgetsCollapsed(!checked)} /></div>
    </section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:widget-4-bold-duotone">{t("settingsDesktopLayout")}</CardTitle></header>
      <SettingsChoiceGroup label={t("settingsDesktopLayout")} value={desktopLayoutMode} onChange={setDesktopLayoutMode} options={[{ value: "grid", label: t("settingsDesktopLayoutGrid"), content: <><span className="settings-choice-icon"><Icon icon="solar:widget-4-bold-duotone" width={16} height={16} /></span><strong>{t("settingsDesktopLayoutGrid")}</strong></> }, { value: "free", label: t("settingsDesktopLayoutFree"), content: <><span className="settings-choice-icon"><Icon icon="solar:cursor-bold-duotone" width={16} height={16} /></span><strong>{t("settingsDesktopLayoutFree")}</strong></> }]} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:hand-stars-bold-duotone">{t("settingsAccessibility")}</CardTitle></header>
      <div className="settings-row-line"><RowLabel icon="solar:play-circle-bold-duotone">{t("settingsReduceMotion")}</RowLabel><SettingsSwitch checked={developerPrefs.reduceMotion} label={t("settingsReduceMotion")} onChange={(checked) => setDeveloperPrefs({ reduceMotion: checked })} /></div>
      <div className="settings-row-line"><RowLabel icon="solar:cursor-bold-duotone">{t("settingsLargeTargets")}</RowLabel><SettingsSwitch checked={developerPrefs.largeTargets} label={t("settingsLargeTargets")} onChange={(checked) => setDeveloperPrefs({ largeTargets: checked })} /></div>
      <div className="settings-row-line"><RowLabel icon="solar:moon-bold-duotone">{t("settingsHighContrast")}</RowLabel><SettingsSwitch checked={developerPrefs.highContrast} label={t("settingsHighContrast")} onChange={(checked) => setDeveloperPrefs({ highContrast: checked })} /></div>
    </section>
  </div>;
}
