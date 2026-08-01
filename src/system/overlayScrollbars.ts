// Drives macOS-style overlay scrollbars: thumbs appear only while scrolling
// or when hovering a scrollable area, then fade out after a short idle delay.
// The matching styles live in src/styles/scrollbar.css.

const OVERLAY_ATTR = "data-scrollbars";
const SCROLLING_ATTR = "data-scrolling";
const IDLE_DELAY = 800;

let idleTimer: number | undefined;

export function initOverlayScrollbars(): void {
  const root = document.documentElement;
  root.setAttribute(OVERLAY_ATTR, "overlay");

  const activate = () => {
    root.setAttribute(SCROLLING_ATTR, "true");
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      root.removeAttribute(SCROLLING_ATTR);
    }, IDLE_DELAY);
  };

  root.addEventListener("scroll", activate, true);
}
