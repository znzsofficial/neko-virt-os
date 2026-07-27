import type { Language } from "../languageStore";

const NOTO_FONT_CLASS = "font-noto-sans-sc";
let notoFontPromise: Promise<void> | undefined;

function loadNotoSansSc() {
  notoFontPromise ??= import("@fontsource-variable/noto-sans-sc/wght.css").then(async () => {
    await document.fonts.load('400 1em "Noto Sans SC Variable"', "中文");
  });
  return notoFontPromise;
}

export function syncDeferredUiFont(language: Language) {
  document.documentElement.classList.toggle(NOTO_FONT_CLASS, false);
  if (language !== "zh") return;

  const load = () => {
    void loadNotoSansSc()
      .then(() => {
        if (document.documentElement.lang === "zh-CN") {
          document.documentElement.classList.add(NOTO_FONT_CLASS);
        }
      })
      .catch(() => undefined);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load, { timeout: 2000 });
  } else {
    setTimeout(load, 0);
  }
}
