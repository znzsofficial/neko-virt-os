import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingTasks, readTasks, writeTasks } from "./storage";

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

describe("tasks storage", () => {
  beforeEach(() => installMemoryLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes priority and filters incomplete", () => {
    writeTasks([
      { id: "1", text: "a", done: false, priority: "high" },
      { id: "2", text: "b", done: true, priority: "low" },
    ]);
    expect(readTasks()).toHaveLength(2);
    expect(getPendingTasks(5)).toEqual([{ id: "1", text: "a", done: false, priority: "high" }]);
  });

  it("reads legacy bare array with missing priority", () => {
    localStorage.setItem(
      "neko-virt-os.tasks.v2",
      JSON.stringify([{ id: "x", text: "hello", done: false }]),
    );
    expect(readTasks()[0].priority).toBe("medium");
  });
});
