import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNextUpcomingEvent, getUpcomingEvents, readCalendarEvents, writeCalendarEvents } from "./storage";

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  });
}

describe("calendar storage", () => {
  beforeEach(() => installMemoryLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips events and filters upcoming", () => {
    const past = "2000-01-01";
    const future = "2099-12-31";
    writeCalendarEvents([
      { id: "1", date: past, title: "old" },
      { id: "2", date: future, title: "new", time: "10:00" },
    ]);
    expect(readCalendarEvents()).toHaveLength(2);
    expect(getUpcomingEvents(5).map((e) => e.id)).toEqual(["2"]);
  });

  it("skips timed events that already passed today", () => {
    writeCalendarEvents([
      { id: "past", date: "2026-07-27", title: "Morning", time: "09:00" },
      { id: "future", date: "2026-07-27", title: "Evening", time: "18:00" },
      { id: "tomorrow", date: "2026-07-28", title: "Tomorrow", time: "08:00" },
    ]);

    expect(getNextUpcomingEvent(new Date(2026, 6, 27, 17, 0))?.id).toBe("future");
    expect(getNextUpcomingEvent(new Date(2026, 6, 27, 19, 0))?.id).toBe("tomorrow");
  });
});
