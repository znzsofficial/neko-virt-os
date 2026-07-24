import type { WindowState } from "./types";

/** Fresh desktop: Notes only. */
export const initialWindows: WindowState[] = [
  {
    id: "win-notes",
    appId: "notes",
    title: "笔记",
    icon: "solar:notes-bold-duotone",
    x: 900,
    y: 120,
    width: 545,
    height: 410,
    z: 1,
    minimized: false,
    maximized: false,
    workspaceId: 0,
  },
];
