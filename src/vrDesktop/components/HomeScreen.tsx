import { useCallback, useEffect, useRef } from "react";
import { useLanguageStore } from "../../languageStore";
import { useOsUiStore } from "../../osUiStore";
import { formatClockTime } from "../../system/systemPrefs";
import { useDesktopStore } from "../../windowStore";
import { VR_PANEL_SIZE } from "../vrLayout";
import { paintHomePanel, type PanelPaintContext } from "../vrPanelTexture";
import { VR_PANEL_BASE } from "../vrQuality";
import { usePanelTexture } from "../usePanelTexture";
import { DraggablePanel } from "./DraggablePanel";
import { TexturedPlane } from "./PanelPrimitives";

function formatDate(date: Date, language: "zh" | "en") {
  return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function HomeScreen({ statusLine }: { statusLine: string | null }) {
  const language = useLanguageStore((state) => state.language);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const windowCount = useDesktopStore((state) => state.windows.length);
  const statusRef = useRef(statusLine);
  statusRef.current = statusLine;
  const windowCountRef = useRef(windowCount);
  windowCountRef.current = windowCount;

  const paint = useCallback(
    (p: PanelPaintContext) => {
      const now = new Date();
      paintHomePanel(p, formatClockTime(now, hour12, true), formatDate(now, language), {
        windowCount: windowCountRef.current,
        language,
        statusLine: statusRef.current,
      });
    },
    [hour12, language],
  );

  const { texture, repaint } = usePanelTexture(
    VR_PANEL_BASE.home.w,
    VR_PANEL_BASE.home.h,
    paint,
    `${hour12}-${language}`,
  );

  useEffect(() => {
    repaint();
  }, [repaint, statusLine, windowCount]);

  useEffect(() => {
    const id = window.setInterval(() => repaint(), 1000);
    return () => window.clearInterval(id);
  }, [repaint]);

  return (
    <DraggablePanel panelId="home" size={VR_PANEL_SIZE.home}>
      <TexturedPlane size={VR_PANEL_SIZE.home} texture={texture} />
    </DraggablePanel>
  );
}
