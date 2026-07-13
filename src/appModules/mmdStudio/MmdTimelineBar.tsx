import { Icon } from "@iconify-icon/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLanguageStore } from "../../languageStore";
import { formatMmdTime } from "./mmdStudioStore";

type TimelineTooltip = {
  ratio: number;
  label: string;
};

type TimelineTick = {
  ratio: number;
  time: number;
  label: string | null;
  major: boolean;
};

export type MmdTimelineBarProps = {
  currentTime: number;
  duration: number;
  exportIn: number;
  exportOut: number;
  exportFps: number;
  playing?: boolean;
  onSeek: (time: number) => void;
  onSetExportIn: (time: number) => void;
  onSetExportOut: (time: number) => void;
  onClearRange?: () => void;
};

/** Must match `.mmd-timeline-rail` horizontal inset in mmd-studio.css */
const TIMELINE_RAIL_INSET_X = 12;

function pickTickStep(duration: number, fps: number) {
  const candidates = [1 / Math.max(1, fps), 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  // Aim for ~6–10 major labels so labels rarely collide.
  const target = duration / 8;
  let best = candidates[candidates.length - 1]!;
  for (const step of candidates) {
    if (step >= target) {
      best = step;
      break;
    }
  }
  return best;
}

function buildTicks(duration: number, fps: number): TimelineTick[] {
  if (duration <= 0) return [];
  const majorStep = pickTickStep(duration, fps);
  const minorStep = majorStep >= 1 ? majorStep / 5 : majorStep / 2;
  const ticks: TimelineTick[] = [];
  const seen = new Set<string>();
  const push = (time: number, major: boolean) => {
    const t = Math.min(duration, Math.max(0, time));
    const key = t.toFixed(4);
    if (seen.has(key)) return;
    seen.add(key);
    ticks.push({
      ratio: duration > 0 ? t / duration : 0,
      time: t,
      label: major ? formatMmdTime(t, fps) : null,
      major,
    });
  };
  push(0, true);
  if (minorStep > 0) {
    const limit = duration - Math.min(minorStep * 0.25, 1e-3);
    for (let t = minorStep; t < limit; t += minorStep) {
      const nearMajor = Math.abs(t / majorStep - Math.round(t / majorStep)) < 1e-6;
      push(t, nearMajor);
    }
  }
  push(duration, true);
  // Drop major labels that sit too close to neighbors (keeps edges labeled).
  const majors = ticks.filter((tick) => tick.major && tick.label);
  if (majors.length > 2) {
    const minGap = Math.max(majorStep * 0.55, duration * 0.07);
    let lastKept = majors[0]!;
    for (let i = 1; i < majors.length - 1; i += 1) {
      const tick = majors[i]!;
      const next = majors[i + 1]!;
      if (tick.time - lastKept.time < minGap || next.time - tick.time < minGap * 0.45) {
        tick.label = null;
      } else {
        lastKept = tick;
      }
    }
  }
  return ticks.sort((a, b) => a.time - b.time);
}

export function MmdTimelineBar({
  currentTime,
  duration,
  exportIn,
  exportOut,
  exportFps,
  playing = false,
  onSeek,
  onSetExportIn,
  onSetExportOut,
  onClearRange,
}: MmdTimelineBarProps) {
  const t = useLanguageStore((state) => state.t);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [timelineTooltip, setTimelineTooltip] = useState<TimelineTooltip | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const dragKindRef = useRef<"seek" | "in" | "out" | null>(null);

  const rangeEnd = exportOut > 0 ? Math.min(exportOut, duration || exportOut) : duration;
  const safeDuration = Math.max(duration, 0);
  const clampedTime = Math.min(Math.max(0, currentTime), safeDuration || 0);
  const currentFrame = Math.round(clampedTime * exportFps);
  const totalFrames = Math.max(0, Math.round(safeDuration * exportFps));
  const snapToFrame = (time: number) => {
    if (!Number.isFinite(time) || exportFps <= 0) return 0;
    return Math.round(Math.min(Math.max(0, time), safeDuration || 0) * exportFps) / exportFps;
  };

  const timelineTicks = useMemo(() => buildTicks(safeDuration, exportFps), [exportFps, safeDuration]);

  const inRatio = safeDuration > 0 ? exportIn / safeDuration : 0;
  const outRatio = safeDuration > 0 ? (rangeEnd || safeDuration) / safeDuration : 1;
  const playRatio = safeDuration > 0 ? clampedTime / safeDuration : 0;
  const rangeWidth = Math.max(0, outRatio - inRatio);

  function timelineRatio(clientX: number) {
    const box = timelineRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || safeDuration <= 0) return 0;
    // Match CSS rail inset so scrub lines up with the painted track.
    const usable = Math.max(1, box.width - TIMELINE_RAIL_INSET_X * 2);
    return Math.min(1, Math.max(0, (clientX - box.left - TIMELINE_RAIL_INSET_X) / usable));
  }

  function timelineTimeFromClientX(clientX: number) {
    return timelineRatio(clientX) * safeDuration;
  }

  function showTip(time: number) {
    const nextTime = snapToFrame(time);
    setTimelineTooltip({
      ratio: safeDuration > 0 ? nextTime / safeDuration : 0,
      label: `${formatMmdTime(nextTime, exportFps)} · f${Math.round(nextTime * exportFps)}`,
    });
  }

  function beginTimelineDrag(kind: "seek" | "in" | "out", startEvent: PointerEvent<HTMLElement>) {
    if (safeDuration <= 0) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();
    dragKindRef.current = kind;
    const update = (clientX: number) => {
      const rawTime = timelineTimeFromClientX(clientX);
      let nextTime = snapToFrame(rawTime);
      if (kind === "seek") {
        onSeek(nextTime);
        showTip(nextTime);
        return;
      }
      if (kind === "in") {
        const end = rangeEnd > 0 ? rangeEnd : safeDuration;
        nextTime = Math.min(nextTime, Math.max(0, end - 1 / exportFps));
        onSetExportIn(nextTime);
        showTip(nextTime);
        return;
      }
      const start = exportIn;
      nextTime = Math.max(nextTime, start + 1 / exportFps);
      onSetExportOut(nextTime);
      showTip(nextTime);
    };
    update(startEvent.clientX);
    const move = (event: globalThis.PointerEvent) => update(event.clientX);
    const stop = () => {
      dragKindRef.current = null;
      setTimelineTooltip(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function stepFrames(delta: number) {
    if (safeDuration <= 0) return;
    onSeek(snapToFrame(clampedTime + delta / exportFps));
  }

  function jumpToIn() {
    onSeek(snapToFrame(exportIn));
  }

  function jumpToOut() {
    onSeek(snapToFrame(rangeEnd > 0 ? rangeEnd : safeDuration));
  }

  function markInHere() {
    onSetExportIn(snapToFrame(clampedTime));
  }

  function markOutHere() {
    onSetExportOut(snapToFrame(clampedTime));
  }

  function commitTimeDraft() {
    setEditingTime(false);
    const raw = timeDraft.trim();
    if (!raw) return;
    // Accept f123, 12.5, or mm:ss.ff
    let seconds = Number.NaN;
    if (/^f\d+$/i.test(raw)) {
      seconds = Number(raw.slice(1)) / exportFps;
    } else if (raw.includes(":")) {
      const parts = raw.split(":");
      const m = Number(parts[0]);
      const rest = parts[1] ?? "0";
      const [sPart, fPart] = rest.split(".");
      const s = Number(sPart);
      const f = fPart != null ? Number(fPart) : 0;
      if ([m, s, f].every((n) => Number.isFinite(n))) {
        seconds = m * 60 + s + f / exportFps;
      }
    } else {
      seconds = Number(raw);
    }
    if (!Number.isFinite(seconds)) return;
    onSeek(snapToFrame(seconds));
  }

  useEffect(() => {
    if (editingTime) return;
    setTimeDraft(formatMmdTime(clampedTime, exportFps));
  }, [clampedTime, editingTime, exportFps]);

  function onBarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (safeDuration <= 0) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepFrames(event.shiftKey ? -10 : -1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepFrames(event.shiftKey ? 10 : 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSeek(safeDuration);
    } else if (event.key.toLowerCase() === "i" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      markInHere();
    } else if (event.key.toLowerCase() === "o" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      markOutHere();
    }
  }

  const rangeLabel =
    safeDuration > 0
      ? `${formatMmdTime(exportIn, exportFps)} – ${formatMmdTime(rangeEnd || safeDuration, exportFps)}`
      : "—";

  return (
    <div className="mmd-timeline-shell" tabIndex={0} onKeyDown={onBarKeyDown} aria-label={t("mmdExportRange")}>
      <div className="mmd-timeline-toolbar">
        <div className="mmd-timeline-stepper">
          <button type="button" className="button-ghost mmd-timeline-icon-btn" disabled={safeDuration <= 0} title="-10f" onClick={() => stepFrames(-10)}>
            <Icon icon="solar:rewind-back-bold" width={14} height={14} />
          </button>
          <button type="button" className="button-ghost mmd-timeline-icon-btn" disabled={safeDuration <= 0} title="-1f" onClick={() => stepFrames(-1)}>
            <Icon icon="solar:alt-arrow-left-bold" width={14} height={14} />
          </button>
          <button type="button" className="button-ghost mmd-timeline-icon-btn" disabled={safeDuration <= 0} title="+1f" onClick={() => stepFrames(1)}>
            <Icon icon="solar:alt-arrow-right-bold" width={14} height={14} />
          </button>
          <button type="button" className="button-ghost mmd-timeline-icon-btn" disabled={safeDuration <= 0} title="+10f" onClick={() => stepFrames(10)}>
            <Icon icon="solar:rewind-forward-bold" width={14} height={14} />
          </button>
        </div>

        <div className="mmd-timeline-timeblock">
          {editingTime ? (
            <input
              className="mmd-timeline-time-input"
              autoFocus
              value={timeDraft}
              spellCheck={false}
              onChange={(event) => setTimeDraft(event.target.value)}
              onBlur={commitTimeDraft}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitTimeDraft();
                if (event.key === "Escape") setEditingTime(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="mmd-timeline-time-display"
              disabled={safeDuration <= 0}
              onClick={() => {
                setTimeDraft(formatMmdTime(clampedTime, exportFps));
                setEditingTime(true);
              }}
              title="mm:ss.ff · f123"
            >
              <span className="mmd-mono">{formatMmdTime(clampedTime, exportFps)}</span>
              <span className="mmd-timeline-time-sep">/</span>
              <span className="mmd-mono">{formatMmdTime(safeDuration, exportFps)}</span>
            </button>
          )}
          <span className="mmd-timeline-frame-meta mmd-mono">
            f{currentFrame}
            <span className="mmd-timeline-time-sep">/</span>
            {totalFrames}
            <span className="mmd-timeline-fps">@{exportFps}</span>
          </span>
        </div>

        <div className="mmd-timeline-range-actions">
          <button type="button" className="button-ghost mmd-mini-btn" disabled={safeDuration <= 0} onClick={markInHere}>
            {t("mmdMarkIn")}
          </button>
          <button type="button" className="button-ghost mmd-mini-btn" disabled={safeDuration <= 0} onClick={markOutHere}>
            {t("mmdMarkOut")}
          </button>
          <button type="button" className="button-ghost mmd-mini-btn" disabled={safeDuration <= 0} onClick={jumpToIn} title={t("mmdMarkIn")}>
            <Icon icon="solar:map-arrow-left-bold" width={13} height={13} />
          </button>
          <button type="button" className="button-ghost mmd-mini-btn" disabled={safeDuration <= 0} onClick={jumpToOut} title={t("mmdMarkOut")}>
            <Icon icon="solar:map-arrow-right-bold" width={13} height={13} />
          </button>
          {onClearRange ? (
            <button type="button" className="button-ghost mmd-mini-btn" disabled={safeDuration <= 0} onClick={onClearRange}>
              {t("mmdClearRange")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mmd-scrub mmd-scrub-advanced">
        <div
          ref={timelineRef}
          className={playing ? "mmd-timeline is-playing" : "mmd-timeline"}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest(".mmd-timeline-handle")) return;
            beginTimelineDrag("seek", event);
          }}
          onPointerMove={(event) => {
            if (dragKindRef.current || safeDuration <= 0) return;
            const ratio = timelineRatio(event.clientX);
            setHoverRatio(ratio);
            showTip(ratio * safeDuration);
          }}
          onPointerLeave={() => {
            if (dragKindRef.current) return;
            setHoverRatio(null);
            setTimelineTooltip(null);
          }}
        >
          <div className="mmd-timeline-rail">
            <div className="mmd-timeline-track" />
            <div className="mmd-timeline-progress" style={{ width: `${playRatio * 100}%` }} />
            {safeDuration > 0 ? (
              <div
                className="mmd-range-marks"
                style={{
                  left: `${inRatio * 100}%`,
                  width: `${rangeWidth * 100}%`,
                }}
              />
            ) : null}

            {timelineTicks.map((tick) => {
              const edge =
                tick.ratio <= 0.001 ? " is-edge-start" : tick.ratio >= 0.999 ? " is-edge-end" : "";
              return (
                <div
                  key={`${tick.major ? "M" : "m"}-${tick.time}`}
                  className={`${tick.major ? "mmd-timeline-tick is-major" : "mmd-timeline-tick is-minor"}${edge}`}
                  style={{ left: `${tick.ratio * 100}%` }}
                >
                  {tick.label ? <span>{tick.label}</span> : null}
                </div>
              );
            })}

            {hoverRatio != null && safeDuration > 0 ? (
              <div className="mmd-timeline-hover" style={{ left: `${hoverRatio * 100}%` }} />
            ) : null}

            {safeDuration > 0 ? (
              <>
                <button
                  type="button"
                  className="mmd-timeline-handle is-in"
                  style={{ left: `${inRatio * 100}%` }}
                  aria-label={t("mmdMarkIn")}
                  onPointerDown={(event) => beginTimelineDrag("in", event)}
                />
                <button
                  type="button"
                  className="mmd-timeline-handle is-out"
                  style={{ left: `${outRatio * 100}%` }}
                  aria-label={t("mmdMarkOut")}
                  onPointerDown={(event) => beginTimelineDrag("out", event)}
                />
                <div className="mmd-timeline-playhead" style={{ left: `${playRatio * 100}%` }}>
                  <span className="mmd-timeline-playhead-cap" />
                </div>
                {timelineTooltip ? (
                  <div className="mmd-timeline-tooltip" style={{ left: `${timelineTooltip.ratio * 100}%` }}>
                    {timelineTooltip.label}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <input
          className="mmd-timeline-a11y-range"
          type="range"
          min={0}
          max={Math.max(safeDuration, 0.01)}
          step={1 / Math.max(1, exportFps)}
          value={Math.min(clampedTime, Math.max(safeDuration, 0.01))}
          aria-label="Seek"
          onChange={(event) => onSeek(snapToFrame(Number(event.target.value)))}
        />
      </div>

      <div className="mmd-timeline-footer">
        <span className="mmd-timeline-range-label">
          {t("mmdExportRange")}: <span className="mmd-mono">{rangeLabel}</span>
        </span>
        <span className="mmd-timeline-hint">{t("mmdTimelineKeys")}</span>
      </div>
    </div>
  );
}
