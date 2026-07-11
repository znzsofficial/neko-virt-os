import type { FsFile } from "./virtualFs";
import type { AppId } from "./apps";

export type { AppId } from "./apps";

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

export type DesktopLayoutMode = "grid" | "free";

export type DesktopStore = {
  windows: WindowState[];
  activeWindowId: string | null;
  launcherOpen: boolean;
  desktopLayoutMode: DesktopLayoutMode;
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
  setDesktopLayoutMode: (mode: DesktopLayoutMode) => void;
  resetWindowLayout: () => void;
  toggleLauncher: () => void;
  closeLauncher: () => void;
};

export type FileMutationErrorCode =
  | "empty_name"
  | "invalid_characters"
  | "duplicate_name"
  | "not_found"
  | "move_into_self"
  | "move_into_descendant"
  | "invalid_target_path";

export type FileMutationResult = {
  file: FsFile | null;
  error?: FileMutationErrorCode;
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
  createNamedFile: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  createFolder: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  deleteSelectedFile: () => Promise<void>;
  deleteFileByName: (name: string) => Promise<FsFile | null>;
  deleteFileById: (id: string) => Promise<FsFile | null>;
  restoreSelectedFile: () => Promise<void>;
  restoreFileById: (id: string) => Promise<void>;
  permanentlyDeleteSelectedFile: () => Promise<void>;
  permanentlyDeleteFileById: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  resetVirtualFiles: () => Promise<void>;
  renameSelectedFile: (name: string) => Promise<FileMutationResult>;
  renameFileByName: (fromName: string, toName: string) => Promise<FileMutationResult>;
  renameFileById: (id: string, name: string) => Promise<FileMutationResult>;
  moveFileById: (id: string, parentId: string | null) => Promise<FileMutationResult>;
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
  createdAt?: number;
  progress?: number;
};

export type WallpaperId =
  | "system"
  | "alpine-lake"
  | "star-field"
  | "pacific"
  | "green-meadow"
  | "forest"
  | "cabin"
  | "desert-dunes"
  | "aurora-sky"
  | "snow-peak"
  | "city-lights"
  | "sunset-coast"
  | "misty-forest"
  | "granite-lake"
  | "glass-towers"
  | "neon-street";

export type ThemeSettings = {
  accentColor: "blue" | "purple" | "emerald" | "amber";
  density: "compact" | "cozy";
  theme: "system" | "light" | "dark";
  wallpaperId: WallpaperId;
  wallpaperLightId: WallpaperId;
  wallpaperDarkId: WallpaperId;
  wallpaperFit: "cover" | "contain" | "stretch" | "tile";
  wallpaperOverlay: "off" | "soft" | "standard";
};

export type FileSortMode = "updated" | "name" | "size";
