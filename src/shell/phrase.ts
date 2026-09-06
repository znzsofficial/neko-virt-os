import type { TranslationKey } from "../languageStore";

export function phrase(
  t: (key: TranslationKey) => string,
  prefix: TranslationKey,
  value: string | number,
  suffix: TranslationKey,
) {
  return `${t(prefix)}${value}${t(suffix)}`;
}

export function pluralize(
  t: (key: TranslationKey) => string,
  count: number,
  one: TranslationKey,
  other: TranslationKey,
) {
  return count === 1 ? t(one) : t(other);
}
