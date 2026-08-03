import { setOwnedLocalStorageItem } from "./persistenceGate";

export type AnimationQuality = "fluid" | "power";

export type DeveloperPrefs = {
  animationQuality: AnimationQuality;
  showFps: boolean;
  debugBorders: boolean;
  /** Accessibility: disable non-essential motion. */
  reduceMotion: boolean;
  /** Accessibility: larger hit targets. */
  largeTargets: boolean;
  /** Accessibility: stronger borders. */
  highContrast: boolean;
};

export const DEVELOPER_PREFS_KEY = "neko-virt-os.developer-prefs.v1";

export const DEFAULT_DEVELOPER_PREFS: DeveloperPrefs = {
  animationQuality: "fluid",
  showFps: false,
  debugBorders: false,
  reduceMotion: false,
  largeTargets: false,
  highContrast: false,
};

export function normalizeDeveloperPrefs(value: Partial<DeveloperPrefs> = {}): DeveloperPrefs {
  return {
    animationQuality: value.animationQuality === "power" ? "power" : "fluid",
    showFps: Boolean(value.showFps),
    debugBorders: Boolean(value.debugBorders),
    reduceMotion: Boolean(value.reduceMotion),
    largeTargets: Boolean(value.largeTargets),
    highContrast: Boolean(value.highContrast),
  };
}

export function readDeveloperPrefs(): DeveloperPrefs {
  try {
    const raw = localStorage.getItem(DEVELOPER_PREFS_KEY);
    return raw ? normalizeDeveloperPrefs(JSON.parse(raw) as Partial<DeveloperPrefs>) : DEFAULT_DEVELOPER_PREFS;
  } catch {
    return DEFAULT_DEVELOPER_PREFS;
  }
}

export function applyDeveloperPrefs(prefs: DeveloperPrefs) {
  const root = document.documentElement;
  root.setAttribute("data-motion", prefs.reduceMotion ? "reduced" : "full");
  root.setAttribute("data-animation-quality", prefs.animationQuality);
  root.setAttribute("data-debug-borders", prefs.debugBorders ? "on" : "off");
  root.setAttribute("data-show-fps", prefs.showFps ? "on" : "off");
  root.setAttribute("data-large-targets", prefs.largeTargets ? "on" : "off");
  root.setAttribute("data-high-contrast", prefs.highContrast ? "on" : "off");
}

export function updateDeveloperPrefs(patch: Partial<DeveloperPrefs>): DeveloperPrefs {
  const next = normalizeDeveloperPrefs({ ...readDeveloperPrefs(), ...patch });
  try {
    setOwnedLocalStorageItem(DEVELOPER_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  applyDeveloperPrefs(next);
  return next;
}
