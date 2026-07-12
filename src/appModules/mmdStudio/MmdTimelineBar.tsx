import { useRef, useState, type PointerEvent } from "react";
import { formatMmdTime } from "./mmdStudioStore";

type TimelineTooltip = {
  ratio: number;
  label: string;
};

export type MmdTimelineBarProps = {
  currentTime: number;
  duration: number;
  exportIn: number;
  exportOut: number;
  exportFps: number;
  onSeek: (time: number) => void;
  onSetExportIn: (time: number) => void;
  onSetExportOut: (time: number) => void;
};

export function MmdTimelineBar({
  currentTime,
  duration,
  exportIn,
  exportOut,
  exportFps,
  onSeek,
  onSetExportIn,
  onSetExportOut,
}: MmdTimelineBarProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [timelineTooltip, setTimelineTooltip] = useState<TimelineTooltip | null>(null);
  const rangeEnd = exportOut > 0 ? exportOut : duration;
  const currentFrame = Math.round(currentTime * exportFps);
  const snapToFrame = (time: number) => Math.round(time * exportFps) / exportFps;
  const timelineTicks: Array<{ ratio: number; time: number; label: string }> = [];
  if (duration > 0) {
    const tickCount = Math.min(11, Math.max(2, Math.floor(duration / 5) + 2));
    for (let index = 0; index < tickCount; index += 1) {
      const ratio = tickCount <= 1 ? 0 : index / (tickCount - 1);
      const time = duration * ratio;
      timelineTicks.push({ ratio, time, label: formatMmdTime(time, exportFps) });
    }
  }

  function timelineRatio(clientX: number) {
    const box = timelineRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || duration <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
  }

  function timelineTimeFromClientX(clientX: number) {
    return timelineRatio(clientX) * duration;
  }

  function beginTimelineDrag(kind: "seek" | "in" | "out", startEvent: PointerEvent<HTMLElement>) {
    if (duration <= 0) return;
    startEvent.preventDefault();
    const update = (clientX: number) => {
      const rawTime = timelineTimeFromClientX(clientX);
      const nextTime = snapToFrame(rawTime);
      const nextFrame = Math.round(nextTime * exportFps);
      setTimelineTooltip({
        ratio: duration > 0 ? nextTime / duration : 0,
        label: `${formatMmdTime(nextTime, exportFps)} · ${nextFrame}f`,
      });
      if (kind === "seek") {
        onSeek(nextTime);
        return;
      }
      if (kind === "in") {
        onSetExportIn(nextTime);
        return;
      }
      onSetExportOut(nextTime);
    };
    update(startEvent.clientX);
    const move = (event: globalThis.PointerEvent) => update(event.clientX);
    const stop = () => {
      setTimelineTooltip(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <>
      <div className="mmd-scrub">
        <div
          ref={timelineRef}
          className="mmd-timeline"
          onPointerDown={(event) => beginTimelineDrag("seek", event)}
        >
          <div className="mmd-timeline-track" />
          {timelineTicks.map((tick) => (
            <div key={`${tick.ratio}-${tick.time}`} className="mmd-timeline-tick" style={{ left: `${tick.ratio * 100}%` }}>
              <span>{tick.label}</span>
            </div>
          ))}
          {duration > 0 ? (
            <>
              <div
                className="mmd-range-marks"
                style={{
                  left: `${(exportIn / duration) * 100}%`,
                  width: `${(Math.max(0, (rangeEnd || duration) - exportIn) / duration) * 100}%`,
                }}
              />
              <button
                type="button"
                className="mmd-timeline-handle is-in"
                style={{ left: `${(exportIn / duration) * 100}%` }}
                onPointerDown={(event) => beginTimelineDrag("in", event)}
              />
              <button
                type="button"
                className="mmd-timeline-handle is-out"
                style={{ left: `${((rangeEnd || duration) / duration) * 100}%` }}
                onPointerDown={(event) => beginTimelineDrag("out", event)}
              />
              <div
                className="mmd-timeline-playhead"
                style={{ left: `${(Math.min(currentTime, duration) / duration) * 100}%` }}
              />
              {timelineTooltip ? (
                <div className="mmd-timeline-tooltip" style={{ left: `${timelineTooltip.ratio * 100}%` }}>
                  {timelineTooltip.label}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={1 / exportFps}
          value={Math.min(currentTime, Math.max(duration, 0.01))}
          style={{
            ["--os-range-progress" as string]: `${
              duration > 0 ? Math.min(100, Math.max(0, (Math.min(currentTime, duration) / duration) * 100)) : 0
            }%`,
          }}
          onChange={(event) => onSeek(snapToFrame(Number(event.target.value)))}
        />
      </div>
      <span className="mmd-mono">{formatMmdTime(currentTime, exportFps)} / {formatMmdTime(duration, exportFps)} · {currentFrame}f @ {exportFps}fps</span>
    </>
  );
}
