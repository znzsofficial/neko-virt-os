import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUpcomingEvents, readCalendarEvents, writeCalendarEvents } from "./storage";

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
});
