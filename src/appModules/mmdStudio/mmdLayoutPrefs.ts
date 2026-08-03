import { setOwnedLocalStorageItem } from "../../system/persistenceGate";

const STORAGE_KEY = "neko-virt-os.mmd-layout.v1";

export const MMD_SIDE_WIDTH_DEFAULT = 300;
export const MMD_SIDE_WIDTH_MIN = 240;
export const MMD_SIDE_WIDTH_MAX = 480;
export const MMD_TRANSPORT_HEIGHT_DEFAULT = 148;
export const MMD_TRANSPORT_HEIGHT_MIN = 120;
export const MMD_TRANSPORT_HEIGHT_MAX = 240;

export type MmdLayoutPrefs = {
  sideWidth: number;
  sideCollapsed: boolean;
  transportHeight: number;
};

const DEFAULTS: MmdLayoutPrefs = {
  sideWidth: MMD_SIDE_WIDTH_DEFAULT,
  sideCollapsed: false,
  transportHeight: MMD_TRANSPORT_HEIGHT_DEFAULT,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampSideWidth(value: number) {
  return clamp(Math.round(value), MMD_SIDE_WIDTH_MIN, MMD_SIDE_WIDTH_MAX);
}

export function clampTransportHeight(value: number) {
  return clamp(Math.round(value), MMD_TRANSPORT_HEIGHT_MIN, MMD_TRANSPORT_HEIGHT_MAX);
}

export function readMmdLayoutPrefs(): MmdLayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<MmdLayoutPrefs>;
    return {
      sideWidth: clampSideWidth(Number(parsed.sideWidth) || DEFAULTS.sideWidth),
      sideCollapsed: Boolean(parsed.sideCollapsed),
      transportHeight: clampTransportHeight(Number(parsed.transportHeight) || DEFAULTS.transportHeight),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeMmdLayoutPrefs(prefs: MmdLayoutPrefs) {
  try {
    setOwnedLocalStorageItem(
      STORAGE_KEY,
      JSON.stringify({
        sideWidth: clampSideWidth(prefs.sideWidth),
        sideCollapsed: Boolean(prefs.sideCollapsed),
        transportHeight: clampTransportHeight(prefs.transportHeight),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
