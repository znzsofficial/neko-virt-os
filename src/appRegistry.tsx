import type { ComponentType } from "react";
import { ApiTesterApp } from "./appModules/ApiTesterApp";
import { AboutApp } from "./appModules/AboutApp";
import { BrowserApp } from "./appModules/BrowserApp";
import { CalculatorApp } from "./appModules/CalculatorApp";
import { CalendarApp } from "./appModules/CalendarApp";
import { FilesApp } from "./appModules/FilesApp";
import { MusicPlayerApp } from "./appModules/MusicPlayerApp";
import { NotesApp } from "./appModules/NotesApp";
import { PaletteApp } from "./appModules/PaletteApp";
import { QrToolApp } from "./appModules/QrToolApp";
import { RecorderApp } from "./appModules/RecorderApp";
import { SettingsApp } from "./appModules/SettingsApp";
import { TaskManagerApp } from "./appModules/TaskManagerApp";
import { TerminalApp } from "./appModules/TerminalApp";
import { TasksApp } from "./appModules/TasksApp";
import { TimerApp } from "./appModules/TimerApp";
import { VideoPlayerApp } from "./appModules/VideoPlayerApp";
import type { AppId } from "./types";

export type AppModuleProps = { windowId?: string };

export const appComponentRegistry: Partial<Record<AppId, ComponentType<AppModuleProps>>> = {
  "api-tester": ApiTesterApp,
  about: AboutApp,
  browser: BrowserApp,
  calculator: CalculatorApp,
  calendar: CalendarApp,
  files: FilesApp,
  "qr-tool": QrToolApp,
  recorder: RecorderApp,
  "music-player": MusicPlayerApp,
  notes: NotesApp,
  palette: PaletteApp,
  tasks: TasksApp,
  settings: SettingsApp,
  "task-manager": TaskManagerApp,
  "video-player": VideoPlayerApp,
  terminal: TerminalApp,
  timer: TimerApp,
};
