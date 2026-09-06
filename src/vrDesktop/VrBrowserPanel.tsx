import { Html } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLanguageStore } from "../languageStore";
import { DraggablePanel } from "./components/DraggablePanel";
import { hitTestByUv } from "./usePanelTexture";
import {
  isVrBrowserHome,
  normalizeVrBrowserUrl,
  shortVrBrowserHost,
  VR_BROWSER_BOOKMARKS,
  VR_BROWSER_HOME,
} from "./vrBrowser";
import { VR_PANEL_SIZE } from "./vrLayout";
import {
  createPanelTexture,
  paintVrBrowserChrome,
  type VrBrowserChromeHit,
} from "./vrPanelTexture";
import { getVrRenderProfile, scalePanelSize } from "./vrQuality";
import { useVrDesktopStore } from "./vrDesktopStore";
import { vrTheme } from "./vrTheme";

const BROWSER_PANEL = VR_PANEL_SIZE.browser;
/** CSS pixel size for Html iframe (mapped to panel meters via scale). */
const IFRAME_CSS = { w: 1024, h: 640 };
const CHROME_BASE = { w: 1200, h: 780 };
/**
 * Soft "still loading" hint only — never auto-claim "blocked".
 * XR iframe onLoad is unreliable; 2D uses a similar slow flag but still shows the frame.
 */
const IFRAME_SLOW_MS = 8000;

type LoadState = "idle" | "loading" | "loaded" | "slow";

type Props = {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
  initialUrl?: string | null;
};

/**
 * In-VR browser: canvas chrome (XR ray) + Html iframe for page body.
 * Many sites block embedding via CSP/XFO; chrome still works for bookmarks / 外开.
 * Match 2D BrowserApp iframe attributes as closely as possible.
 */
