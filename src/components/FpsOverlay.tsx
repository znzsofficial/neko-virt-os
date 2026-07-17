import { useEffect, useState } from "react";
import { useOsUiStore } from "../osUiStore";

export function FpsOverlay() {
  const showFps = useOsUiStore((state) => state.developerPrefs.showFps);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!showFps) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    let mounted = true;

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - last;
      if (elapsed >= 500) {
        if (mounted) setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [showFps]);

  if (!showFps) return null;

  return (
    <div className="fps-overlay" aria-hidden>
      {fps} FPS
    </div>
  );
}
