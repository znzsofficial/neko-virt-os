import type { FsFile } from "./virtualFs";

export type AppId = "files" | "notes" | "settings" | "terminal" | "about" | "task-manager" | "browser" | "calculator" | "calendar";

export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowState = WindowBounds & {
  id: string;
  appId: AppId;
  title: string;
  icon: string;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restoreBounds?: WindowBounds;
};

export type AppDefinition = {
  id: AppId;
  title: string;
  icon: string;
  description: string;
  defaultSize: { width: number; height: number };
  multiInstance?: boolean;
};

export type DesktopStore = {
  windows: WindowState[];
  activeWindowId: string | null;
  launcherOpen: boolean;
  desktopIconPositions: Record<string, { x: number; y: number }>;
  openApp: (appId: AppId) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleTaskbarWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  togglePinnedWindowZ: (id: string) => void;
  snapWindow: (id: string, side: "left" | "right") => void;
  cascadeWindows: () => void;
  tileWindows: () => void;
  updateWindow: (id: string, patch: Partial<WindowState>) => void;
  updateDesktopIconPosition: (id: string, x: number, y: number) => void;
  resetWindowLayout: () => void;
  toggleLauncher: () => void;
  closeLauncher: () => void;
};

export type FileMutationResult = {
  file: FsFile | null;
  error?: string;
};

export type FsStore = {
  files: FsFile[];
  selectedFileId: string | null;
  draft: string;
  loaded: boolean;
  dirty: boolean;
  init: () => Promise<void>;
  selectFile: (id: string) => void;
  setDraft: (draft: string) => void;
  createFile: () => Promise<void>;
  createNamedFile: (name: string) => Promise<FileMutationResult>;
  deleteSelectedFile: () => Promise<void>;
  deleteFileByName: (name: string) => Promise<FsFile | null>;
  restoreSelectedFile: () => Promise<void>;
  restoreFileById: (id: string) => Promise<void>;
  permanentlyDeleteSelectedFile: () => Promise<void>;
  permanentlyDeleteFileById: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  resetVirtualFiles: () => Promise<void>;
  renameSelectedFile: (name: string) => Promise<FileMutationResult>;
  renameFileByName: (fromName: string, toName: string) => Promise<FileMutationResult>;
  selectFileByName: (name: string) => FsFile | null;
  saveDraft: () => Promise<void>;
  saveFileDraft: (id: string, draft: string) => Promise<void>;
};

export type ContextMenuState = {
  x: number;
  y: number;
  kind: "desktop" | "desktop-app" | "file" | "window" | "taskbar-window" | "files-empty";
  id?: string;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
};

export type ThemeSettings = {
  accentColor: "blue" | "purple" | "emerald" | "amber";
  density: "compact" | "cozy";
  theme: "light" | "dark";
};

export type FileSortMode = "updated" | "name" | "size";
