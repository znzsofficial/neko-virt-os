import { useNotificationStore } from "../notificationStore";
import { useLanguageStore } from "../languageStore";

const PALETTE_COLORS = [
  ["Kernel", "#3467d6"],
  ["Rose", "#d65b8f"],
  ["Mint", "#36a66d"],
  ["Sun", "#d09a27"],
  ["Sky", "#2f88d8"],
  ["Violet", "#8a5bd8"],
  ["Coral", "#d65c45"],
  ["Ink", "#242733"],
] as const;

export function PaletteApp() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const t = useLanguageStore((state) => state.t);

  async function copyColor(color: string) {
    try {
      await navigator.clipboard.writeText(color);
      addNotification({ title: t("copiedToken"), message: `${color}${t("copiedTokenSuffix")}`, type: "success" });
    } catch {
      addNotification({ title: t("copyFailed"), message: t("copyFailedMessage"), type: "error" });
    }
  }

  return (
    <div className="palette-app">
      {PALETTE_COLORS.map(([name, color]) => (
        <button key={color} className="palette-swatch" onClick={() => void copyColor(color)}>
          <span style={{ background: color }} />
          <strong>{name}</strong>
          <small>{color}</small>
        </button>
      ))}
    </div>
  );
}
