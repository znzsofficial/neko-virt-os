import {
  createPanelTexture,
  paintFpsBadge,
  paintSecondaryButton,
  roundRectPath,
  type PanelPaintContext,
} from "../shared/panelTexture";
import { getVrAppTint, vrTheme } from "./vrTheme";

export type { PanelPaintContext };
export { createPanelTexture, paintFpsBadge, paintSecondaryButton, roundRectPath };

export function fillPanelBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = vrTheme.bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.4);
  g.addColorStop(0, "rgba(255,255,255,0.03)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.4);
}

function paintPill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, font: string) {
  ctx.font = font;
  const padX = 16;
  const tw = ctx.measureText(text).width;
  const ph = 34;
  const pw = tw + padX * 2;
  roundRectPath(ctx, x, y, pw, ph, ph / 2);
  ctx.fillStyle = vrTheme.pillBg;
  ctx.fill();
  ctx.strokeStyle = vrTheme.pillBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = vrTheme.muted;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + ph / 2 + 0.5);
  ctx.textBaseline = "alphabetic";
}

export function paintHomePanel(
  p: PanelPaintContext,
  clock: string,
  dateLine: string,
  meta?: {
    windowCount?: number;
    language?: "zh" | "en";
    statusLine?: string | null;
  },
) {
  const { ctx, width, height, language } = p;
  const lang = meta?.language ?? language;
  const hasStatus = Boolean(meta?.statusLine);
  fillPanelBg(ctx, width, height);

  ctx.fillStyle = vrTheme.subtle;
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NekoVirtOS", 48, 48);
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("VR", width - 48, 48);
  ctx.textAlign = "left";

  ctx.strokeStyle = vrTheme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 68);
  ctx.lineTo(width - 48, 68);
  ctx.stroke();

  const clockY = Math.floor(height * (hasStatus ? 0.42 : 0.48));
  ctx.fillStyle = vrTheme.ink;
  ctx.font = "600 108px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(clock, width / 2, clockY);

  ctx.fillStyle = vrTheme.muted;
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(dateLine, width / 2, clockY + 48);
  ctx.textAlign = "left";

  if (meta?.windowCount != null && !hasStatus) {
    const n = meta.windowCount;
    const pill =
      lang === "zh" ? (n === 1 ? "1 个窗口" : `${n} 个窗口`) : n === 1 ? "1 Window" : `${n} Windows`;
    ctx.font = "500 20px system-ui, sans-serif";
    const tw = ctx.measureText(pill).width;
    const pw = tw + 32;
    paintPill(ctx, (width - pw) / 2, Math.floor(height * 0.78), pill, "500 20px system-ui, sans-serif");
  }

  if (meta?.statusLine) {
    const y = Math.floor(height * 0.84);
    roundRectPath(ctx, 48, y - 26, width - 96, 44, 12);
    ctx.fillStyle = vrTheme.primarySoft;
    ctx.fill();
    ctx.fillStyle = vrTheme.ink;
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let line = meta.statusLine;
    const maxW = width - 120;
    if (ctx.measureText(line).width > maxW) {
      while (line.length > 4 && ctx.measureText(`${line}…`).width > maxW) line = line.slice(0, -1);
      line = `${line}…`;
    }
    ctx.fillText(line, width / 2, y - 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

export type LauncherHit =
  | { kind: "app"; id: string; label: string; rect: { x: number; y: number; w: number; h: number } }
  | { kind: "tab"; page: number; rect: { x: number; y: number; w: number; h: number } };

export type LauncherPage = {
  id: string;
  labelZh: string;
  labelEn: string;
  items: { id: string; label: string }[];
};

export function paintLauncherPanel(
  p: PanelPaintContext,
  pages: LauncherPage[],
  opts?: { hoverId?: string | null; pageIndex?: number },
): LauncherHit[] {
  const { ctx, width, height, language } = p;
  const hoverId = opts?.hoverId ?? null;
  const pageIndex = Math.min(Math.max(opts?.pageIndex ?? 0, 0), Math.max(pages.length - 1, 0));
  const page = pages[pageIndex];
  const items = page?.items ?? [];
  const hits: LauncherHit[] = [];

  fillPanelBg(ctx, width, height);

  // Title
  ctx.fillStyle = vrTheme.ink;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(language === "zh" ? "应用" : "Apps", 40, 42);

  // Tabs
  const tabY = 58;
  const tabH = 40;
  let tabX = 40;
  pages.forEach((pg, i) => {
    const label = language === "zh" ? pg.labelZh : pg.labelEn;
    ctx.font = "600 20px system-ui, sans-serif";
    const tw = ctx.measureText(label).width;
    const tabW = Math.max(88, tw + 36);
    const active = i === pageIndex;

    roundRectPath(ctx, tabX, tabY, tabW, tabH, 10);
    if (active) {
      ctx.fillStyle = vrTheme.panelHover;
      ctx.fill();
      ctx.strokeStyle = vrTheme.primary;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = vrTheme.ink;
    } else {
      ctx.fillStyle = "transparent";
      ctx.fill();
      ctx.fillStyle = vrTheme.muted;
    }
    ctx.textBaseline = "middle";
    ctx.fillText(label, tabX + (tabW - tw) / 2, tabY + tabH / 2 + 0.5);
    ctx.textBaseline = "alphabetic";

    hits.push({ kind: "tab", page: i, rect: { x: tabX, y: tabY, w: tabW, h: tabH } });
    tabX += tabW + 10;
  });

  // Divider under tabs
  ctx.strokeStyle = vrTheme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, tabY + tabH + 12);
  ctx.lineTo(width - 40, tabY + tabH + 12);
  ctx.stroke();

  const cols = 3;
  const padX = 32;
  const padTop = tabY + tabH + 28;
  const gap = vrTheme.gap;
  const cellW = (width - padX * 2 - gap * (cols - 1)) / cols;
  const cellH = Math.max(vrTheme.cellMinH, 84);

  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padX + col * (cellW + gap);
    const y = padTop + row * (cellH + gap);
    if (y + cellH > height - 24) return;

    const tint = getVrAppTint(item.id);
    const hovered = hoverId === item.id;

    roundRectPath(ctx, x, y, cellW, cellH, vrTheme.radius);
    ctx.fillStyle = hovered ? vrTheme.panelHover : vrTheme.panel;
    ctx.fill();
    ctx.strokeStyle = hovered ? vrTheme.primary : vrTheme.border;
    ctx.lineWidth = hovered ? 1.5 : 1;
    ctx.stroke();

    const cy = y + cellH / 2;
    ctx.beginPath();
    ctx.arc(x + 28, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = tint;
    ctx.fill();

    ctx.fillStyle = vrTheme.ink;
    ctx.font = "500 21px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const maxChars = 8;
    const label = item.label.length > maxChars ? `${item.label.slice(0, maxChars - 1)}…` : item.label;
    ctx.fillText(label, x + 44, cy + 0.5);
    ctx.textBaseline = "alphabetic";

    hits.push({ kind: "app", id: item.id, label: item.label, rect: { x, y, w: cellW, h: cellH } });
  });

  // Empty page hint
  if (items.length === 0) {
    ctx.fillStyle = vrTheme.subtle;
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(language === "zh" ? "暂无应用" : "No apps", width / 2, padTop + 80);
    ctx.textAlign = "left";
  }

  return hits;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest && lines.length < maxLines) {
    if (ctx.measureText(rest).width <= maxW) {
      lines.push(rest);
      rest = "";
      break;
    }
    let lo = 1;
    let hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(rest.slice(0, mid)).width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    let take = Math.max(1, lo);
    // Prefer break at space when not the last line
    if (lines.length < maxLines - 1) {
      const space = rest.lastIndexOf(" ", take);
      if (space > take * 0.5) take = space;
    }
    let chunk = rest.slice(0, take).trimEnd();
    rest = rest.slice(take).trimStart();
    if (lines.length === maxLines - 1 && rest) {
      while (chunk.length > 1 && ctx.measureText(`${chunk}…`).width > maxW) {
        chunk = chunk.slice(0, -1);
      }
      chunk = `${chunk}…`;
      rest = "";
    }
    lines.push(chunk);
  }
  return lines;
}

