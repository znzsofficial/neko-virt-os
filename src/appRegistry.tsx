import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AppId } from "./types";

export type AppModuleProps = { windowId?: string };

type AppModuleComponent = ComponentType<AppModuleProps> | LazyExoticComponent<ComponentType<AppModuleProps>>;

function lazyApp(loader: () => Promise<{ default: ComponentType<AppModuleProps> }>) {
  return lazy(loader);
}

export const appComponentRegistry: Partial<Record<AppId, AppModuleComponent>> = {
  "api-tester": lazyApp(() => import("./appModules/ApiTesterApp").then((module) => ({ default: module.ApiTesterApp }))),
  about: lazyApp(() => import("./appModules/AboutApp").then((module) => ({ default: module.AboutApp }))),
  browser: lazyApp(() => import("./appModules/BrowserApp").then((module) => ({ default: module.BrowserApp }))),
  calculator: lazyApp(() => import("./appModules/CalculatorApp").then((module) => ({ default: module.CalculatorApp }))),
  calendar: lazyApp(() => import("./appModules/CalendarApp").then((module) => ({ default: module.CalendarApp }))),
  clipboard: lazyApp(() => import("./appModules/ClipboardApp").then((module) => ({ default: module.ClipboardApp }))),
  downloads: lazyApp(() => import("./appModules/DownloadsApp").then((module) => ({ default: module.DownloadsApp }))),
  files: lazyApp(() => import("./appModules/FilesApp").then((module) => ({ default: module.FilesApp }))),
  "qr-tool": lazyApp(() => import("./appModules/QrToolApp").then((module) => ({ default: module.QrToolApp }))),
  recorder: lazyApp(() => import("./appModules/RecorderApp").then((module) => ({ default: module.RecorderApp }))),
  "music-player": lazyApp(() => import("./appModules/MusicPlayerApp").then((module) => ({ default: module.MusicPlayerApp }))),
  "mmd-studio": lazyApp(() => import("./appModules/mmdStudio/MmdStudioApp").then((module) => ({ default: module.MmdStudioApp }))),
  notes: lazyApp(() => import("./appModules/NotesApp").then((module) => ({ default: module.NotesApp }))),
  palette: lazyApp(() => import("./appModules/PaletteApp").then((module) => ({ default: module.PaletteApp }))),
  tasks: lazyApp(() => import("./appModules/TasksApp").then((module) => ({ default: module.TasksApp }))),
  settings: lazyApp(() => import("./appModules/SettingsApp").then((module) => ({ default: module.SettingsApp }))),
  "task-manager": lazyApp(() => import("./appModules/TaskManagerApp").then((module) => ({ default: module.TaskManagerApp }))),
  trash: lazyApp(() => import("./appModules/TrashApp").then((module) => ({ default: module.TrashApp }))),
  "video-player": lazyApp(() => import("./appModules/VideoPlayerApp").then((module) => ({ default: module.VideoPlayerApp }))),
  terminal: lazyApp(() => import("./appModules/TerminalApp").then((module) => ({ default: module.TerminalApp }))),
  timer: lazyApp(() => import("./appModules/TimerApp").then((module) => ({ default: module.TimerApp }))),
  "sticky-board": lazyApp(() => import("./appModules/StickyBoardApp").then((module) => ({ default: module.StickyBoardApp }))),
};
