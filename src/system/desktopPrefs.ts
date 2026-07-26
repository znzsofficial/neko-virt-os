import type { DesktopLayoutMode } from "../types";

export const DESKTOP_ICON_POSITIONS_KEY = "neko-virt-os.desktop-icons.v1";
export const DESKTOP_LAYOUT_MODE_KEY = "neko-virt-os.desktop-layout-mode.v1";

export function normalizeDesktopLayoutMode(value: unknown): DesktopLayoutMode {
  return value === "free" ? "free" : "grid";
}
