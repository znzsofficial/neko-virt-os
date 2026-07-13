import type { TranslationKey } from "../languageStore";

export function phrase(
  t: (key: TranslationKey) => string,
  prefix: TranslationKey,
  value: string | number,
  suffix: TranslationKey,
) {
  return `${t(prefix)}${value}${t(suffix)}`;
}
