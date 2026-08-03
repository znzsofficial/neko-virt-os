import type { TranslationKey } from "../../../languageStore";
import { APP_VERSION, OPEN_SOURCE_PACKAGES } from "../../../system/openSourceLicenses";

type Props = {
  t: (key: TranslationKey) => string;
  aboutRows: readonly (readonly [string, string])[];
};

export function AboutSettings({ t, aboutRows }: Props) {
  return (
    <div className="settings-stack">
      <header className="settings-pane-head">
        <h2 id="settings-heading-about">{t("settingsNavAbout")}</h2>
      </header>
      <dl className="settings-kv settings-kv-plain">
        {([
          [t("edition"), "NekoVirtOS Web"],
          [t("version"), APP_VERSION],
          ...aboutRows,
        ] as const).map(([label, value]) => (
          <div key={String(label)}><dt>{label}</dt><dd title={String(value)}>{String(value)}</dd></div>
        ))}
      </dl>
      <section className="settings-block">
        <h3 className="settings-section-title">{t("aboutOpenSource")}</h3>
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
      </section>
    </div>
  );
}
