import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";
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
        <div><dt>{t("interface")}</dt><dd>Quiet Workstation</dd></div>
        <div><dt>{t("storageMode")}</dt><dd>Local-first</dd></div>
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>
        ))}
      </dl>
    </div>
  );
}