export type VrBrowserChromeHit =
  | {
      kind: "nav";
      action: "back" | "forward" | "home" | "close" | "reload" | "external";
      rect: { x: number; y: number; w: number; h: number };
    }
  | { kind: "bookmark"; url: string; rect: { x: number; y: number; w: number; h: number } };

/**
 * Browser chrome for XR ray hits.
 * When `cutoutContent` is true (page open), only paint the top bar + bookmarks so the
 * Html iframe is not covered by an opaque WebGL plane.
 */
export function paintVrBrowserChrome(
  p: PanelPaintContext,
  state: {
    url: string;
    canBack: boolean;
    canForward: boolean;
    bookmarks: { title: string; url: string }[];
    status?: string | null;
    /** Leave page area transparent for Html iframe. */
    cutoutContent?: boolean;
  },
): VrBrowserChromeHit[] {
  const { ctx, width, height, language } = p;
  const hits: VrBrowserChromeHit[] = [];
  const cutout = Boolean(state.cutoutContent);

  ctx.clearRect(0, 0, width, height);
  if (!cutout) {
    fillPanelBg(ctx, width, height);
  } else {
    // Only chrome strip background
    ctx.fillStyle = vrTheme.bg;
    ctx.fillRect(0, 0, width, 150);
  }

  const barY = 16;
  const barH = 52;
  const btnW = 52;
  const gap = 8;
  let x = 16;

  const nav: {
    action: "back" | "forward" | "home" | "reload" | "external" | "close";
    label: string;
    enabled: boolean;
  }[] = [
    { action: "back", label: "←", enabled: state.canBack },
    { action: "forward", label: "→", enabled: state.canForward },
    { action: "home", label: language === "zh" ? "主页" : "Home", enabled: true },
    { action: "reload", label: "↻", enabled: true },
    { action: "external", label: language === "zh" ? "外开" : "Ext", enabled: true },
    { action: "close", label: "×", enabled: true },
  ];

  for (const item of nav) {
    const w = item.action === "home" || item.action === "external" ? 70 : btnW;
    roundRectPath(ctx, x, barY, w, barH, 12);
    ctx.fillStyle = item.enabled ? vrTheme.panel : vrTheme.bgDeep;
    ctx.fill();
    ctx.strokeStyle = vrTheme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = item.enabled ? vrTheme.ink : vrTheme.subtle;
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + w / 2, barY + barH / 2 + 1);
    hits.push({ kind: "nav", action: item.action, rect: { x, y: barY, w, h: barH } });
    x += w + gap;
  }

  // Address pill
  const addrX = x;
  const addrW = width - addrX - 20;
  roundRectPath(ctx, addrX, barY, addrW, barH, 12);
  ctx.fillStyle = vrTheme.bgDeep;
  ctx.fill();
  ctx.strokeStyle = vrTheme.border;
  ctx.stroke();
  ctx.fillStyle = vrTheme.muted;
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let addr = state.url;
  const maxW = addrW - 24;
  if (ctx.measureText(addr).width > maxW) {
    while (addr.length > 4 && ctx.measureText(`${addr}…`).width > maxW) addr = addr.slice(0, -1);
    addr = `${addr}…`;
  }
  ctx.fillText(addr, addrX + 12, barY + barH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  // Bookmark row
  const bmY = barY + barH + 18;
  const bmH = 44;
  let bmX = 20;
  for (const bm of state.bookmarks.slice(0, 6)) {
    ctx.font = "600 18px system-ui, sans-serif";
    const tw = ctx.measureText(bm.title).width;
    const w = Math.min(140, Math.max(72, tw + 28));
    if (bmX + w > width - 20) break;
    roundRectPath(ctx, bmX, bmY, w, bmH, 10);
    ctx.fillStyle = vrTheme.panel;
    ctx.fill();
    ctx.strokeStyle = vrTheme.border;
    ctx.stroke();
    ctx.fillStyle = vrTheme.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bm.title, bmX + w / 2, bmY + bmH / 2 + 1);
    hits.push({ kind: "bookmark", url: bm.url, rect: { x: bmX, y: bmY, w, h: bmH } });
    bmX += w + 8;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Thin status under bookmarks (never fills the page body when cutout).
  if (state.status) {
    const sy = bmY + bmH + 10;
    ctx.fillStyle = vrTheme.muted;
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.status, width / 2, sy + 14);
    ctx.textAlign = "left";
  }

  // Home: draw empty content card. Page open: leave transparent for iframe.
  if (!cutout) {
    const contentY = bmY + bmH + 16;
    const contentH = height - contentY - 20;
    roundRectPath(ctx, 20, contentY, width - 40, contentH, 14);
    ctx.fillStyle = vrTheme.bgDeep;
    ctx.fill();
    ctx.strokeStyle = vrTheme.border;
    ctx.stroke();
  }

  return hits;
}

