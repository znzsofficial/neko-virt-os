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

  it("keeps the legacy key readable when the v2 payload is corrupted", () => {
    localStorage.setItem("neko-virt-os.tasks.v2", "{not json");
    localStorage.setItem(
      "neko-virt-os.tasks.v1",
      JSON.stringify([{ id: "l1", text: "legacy", done: false }]),
    );

    expect(readTasks()).toEqual([{ id: "l1", text: "legacy", done: false, priority: "medium" }]);
    expect(localStorage.getItem("neko-virt-os.tasks.v1")).not.toBeNull();
  });

  it("keeps the legacy key when v2 parses to a non-array", () => {
    localStorage.setItem("neko-virt-os.tasks.v2", JSON.stringify("garbage-string"));
    localStorage.setItem(
      "neko-virt-os.tasks.v1",
      JSON.stringify([{ id: "l1", text: "legacy", done: false }]),
    );

    expect(readTasks()).toEqual([{ id: "l1", text: "legacy", done: false, priority: "medium" }]);
    expect(localStorage.getItem("neko-virt-os.tasks.v1")).not.toBeNull();
  });

  it("removes the legacy key only after v2 parses successfully", () => {
    localStorage.setItem(
      "neko-virt-os.tasks.v2",
      JSON.stringify([{ id: "n1", text: "new", done: false }]),
    );
    localStorage.setItem(
      "neko-virt-os.tasks.v1",
      JSON.stringify([{ id: "l1", text: "legacy", done: false }]),
    );

    expect(readTasks()[0].id).toBe("n1");
    expect(localStorage.getItem("neko-virt-os.tasks.v1")).toBeNull();
  });
});
