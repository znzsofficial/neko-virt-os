import type { TranslationKey } from "./languageStore";

export type StorageSnapshot = { usage?: number; quota?: number };

export type DeviceSnapshot = {
  architecture?: string;
  bitness?: string;
  platformVersion?: string;
  model?: string;
  uaFullVersion?: string;
  fullVersionList?: { brand: string; version: string }[];
};

type BrowserNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    brands?: { brand: string; version: string }[];
    mobile?: boolean;
    getHighEntropyValues?: (hints: string[]) => Promise<DeviceSnapshot>;
  };
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
};

export type BrowserPerformance = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
};

export function formatBytes(value?: number) {
  if (!value || Number.isNaN(value)) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

export function getStorageLabel(snapshot: StorageSnapshot | null) {
  if (!snapshot?.quota) return "Unavailable";
  return `${formatBytes(snapshot.usage)} used of ${formatBytes(snapshot.quota)}`;
}

export async function readHighEntropyDeviceInfo() {
  const nav = navigator as BrowserNavigator;
  try {
    return await nav.userAgentData?.getHighEntropyValues?.(["architecture", "bitness", "platformVersion", "model", "uaFullVersion", "fullVersionList"]);
  } catch {
    return undefined;
  }
}

export function getBrowserName(snapshot?: DeviceSnapshot) {
  const brands = snapshot?.fullVersionList ?? (navigator as BrowserNavigator).userAgentData?.brands;
  const brand = brands?.find((item) => !/Chromium|Not A\(?Brand/i.test(item.brand)) ?? brands?.[0];
  if (brand) return `${brand.brand} ${brand.version}`;
  const ua = navigator.userAgent;
  const match = ua.match(/(Firefox|Edg|Chrome|Safari)\/([\d.]+)/);
  return match ? `${match[1] === "Edg" ? "Edge" : match[1]} ${match[2]}` : ua;
}

export function getDeviceRows(storage: StorageSnapshot | null, device: DeviceSnapshot | undefined, t: (key: TranslationKey) => string) {
  const nav = navigator as BrowserNavigator;
  const screenInfo = window.screen;
  const connection = nav.connection;
  const heap = (performance as BrowserPerformance).memory;

  return [
    [t("processor"), navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} threads` : t("unavailable")],
    [t("memory"), nav.deviceMemory ? `${nav.deviceMemory} GB` : t("unavailable")],
    [t("jsHeap"), heap ? `${formatBytes(heap.usedJSHeapSize)} / ${formatBytes(heap.jsHeapSizeLimit)}` : t("unavailable")],
    [t("platform"), nav.userAgentData?.platform || navigator.platform || t("unavailable")],
    [t("architecture"), device?.architecture ? `${device.architecture}${device.bitness ? ` ${device.bitness}-bit` : ""}` : t("unavailable")],
    [t("platformVersion"), device?.platformVersion || t("unavailable")],
    [t("browser"), getBrowserName(device)],
    [t("mobile"), nav.userAgentData ? (nav.userAgentData.mobile ? t("yes") : t("no")) : navigator.maxTouchPoints > 1 ? t("possibly") : t("no")],
    [t("language"), navigator.language || t("unavailable")],
    [t("timezone"), Intl.DateTimeFormat().resolvedOptions().timeZone || t("unavailable")],
    [t("screen"), `${screenInfo.width} x ${screenInfo.height} @ ${window.devicePixelRatio.toFixed(2)}x`],
    [t("viewport"), `${window.innerWidth} x ${window.innerHeight}`],
    [t("colorDepth"), `${screenInfo.colorDepth}-bit`],
    [t("touchPoints"), `${navigator.maxTouchPoints || 0}`],
    [t("network"), connection?.effectiveType ? `${connection.effectiveType}${connection.downlink ? `, ${connection.downlink} Mbps` : ""}${connection.rtt ? `, ${connection.rtt}ms` : ""}` : t("unavailable")],
    [t("storage"), getStorageLabel(storage)],
    [t("secureContext"), window.isSecureContext ? t("yes") : t("no")],
  ];
}
