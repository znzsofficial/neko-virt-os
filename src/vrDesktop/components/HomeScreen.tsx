import { useCallback, useEffect, useRef } from "react";
import { useLanguageStore } from "../../languageStore";
import { useOsUiStore } from "../../osUiStore";
import { CALENDAR_EVENTS_STORAGE_KEY, getNextUpcomingEvent, getPendingTasks, TASKS_STORAGE_KEY } from "../../shared";
import { formatClockTime } from "../../system/systemPrefs";
import { VR_PANEL_SIZE } from "../vrLayout";
import { paintHomePanel, type PanelPaintContext } from "../vrPanelTexture";
import { VR_PANEL_BASE } from "../vrQuality";
import { usePanelTexture } from "../usePanelTexture";
import { DraggablePanel } from "./DraggablePanel";
import { vrTheme } from "../vrTheme";

function formatDate(date: Date, language: "zh" | "en") {
  return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function HomeScreen({ statusLine, dimmed = false }: { statusLine: string | null; dimmed?: boolean }) {
  const language = useLanguageStore((state) => state.language);
  const hour12 = useOsUiStore((state) => state.systemPrefs.hour12);
  const statusRef = useRef(statusLine);
  statusRef.current = statusLine;
  const summaryRef = useRef(readSummary());

  const paint = useCallback(
    (p: PanelPaintContext) => {
      const now = new Date();
      paintHomePanel(p, formatClockTime(now, hour12, false), formatDate(now, language), {
        pendingTaskCount: summaryRef.current.pendingTaskCount,
        nextEvent: formatNextEvent(summaryRef.current.nextEvent, language),
        language,
        statusLine: statusRef.current,
      });
    },
    [hour12, language],
  );

  const { texture, repaint } = usePanelTexture(
    VR_PANEL_BASE.home.w,
    VR_PANEL_BASE.home.h,
    paint,
    `${hour12}-${language}`,
  );

  useEffect(() => {
    repaint();
  }, [repaint, statusLine]);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const delay = 60_000 - (Date.now() % 60_000) + 20;
      timer = window.setTimeout(() => {
        repaint();
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [repaint]);

  useEffect(() => {
    function refreshSummary() {
      summaryRef.current = readSummary();
      repaint();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === TASKS_STORAGE_KEY || event.key === CALENDAR_EVENTS_STORAGE_KEY) refreshSummary();
    }
    const id = window.setInterval(refreshSummary, 15_000);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [repaint]);

  return (
    <DraggablePanel panelId="home" size={VR_PANEL_SIZE.home}>
      <group scale={dimmed ? 0.985 : 1}>
        <mesh position={[0, 0, VR_PANEL_SIZE.home.w * -0.002]}>
          <planeGeometry args={[VR_PANEL_SIZE.home.w + 0.04, VR_PANEL_SIZE.home.h + 0.04]} />
          <meshBasicMaterial color={dimmed ? vrTheme.bgDeep : vrTheme.primarySoft} transparent opacity={dimmed ? 0.62 : 0.35} fog={false} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[VR_PANEL_SIZE.home.w, VR_PANEL_SIZE.home.h]} />
          <meshBasicMaterial map={texture} color={dimmed ? "#8c8387" : "#ffffff"} toneMapped={false} fog={false} />
        </mesh>
      </group>
    </DraggablePanel>
  );
}

function readSummary() {
  return {
    pendingTaskCount: getPendingTasks(Number.MAX_SAFE_INTEGER).length,
    nextEvent: getNextUpcomingEvent(),
  };
}

function formatNextEvent(event: ReturnType<typeof getNextUpcomingEvent>, language: "zh" | "en") {
  if (!event) return language === "zh" ? "暂无近期日程" : "No upcoming events";
  const prefix = event.time ? `${event.time} ` : "";
  return language === "zh" ? `下个日程 ${prefix}${event.title}` : `Next ${prefix}${event.title}`;
}
