import { apps } from "./apps";
import type { TranslationKey } from "./languageStore";
import type { AppId } from "./types";

export const appTitleKeys = Object.fromEntries(apps.map((app) => [app.id, app.titleKey])) as Record<AppId, TranslationKey>;

export const appDescriptionKeys = Object.fromEntries(apps.map((app) => [app.id, app.descriptionKey])) as Record<AppId, TranslationKey>;

export function getAppIcon(appId: AppId, fallback: string) {
  return apps.find((app) => app.id === appId)?.icon ?? fallback;
}
