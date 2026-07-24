import { useCallback, useEffect } from "react";
import { useLanguageStore } from "../../languageStore";
import { readStickyNotes } from "../../shared";
import { VR_PANEL_SIZE } from "../vrLayout";
import { paintStickyPreviewPanel, type PanelPaintContext } from "../vrPanelTexture";
import { VR_PANEL_BASE } from "../vrQuality";
import { usePanelTexture } from "../usePanelTexture";
import { DraggablePanel } from "./DraggablePanel";
import { TexturedPlane } from "./PanelPrimitives";

/** In-VR sticky preview — reads local notes, never opens the 2D Sticky Board. */
export function StickyPreviewScreen() {
  const t = useLanguageStore((state) => state.t);
  const title = t("settingsVrDesktopStickyTitle");
  const empty = t("settingsVrDesktopStickyEmpty");
  const openHint = t("settingsVrDesktopStickyOpen");

  const paint = useCallback(
    (p: PanelPaintContext) => {
      paintStickyPreviewPanel(p, readStickyNotes(), { title, empty, openHint });
    },
    [empty, openHint, title],
  );

  const { texture, repaint } = usePanelTexture(
    VR_PANEL_BASE.sticky.w,
    VR_PANEL_BASE.sticky.h,
    paint,
    `${title}|${empty}|${openHint}`,
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      repaint();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [repaint]);

  return (
    <DraggablePanel panelId="sticky" size={VR_PANEL_SIZE.sticky}>
      <TexturedPlane size={VR_PANEL_SIZE.sticky} texture={texture} />
    </DraggablePanel>
  );
}