export function VrBrowserPanel({ open, onClose, disabled, initialUrl }: Props) {
  const language = useLanguageStore((s) => s.language);
  const panelScale = useVrDesktopStore((s) => getVrRenderProfile(s.prefs).panelScale);
  const chromeW = scalePanelSize(CHROME_BASE.w, panelScale);
  const chromeH = scalePanelSize(CHROME_BASE.h, panelScale);
  const chromeScaleX = chromeW / CHROME_BASE.w;
  const chromeScaleY = chromeH / CHROME_BASE.h;

  const [history, setHistory] = useState<string[]>([VR_BROWSER_HOME]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [iframeEpoch, setIframeEpoch] = useState(0);
  const hitsRef = useRef<VrBrowserChromeHit[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const historyIndexRef = useRef(0);
  const loadStateRef = useRef<LoadState>("idle");
  historyIndexRef.current = historyIndex;
  loadStateRef.current = loadState;

  const url = history[historyIndex] ?? VR_BROWSER_HOME;
  const isHome = isVrBrowserHome(url);
  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;
  const browsing = open && !isHome;

  const bookmarks = useMemo(
    () =>
      VR_BROWSER_BOOKMARKS.map((b) => ({
        title: language === "zh" ? b.titleZh : b.titleEn,
        url: b.url,
      })),
    [language],
  );

  useEffect(() => {
    if (!open) return;
    const next = initialUrl ? normalizeVrBrowserUrl(initialUrl) : VR_BROWSER_HOME;
    setHistory([next]);
    setHistoryIndex(0);
    setLoadState(isVrBrowserHome(next) ? "idle" : "loading");
    setIframeEpoch((n) => n + 1);
  }, [open, initialUrl]);

  // Soft slow hint only if still loading (do not set "blocked").
  useEffect(() => {
    if (!browsing) {
      if (isHome) setLoadState("idle");
      return;
    }
    setLoadState("loading");
    const timer = window.setTimeout(() => {
      if (loadStateRef.current === "loading") setLoadState("slow");
    }, IFRAME_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [browsing, isHome, url, iframeEpoch]);

  const status = useMemo(() => {
    if (isHome) {
      return language === "zh" ? "点上方书签开始浏览" : "Tap a bookmark to browse";
    }
    if (loadState === "loading") {
      return language === "zh" ? "加载中…" : "Loading…";
    }
    if (loadState === "slow") {
      return language === "zh"
        ? "仍在加载 · 若空白可点「外开」"
        : "Still loading · try Ext if blank";
    }
    return null;
  }, [isHome, language, loadState]);

  const paintState = useMemo(
    () => ({
      url: shortVrBrowserHost(url, language),
      canBack,
      canForward,
      bookmarks,
      status,
      cutoutContent: browsing,
    }),
    [bookmarks, browsing, canBack, canForward, language, status, url],
  );

  const texture = useMemo(() => {
    let hits: VrBrowserChromeHit[] = [];
    const map = createPanelTexture(
      chromeW,
      chromeH,
      (p) => {
        p.ctx.setTransform(chromeScaleX, 0, 0, chromeScaleY, 0, 0);
        hits = paintVrBrowserChrome({ ...p, width: CHROME_BASE.w, height: CHROME_BASE.h }, { ...paintState, hoverId: hoverIdRef.current });
      },
      language,
    );
    hitsRef.current = hits;
    canvasRef.current = map.image as HTMLCanvasElement;
    return map;
    // paintState identity changes with nav/status; size/language rebuild canvas
  }, [chromeH, chromeScaleX, chromeScaleY, chromeW, language, paintState]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(chromeScaleX, 0, 0, chromeScaleY, 0, 0);
    hitsRef.current = paintVrBrowserChrome(
      { ctx, width: CHROME_BASE.w, height: CHROME_BASE.h, language },
      { ...paintState, hoverId: hoverIdRef.current },
    );
    texture.needsUpdate = true;
  }, [chromeScaleX, chromeScaleY, language, paintState, texture]);

  const repaintHover = useCallback((hoverId: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    hoverIdRef.current = hoverId;
    ctx.setTransform(chromeScaleX, 0, 0, chromeScaleY, 0, 0);
    hitsRef.current = paintVrBrowserChrome(
      { ctx, width: CHROME_BASE.w, height: CHROME_BASE.h, language },
      { ...paintState, hoverId },
    );
    texture.needsUpdate = true;
  }, [chromeScaleX, chromeScaleY, language, paintState, texture]);

  useEffect(() => {
    repaint();
  }, [repaint]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  function navigate(nextUrl: string) {
    const normalized = normalizeVrBrowserUrl(nextUrl);
    setLoadState(isVrBrowserHome(normalized) ? "idle" : "loading");
    setHistory((prev) => {
      const idx = historyIndexRef.current;
      const base = prev.slice(0, idx + 1);
      if (base[base.length - 1] === normalized) return prev;
      const next = [...base, normalized];
      historyIndexRef.current = next.length - 1;
      setHistoryIndex(next.length - 1);
      return next;
    });
    setIframeEpoch((n) => n + 1);
  }

  function goBack() {
    if (!canBack) return;
    setLoadState("loading");
    setHistoryIndex((i) => {
      const next = Math.max(0, i - 1);
      historyIndexRef.current = next;
      return next;
    });
    setIframeEpoch((n) => n + 1);
  }

  function goForward() {
    if (!canForward) return;
    setLoadState("loading");
    setHistoryIndex((i) => {
      const next = Math.min(history.length - 1, i + 1);
      historyIndexRef.current = next;
      return next;
    });
    setIframeEpoch((n) => n + 1);
  }

  function openExternal() {
    if (isHome) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  }

  function hitTest(uv: THREE.Vector2 | undefined): VrBrowserChromeHit | undefined {
    return hitTestByUv(uv, CHROME_BASE.w, CHROME_BASE.h, hitsRef.current);
  }

  function getHoverId(hit: VrBrowserChromeHit | undefined) {
    if (!hit) return null;
    return hit.kind === "bookmark" ? `bookmark:${hit.url}` : `nav:${hit.action}`;
  }

  function onChromeActivate(uv: THREE.Vector2 | undefined) {
    if (disabled) return;
    const hit = hitTest(uv);
    if (!hit) return;
    if (hit.kind === "bookmark") {
      navigate(hit.url);
      return;
    }
    switch (hit.action) {
      case "back":
        goBack();
        break;
      case "forward":
        goForward();
        break;
      case "home":
        navigate(VR_BROWSER_HOME);
        break;
      case "reload":
        setLoadState("loading");
        setIframeEpoch((n) => n + 1);
        break;
      case "external":
        openExternal();
        break;
      case "close":
        onClose();
        break;
    }
  }

  function onIframeLoad() {
    setLoadState("loaded");
  }

  if (!open) return null;

  // Content region in panel local meters (below chrome/bookmarks strip).
  const contentW = BROWSER_PANEL.w * 0.94;
  const contentH = BROWSER_PANEL.h * 0.62;
  const contentY = -BROWSER_PANEL.h * 0.14;
  const contentZ = vrTheme.panelDepth / 2 + 0.04;
  const htmlScale = contentW / IFRAME_CSS.w;

  return (
    <DraggablePanel panelId="browser" size={BROWSER_PANEL} disabled={disabled}>
      {/* Chrome + hits. Transparent material so cutout shows iframe, not opaque black. */}
      <mesh
        position={[0, 0, vrTheme.panelDepth / 2 + 0.001]}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => {
          const hoverId = getHoverId(hitTest(event.uv));
          if (hoverId !== hoverIdRef.current) repaintHover(hoverId);
        }}
        onPointerOut={() => {
          if (hoverIdRef.current != null) repaintHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Use one activation event so controller clicks cannot navigate twice.
          onChromeActivate(e.uv);
        }}
      >
        <planeGeometry args={[BROWSER_PANEL.w, BROWSER_PANEL.h]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={THREE.FrontSide}
          fog={false}
          transparent
          depthWrite={false}
        />
      </mesh>

      {browsing ? (
        <Html
          key={`${url}:${iframeEpoch}`}
          transform
          occlude={false}
          sprite={false}
          position={[0, contentY, contentZ]}
          scale={htmlScale}
          center
          style={{
            width: `${IFRAME_CSS.w}px`,
            height: `${IFRAME_CSS.h}px`,
            pointerEvents: "auto",
            borderRadius: "10px",
            overflow: "hidden",
            background: "#0e1118",
            border: "1px solid #2f3a4d",
          }}
          zIndexRange={[100, 0]}
        >
          <iframe
            title="VR Browser"
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            referrerPolicy="no-referrer-when-downgrade"
            // Match 2D BrowserApp as closely as possible.
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#0e1118",
              display: "block",
            }}
            onLoad={onIframeLoad}
          />
        </Html>
      ) : null}
    </DraggablePanel>
  );
}
