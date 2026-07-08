import type { TranslationKey } from "./languageStore";

export type AppDefinition = {
  id: string;
  title: string;
  titleKey: TranslationKey;
  icon: string;
  description: string;
  descriptionKey: TranslationKey;
  defaultSize: { width: number; height: number };
  multiInstance?: boolean;
};
