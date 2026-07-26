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
  const pixelWidth = scalePanelSize(baseW, panelScale);
  const pixelHeight = scalePanelSize(baseH, panelScale);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const texture = useMemo(() => {
    const map = createPanelTexture(
      pixelWidth,
      pixelHeight,
      ({ ctx }) => {
        ctx.setTransform(pixelWidth / baseW, 0, 0, pixelHeight / baseH, 0, 0);
        paintRef.current({ ctx, width: baseW, height: baseH, language });
      },
      language,
    );
    canvasRef.current = map.image as HTMLCanvasElement;
    return map;
    // rebuildKey forces remount when content catalog changes
  }, [baseH, baseW, language, pixelHeight, pixelWidth, rebuildKey]);

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
      ctx.setTransform(pixelWidth / baseW, 0, 0, pixelHeight / baseH, 0, 0);
      fn({ ctx, width: baseW, height: baseH, language });
      texture.needsUpdate = true;
    },
    [baseH, baseW, language, pixelHeight, pixelWidth, texture],
  );

  return { texture, width: baseW, height: baseH, language, canvasRef, repaint };
}
