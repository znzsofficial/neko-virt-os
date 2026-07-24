import { Suspense, lazy } from "react";
import { useVrDesktopStore } from "./vrDesktopStore";

const VrDesktopScene = lazy(() => import("./VrDesktopScene").then((m) => ({ default: m.VrDesktopScene })));

/** Fullscreen XR shell after session has been requested from a user gesture. */
export function VrDesktopOverlay() {
  const overlayOpen = useVrDesktopStore((state) => state.overlayOpen);
  if (!overlayOpen) return null;
  return (
    <Suspense fallback={<div className="vr-desktop-overlay vr-desktop-loading" aria-busy="true" />}>
      <VrDesktopScene />
    </Suspense>
  );
}

/** Warm the scene chunk after requestSession starts (do not await before requestSession). */
export function preloadVrDesktopScene() {
  return import("./VrDesktopScene");
}
