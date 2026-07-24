import { create } from "zustand";
import { en } from "./i18n/en";
import { zh } from "./i18n/zh";

export type Language = "zh" | "en";
export type TranslationKey = keyof typeof zh;

const LANGUAGE_STORAGE_KEY = "neko-virt-os.language.v1";

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export const useLanguageStore = create<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}>((set, get) => ({
  language: readLanguage(),
  setLanguage: (language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    set({ language });
  },
  t: (key) => (get().language === "zh" ? zh[key] : en[key]),
}));

document.documentElement.lang = readLanguage() === "zh" ? "zh-CN" : "en";
