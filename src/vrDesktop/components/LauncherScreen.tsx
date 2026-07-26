import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { appTitleKeys } from "../../appText";
import { useLanguageStore, type TranslationKey } from "../../languageStore";
import type { AppId } from "../../types";
import { VR_LAUNCHER_PAGES } from "../vrLauncher";
import { VR_PANEL_SIZE } from "../vrLayout";
import { paintLauncherPanel, type LauncherHit, type LauncherPage, type PanelPaintContext } from "../vrPanelTexture";
import { VR_PANEL_BASE } from "../vrQuality";
import { hitTestByUv, usePanelTexture } from "../usePanelTexture";
import { DraggablePanel } from "./DraggablePanel";
import { vrTheme } from "../vrTheme";

export function LauncherScreen({
  onLaunch,
  disabled,
}: {
  onLaunch: (appId: AppId, label: string) => void;
  disabled: boolean;
}) {
  const t = useLanguageStore((state) => state.t);
  const hoverIdRef = useRef<string | null>(null);
  const pageRef = useRef(0);
  const hitsRef = useRef<LauncherHit[]>([]);

  const pages: LauncherPage[] = useMemo(
    () =>
      VR_LAUNCHER_PAGES.map((page) => ({
        id: page.id,
        labelZh: page.labelZh,
        labelEn: page.labelEn,
        items: page.ids.map((id) => ({
          id,
          label: t(appTitleKeys[id] as TranslationKey),
        })),
      })),
    [t],
  );

  const pagesKey = pages.map((p) => `${p.id}:${p.items.map((i) => i.label).join(",")}`).join("|");

  const paint = useCallback(
    (p: PanelPaintContext) => {
      pageRef.current = 0;
      hoverIdRef.current = null;
      hitsRef.current = paintLauncherPanel(p, pages, { hoverId: null, pageIndex: 0 });
    },
    [pages],
  );

  const { texture, width, height, repaint } = usePanelTexture(
    VR_PANEL_BASE.launch.w,
    VR_PANEL_BASE.launch.h,
    paint,
    pagesKey,
  );

  const repaintHover = useCallback(
    (hoverId: string | null, pageIndex = pageRef.current) => {
      pageRef.current = pageIndex;
      repaint((p) => {
        hitsRef.current = paintLauncherPanel(p, pages, { hoverId, pageIndex });
      });
    },
    [pages, repaint],
  );

  function hitTest(uv: THREE.Vector2 | undefined) {
    return hitTestByUv(uv, width, height, hitsRef.current);
  }

  return (
    <DraggablePanel panelId="launch" size={VR_PANEL_SIZE.launch} disabled={disabled}>
      <mesh
        position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}
        onPointerMove={(event) => {
          if (disabled) return;
          const hit = hitTest(event.uv);
          const next = hit?.kind === "app" ? hit.id : hit?.kind === "tab" ? `tab:${hit.page}` : null;
          if (next !== hoverIdRef.current) {
            hoverIdRef.current = next;
            repaintHover(next);
          }
        }}
        onPointerOut={() => {
          if (hoverIdRef.current == null) return;
          hoverIdRef.current = null;
          repaintHover(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          const hit = hitTest(event.uv);
          if (!hit) return;
          if (hit.kind === "tab") {
            if (hit.page !== pageRef.current) {
              hoverIdRef.current = null;
              repaintHover(null, hit.page);
            }
            return;
          }
          onLaunch(hit.id as AppId, hit.label);
        }}
      >
        <planeGeometry args={[VR_PANEL_SIZE.launch.w, VR_PANEL_SIZE.launch.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} fog={false} />
      </mesh>
    </DraggablePanel>
  );
}
