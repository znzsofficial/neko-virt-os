import { useEffect, useMemo, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { useNotificationStore } from "../notificationStore";

const BUILTIN = [
  ["Kernel", "#3467d6"],
  ["Rose", "#d65b8f"],
  ["Mint", "#36a66d"],
  ["Sun", "#d09a27"],
  ["Sky", "#2f88d8"],
  ["Violet", "#8a5bd8"],
  ["Coral", "#d65c45"],
  ["Ink", "#242733"],
] as const;

const CUSTOM_KEY = "neko-virt-os.palette-custom.v1";

function readCustom(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = [r, g, b].map((value) => {
    const next = value / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

function contrastRatio(a: string, b: string) {
  const l1 = relativeLuminance(hexToRgb(a));
  const l2 = relativeLuminance(hexToRgb(b));
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

export function PaletteApp() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);
  const [custom, setCustom] = useState<string[]>(readCustom);
  const [picker, setPicker] = useState("#5b7cfa");
  const [contrastFg, setContrastFg] = useState("#ffffff");
  const [contrastBg, setContrastBg] = useState("#242733");

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  }, [custom]);

  const rgb = useMemo(() => hexToRgb(picker), [picker]);
  const contrast = useMemo(() => contrastRatio(contrastFg, contrastBg), [contrastFg, contrastBg]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      addNotification({ title: t("copiedToken"), message: `${value}${t("copiedTokenSuffix")}`, type: "success", category: "apps", appId: "palette" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error", category: "apps", appId: "palette" });
    }
  }

  function saveCustom() {
    const next = picker.toLowerCase();
    if (custom.some((color) => color.toLowerCase() === next)) return;
    setCustom((current) => [next, ...current].slice(0, 16));
  }

  function exportCss() {
    const lines = [
      ...BUILTIN.map(([name, color], index) => `  --palette-${name.toLowerCase()}: ${color};`),
      ...custom.map((color, index) => `  --palette-custom-${index + 1}: ${color};`),
    ];
    void copyText(`:root {\n${lines.join("\n")}\n}`);
  }

  return (
    <div className="palette-app">
      <section className="palette-picker-panel">
        <div className="palette-picker-row">
          <input type="color" value={picker} onChange={(event) => setPicker(event.target.value)} aria-label={t("palettePicker")} />
          <div>
            <strong>{picker.toUpperCase()}</strong>
            <small>rgb({rgb.r}, {rgb.g}, {rgb.b})</small>
          </div>
        </div>
        <div className="palette-actions">
          <button type="button" className="button-primary" onClick={() => void copyText(picker.toUpperCase())}>{t("copyColor")}</button>
          <button type="button" className="button-ghost" onClick={() => void copyText(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}>{t("paletteCopyRgb")}</button>
          <button type="button" className="button-ghost" onClick={saveCustom}>{t("paletteSave")}</button>
          <button type="button" className="button-ghost" onClick={exportCss}>{t("paletteExportCss")}</button>
        </div>
      </section>

      <section className="palette-contrast-panel">
        <h3>{t("paletteContrast")}</h3>
        <div className="palette-contrast-inputs">
          <label>
            <span>{t("paletteForeground")}</span>
            <input type="color" value={contrastFg} onChange={(event) => setContrastFg(event.target.value)} />
          </label>
          <label>
            <span>{t("paletteBackground")}</span>
            <input type="color" value={contrastBg} onChange={(event) => setContrastBg(event.target.value)} />
          </label>
        </div>
        <div className="palette-contrast-preview" style={{ background: contrastBg, color: contrastFg }}>
          <strong>{contrast.toFixed(2)}:1</strong>
          <span>{contrast >= 4.5 ? t("paletteContrastPass") : t("paletteContrastFail")}</span>
        </div>
      </section>

      <div className="palette-swatch-grid">
        {BUILTIN.map(([name, color]) => (
          <button key={color} type="button" className="palette-swatch" onClick={() => void copyText(color)}>
            <span style={{ background: color }} />
            <strong>{name}</strong>
            <small>{color}</small>
          </button>
        ))}
        {custom.map((color) => (
          <div key={color} className="palette-swatch is-custom">
            <button type="button" className="palette-swatch-main" onClick={() => void copyText(color)}>
              <span style={{ background: color }} />
              <strong>{t("paletteCustom")}</strong>
              <small>{color}</small>
            </button>
            <button
              type="button"
              className="palette-remove"
              onClick={() => setCustom((current) => current.filter((item) => item !== color))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
