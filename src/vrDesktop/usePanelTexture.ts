import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPanelTexture, type PanelPaintContext } from "../shared/panelTexture";
import { useLanguageStore } from "../languageStore";
import { getVrRenderProfile, scalePanelSize } from "./vrQuality";
import { useVrDesktopStore } from "./vrDesktopStore";

export { hitTestByUv } from "../shared/panelTexture";

type PaintFn = (p: PanelPaintContext) => void;

/**
 * Quality-scaled canvas texture with dispose + repaint helper.
 * Recreates when size / language / qualityScaleKey changes.
 */
export function usePanelTexture(
  baseW: number,
  baseH: number,
  paint: PaintFn,
  /** Extra key — change when paint output identity must rebuild (e.g. pages list). */
  rebuildKey: string | number = "",
) {
  const language = useLanguageStore((s) => s.language);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs).panelScale);
  const width = scalePanelSize(baseW, panelScale);
  const height = scalePanelSize(baseH, panelScale);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const texture = useMemo(() => {
    const map = createPanelTexture(
      width,
      height,
      (p) => paintRef.current(p),
      language,
    );
    canvasRef.current = map.image as HTMLCanvasElement;
    return map;
    // rebuildKey forces remount when content catalog changes
  }, [height, language, rebuildKey, width]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  const repaint = useCallback(
    (nextPaint?: PaintFn) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const fn = nextPaint ?? paintRef.current;
      fn({ ctx, width, height, language });
      texture.needsUpdate = true;
    },
    [height, language, texture, width],
  );

  return { texture, width, height, language, canvasRef, repaint };
}
