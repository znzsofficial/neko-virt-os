import type { TranslationKey } from "../../languageStore";
import type { SettingsSection } from "./settingsNavigation";

export type SettingsSearchEntry = readonly [SettingsSection, TranslationKey];

export function filterSettingsSearch(
  entries: readonly SettingsSearchEntry[],
  query: string,
  translate: (key: TranslationKey) => string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [] as SettingsSearchEntry[];
  return entries
    .filter(([, key]) => translate(key).toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 8);
}