const STICKY_CARD_COLORS = ["#3d3420", "#2a3340", "#342a38", "#2a3830"] as const;
const STICKY_ACCENT = ["#e0b84a", "#6bb8ea", "#e07aa8", "#5ec9a0"] as const;

/** Read-only sticky notes preview (U3 canvas texture path — no offscreen DOM). */
export function paintStickyPreviewPanel(
  p: PanelPaintContext,
  notes: { id: string; text: string }[],
  opts?: { title?: string; empty?: string; openHint?: string },
) {
  const { ctx, width, height, language } = p;
  fillPanelBg(ctx, width, height);

  const title = opts?.title ?? (language === "zh" ? "便签" : "Notes");
  const empty = opts?.empty ?? (language === "zh" ? "暂无便签" : "No notes");
  const openHint = opts?.openHint ?? (language === "zh" ? "点按打开便签板" : "Tap to open");

  ctx.fillStyle = vrTheme.ink;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(title, 40, 46);

  ctx.strokeStyle = vrTheme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 62);
  ctx.lineTo(width - 40, 62);
  ctx.stroke();

  const list = notes.filter((n) => n.text.trim()).slice(0, 4);
  if (!list.length) {
    ctx.fillStyle = vrTheme.subtle;
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(empty, width / 2, height * 0.45);
    ctx.fillStyle = vrTheme.muted;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(openHint, width / 2, height * 0.45 + 36);
    ctx.textAlign = "left";
    return;
  }

  const padX = 36;
  const gap = 14;
  const cardH = 96;
  let y = 86;

  list.forEach((note, i) => {
    const x = padX;
    const w = width - padX * 2;
    if (y + cardH > height - 56) return;

    roundRectPath(ctx, x, y, w, cardH, 12);
    ctx.fillStyle = STICKY_CARD_COLORS[i % STICKY_CARD_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = vrTheme.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent bar top
    ctx.fillStyle = STICKY_ACCENT[i % STICKY_ACCENT.length];
    ctx.fillRect(x, y, w, 4);

    const text = note.text.replace(/\s+/g, " ").trim();
    ctx.fillStyle = vrTheme.ink;
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const maxW = w - 28;
    const lines = wrapTextLines(ctx, text, maxW, 2);
    ctx.fillText(lines[0] ?? "", x + 14, y + 22);
    if (lines[1]) ctx.fillText(lines[1], x + 14, y + 52);
    ctx.textBaseline = "alphabetic";

    y += cardH + gap;
  });

  const more = notes.filter((n) => n.text.trim()).length - list.length;
  ctx.fillStyle = vrTheme.subtle;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    more > 0
      ? language === "zh"
        ? `另有 ${more} 条 · ${openHint}`
        : `+${more} more · ${openHint}`
      : openHint,
    width / 2,
    height - 28,
  );
  ctx.textAlign = "left";
}
