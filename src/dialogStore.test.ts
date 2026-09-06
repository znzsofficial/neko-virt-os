import { beforeEach, describe, expect, it } from "vitest";
import { appAlert, appConfirm, appPrompt, useDialogStore } from "./dialogStore";

beforeEach(() => {
  useDialogStore.setState({ queue: [], current: null });
});

describe("dialogStore queue", () => {
  it("promotes the first request as current", async () => {
    const pending = appConfirm({ title: "t", message: "m" });
    expect(useDialogStore.getState().current?.kind).toBe("confirm");
    useDialogStore.getState().settle(true);
    await expect(pending).resolves.toBe(true);
    expect(useDialogStore.getState().current).toBeNull();
  });

  it("queues a second dialog until the first settles", async () => {
    const first = appConfirm({ title: "a", message: "1" });
    const second = appAlert({ title: "b", message: "2" });
    expect(useDialogStore.getState().current?.kind).toBe("confirm");
    expect(useDialogStore.getState().queue).toHaveLength(1);

    useDialogStore.getState().settle(false);
    await expect(first).resolves.toBe(false);

    expect(useDialogStore.getState().current?.kind).toBe("alert");
    useDialogStore.getState().settle(true);
    await second;
    expect(useDialogStore.getState().current).toBeNull();
  });

  it("returns string from prompt and null when cancelled", async () => {
    const ok = appPrompt({ title: "p", message: "name", defaultValue: "x" });
    useDialogStore.getState().settle("hello");
    await expect(ok).resolves.toBe("hello");

    const cancelled = appPrompt({ title: "p", message: "name" });
    useDialogStore.getState().settle(null);
    await expect(cancelled).resolves.toBeNull();
  });

  it("ignores a second settle in the same tick and keeps the queued dialog intact", async () => {
    const first = appConfirm({ title: "a", message: "1" });
    const second = appAlert({ title: "b", message: "2" });

    useDialogStore.getState().settle(true);
    useDialogStore.getState().settle(false);

    await expect(first).resolves.toBe(true);
    const state = useDialogStore.getState();
    expect(state.current?.kind).toBe("alert");
    expect(state.queue).toHaveLength(0);

    useDialogStore.getState().settle(true);
    await second;
    expect(useDialogStore.getState().current).toBeNull();
  });

  it("still settles sequential dialogs across separate ticks", async () => {
    const first = appConfirm({ title: "a", message: "1" });
    useDialogStore.getState().settle(true);
    await expect(first).resolves.toBe(true);

    const second = appConfirm({ title: "b", message: "2" });
    useDialogStore.getState().settle(false);
    await expect(second).resolves.toBe(false);
    expect(useDialogStore.getState().current).toBeNull();
  });
});
