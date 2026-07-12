import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { APP_VERSION, OPEN_SOURCE_PACKAGES } from "../openSourceLicenses";
import { type DeviceSnapshot, getDeviceRows, readHighEntropyDeviceInfo, type StorageSnapshot } from "../systemInfo";

export function AboutApp() {
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSnapshot | undefined>();
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    navigator.storage?.estimate().then(setStorage).catch(() => setStorage(null));
    void readHighEntropyDeviceInfo().then(setDeviceInfo);
  }, []);

  const rows = getDeviceRows(storage, deviceInfo, t);

  return (
    <div className="about-app">
      <div className="about-header">
        <div className="about-mark">
          <Icon icon="solar:cat-bold-duotone" width={54} height={54} />
        </div>
        <div>
          <h2>NekoVirtOS</h2>
          <p>{t("systemInfo")}</p>
        </div>
      </div>
      <dl>
        <div><dt>{t("edition")}</dt><dd>NekoVirtOS Web</dd></div>
        <div><dt>{t("version")}</dt><dd>{APP_VERSION}</dd></div>
        <div><dt>{t("interface")}</dt><dd>Quiet Workstation</dd></div>
        <div><dt>{t("storageMode")}</dt><dd>Local-first</dd></div>
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>
        ))}
      </dl>

      <section className="about-licenses" aria-labelledby="about-licenses-title">
        <header className="about-licenses-head">
          <h3 id="about-licenses-title">{t("aboutOpenSource")}</h3>
          <p>{t("aboutOpenSourceHint")}</p>
        </header>
        <div className="about-licenses-table" role="table" aria-label={t("aboutOpenSource")}>
          <div className="about-licenses-row is-head" role="row">
            <span role="columnheader">{t("aboutPackage")}</span>
            <span role="columnheader">{t("aboutPackageVersion")}</span>
            <span role="columnheader">{t("aboutPackageLicense")}</span>
          </div>
          {OPEN_SOURCE_PACKAGES.map((pkg) => (
            <div key={pkg.name} className="about-licenses-row" role="row">
              <span className="about-pkg-name" role="cell" title={pkg.name}>{pkg.name}</span>
              <span className="about-pkg-ver mmd-mono" role="cell">{pkg.version}</span>
              <span className="about-pkg-lic" role="cell" title={pkg.license}>{pkg.license}</span>
            </div>
          ))}
        </div>
        <p className="about-licenses-note">{t("aboutOpenSourceNote")}</p>
      </section>
    </div>
  );
}
