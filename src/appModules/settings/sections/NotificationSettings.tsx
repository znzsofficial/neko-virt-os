import { Icon } from "@iconify-icon/react";
import type { TranslationKey } from "../../../languageStore";
import type { BannerDuration, NotificationCategory, NotificationPrefs } from "../../../osUiStore";
import { SettingsChoiceGroup, SettingsSwitch } from "../components/SettingsControls";

type Props = {
  t: (key: TranslationKey) => string;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (patch: Partial<NotificationPrefs> | ((current: NotificationPrefs) => NotificationPrefs)) => void;
  updateDndTime: (field: "dndStart" | "dndEnd", value: string) => void;
};

function CardTitle({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-card-title"><Icon icon={icon} width={16} height={16} /><strong>{children}</strong></span>;
}

function RowLabel({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-row-label"><Icon icon={icon} width={15} height={15} /><strong>{children}</strong></span>;
}

export function NotificationSettings({ t, notificationPrefs, setNotificationPrefs, updateDndTime }: Props) {
  return <div className="settings-stack">
    <header className="settings-pane-head"><h2 id="settings-heading-notifications">{t("settingsNavNotifications")}</h2></header>
    <section className="settings-card"><div className="settings-row-line"><RowLabel icon="solar:moon-sleep-bold-duotone">{t("notificationDndToggle")}</RowLabel><SettingsSwitch checked={notificationPrefs.dndEnabled} label={t("notificationDndToggle")} onChange={(checked) => setNotificationPrefs({ dndEnabled: checked })} /></div></section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:calendar-bold-duotone">{t("settingsDndSchedule")}</CardTitle></header><div className="settings-inline-fields">
      <label><span>{t("settingsDndStart")}</span><input type="time" value={notificationPrefs.dndStart} onChange={(event) => updateDndTime("dndStart", event.target.value)} /></label>
      <label><span>{t("settingsDndEnd")}</span><input type="time" value={notificationPrefs.dndEnd} onChange={(event) => updateDndTime("dndEnd", event.target.value)} /></label>
    </div></section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:bell-bold-duotone">{t("settingsBannerDuration")}</CardTitle></header>
      <SettingsChoiceGroup label={t("settingsBannerDuration")} value={notificationPrefs.bannerDuration} className="settings-select-group" optionClassName="settings-btn-pill" onChange={(bannerDuration) => setNotificationPrefs({ bannerDuration })} options={(["short", "standard", "long"] as const).map((id) => ({ value: id, label: t(id === "short" ? "settingsBannerShort" : id === "standard" ? "settingsBannerStandard" : "settingsBannerLong") }))} />
    </section>
    <section className="settings-card"><header className="settings-card-head"><CardTitle icon="solar:checklist-minimalistic-bold-duotone">{t("settingsNotifyCategories")}</CardTitle></header>
      {([{ id: "system" as NotificationCategory, label: t("notificationCategorySystem"), icon: "solar:monitor-bold-duotone" }, { id: "files" as NotificationCategory, label: t("notificationCategoryFiles"), icon: "solar:folder-bold-duotone" }, { id: "apps" as NotificationCategory, label: t("notificationCategoryApps"), icon: "solar:widget-2-bold-duotone" }, { id: "media" as NotificationCategory, label: t("notificationCategoryMedia"), icon: "solar:play-circle-bold-duotone" }]).map((item) => <div key={item.id} className="settings-row-line"><RowLabel icon={item.icon}>{item.label}</RowLabel><SettingsSwitch checked={notificationPrefs.categories[item.id]} label={item.label} onChange={(checked) => setNotificationPrefs((current) => ({ ...current, categories: { ...current.categories, [item.id]: checked } }))} /></div>)}
    </section>
  </div>;
}
