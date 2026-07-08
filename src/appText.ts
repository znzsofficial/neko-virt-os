import { apps } from "./apps";
import type { TranslationKey } from "./languageStore";
import type { AppId } from "./types";

export const appTitleKeys: Record<AppId, TranslationKey> = {
  files: "appFiles",
  notes: "appNotes",
  browser: "appBrowser",
  calculator: "appCalculator",
  calendar: "appCalendar",
  tasks: "appTasks",
  timer: "appTimer",
  palette: "appPalette",
  settings: "appSettings",
  terminal: "appTerminal",
  "task-manager": "appTaskManager",
  about: "appAbout",
};

export const appDescriptionKeys: Record<AppId, TranslationKey> = {
  files: "descFiles",
  notes: "descNotes",
  browser: "descBrowser",
  calculator: "descCalculator",
  calendar: "descCalendar",
  tasks: "descTasks",
  timer: "descTimer",
  palette: "descPalette",
  settings: "descSettings",
  terminal: "descTerminal",
  "task-manager": "descTaskManager",
  about: "descAbout",
};

export function getAppIcon(appId: AppId, fallback: string) {
  return apps.find((app) => app.id === appId)?.icon ?? fallback;
}
