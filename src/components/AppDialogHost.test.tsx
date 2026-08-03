// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appAlert, appConfirm, useDialogStore } from "../dialogStore";
import { AppDialogHost } from "./AppDialogHost";

beforeEach(() => {
  useDialogStore.setState({ queue: [], current: null });
  vi.useFakeTimers();
});

describe("AppDialogHost focus management", () => {
  it("keeps focus in queued dialogs and restores it after the queue closes", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    render(<AppDialogHost />);

    const first = appConfirm({
      title: "First",
      message: "One",
      cancelLabel: "Cancel",
      confirmLabel: "Confirm",
    });
    const second = appAlert({ title: "Second", message: "Two", confirmLabel: "OK" });
    await act(async () => vi.runOnlyPendingTimers());

    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /confirm/i });
    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(cancel).toHaveFocus();

    fireEvent.click(confirm);
    await expect(first).resolves.toBe(true);
    await act(async () => vi.runOnlyPendingTimers());
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
    const ok = screen.getByRole("button", { name: "OK" });
    expect(ok).toHaveFocus();

    fireEvent.click(ok);
    await second;
    await act(async () => vi.runOnlyPendingTimers());
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
