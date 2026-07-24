import type { AppId } from "../types";

export type VrLauncherPageDef = {
  id: string;
  labelZh: string;
  labelEn: string;
  ids: AppId[];
};

/**
 * VR-native launcher only — no bridge to the 2D desktop shell.
 * Apps without an in-VR surface show a short status; never openApp / exit VR.
 */
export const VR_LAUNCHER_PAGES: VrLauncherPageDef[] = [
  {
    id: "workspace",
    labelZh: "空间",
    labelEn: "Space",
    ids: ["browser", "sticky-board"],
  },
];

/** Apps that have a real in-VR surface today. */
export const VR_NATIVE_APPS = new Set<AppId>(["browser", "sticky-board"]);

export function isVrNativeApp(appId: AppId): boolean {
  return VR_NATIVE_APPS.has(appId);
}
