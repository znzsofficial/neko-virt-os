import { Icon } from "@iconify-icon/react";
import type { RefObject } from "react";
import type { TranslationKey } from "../../../languageStore";

function SettingsRowLabel({ icon, children }: { icon: string; children: string }) {
  return <span className="settings-row-label"><Icon icon={icon} width={15} height={15} /><strong>{children}</strong></span>;
}

type Props = {
  t: (key: TranslationKey) => string;
  storageLabel: string;
  settingsTransferBusy: boolean;
  exportSettings: () => void;
  importSettingsFile: (file: File) => Promise<void>;
  importInputRef: RefObject<HTMLInputElement | null>;
  cacheBusy: boolean;
  clearCacheStorage: () => Promise<void>;
  virtualFilesBusy: boolean;
  resetLocalFiles: () => Promise<void>;
  siteDataBusy: boolean;
  clearSiteData: () => Promise<void>;
};

export function DataSettings({
  t,
  storageLabel,
  settingsTransferBusy,
  exportSettings,
  importSettingsFile,
  importInputRef,
  cacheBusy,
  clearCacheStorage,
  virtualFilesBusy,
  resetLocalFiles,
  siteDataBusy,
  clearSiteData,
}: Props) {
  return (
    <div className="settings-stack">
      <header className="settings-pane-head">
        <h2 id="settings-heading-data">{t("settingsNavData")}</h2>
      </header>

      <dl className="settings-kv settings-kv-plain">
        <div>
          <dt>{t("dataOriginStorage")}</dt>
          <dd>{storageLabel}</dd>
        </div>
      </dl>

      <section className="settings-card">
        <p className="settings-inline-hint">{t("settingsBackupScope")}</p>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:download-minimalistic-bold-duotone">{t("settingsExport")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" disabled={settingsTransferBusy} onClick={exportSettings}>
            {settingsTransferBusy ? t("settingsTransferring") : t("settingsExport")}
          </button>
        </div>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:upload-minimalistic-bold-duotone">{t("settingsImport")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" disabled={settingsTransferBusy} onClick={() => importInputRef.current?.click()}>
            {settingsTransferBusy ? t("settingsTransferring") : t("settingsImport")}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importSettingsFile(file);
            }}
          />
        </div>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:trash-bin-trash-bold-duotone">{t("clearCache")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" disabled={cacheBusy} onClick={() => void clearCacheStorage()}>{cacheBusy ? t("settingsClearing") : t("clearCache")}</button>
        </div>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:folder-with-files-bold-duotone">{t("virtualFiles")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" disabled={virtualFilesBusy} onClick={() => void resetLocalFiles()}>{virtualFilesBusy ? t("settingsResetting") : t("resetFiles")}</button>
        </div>
        <div className="settings-row-line">
          <SettingsRowLabel icon="solar:database-bold-duotone">{t("siteData")}</SettingsRowLabel>
          <button type="button" className="settings-btn-pill" disabled={siteDataBusy} onClick={() => void clearSiteData()}>
            {siteDataBusy ? t("settingsResetting") : t("clearSiteData")}
          </button>
        </div>
      </section>
    </div>
  );
}
