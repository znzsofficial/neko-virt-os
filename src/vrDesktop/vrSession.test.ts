import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachPendingSessionToRenderer,
  clearPendingVrSession,
  peekPendingVrSession,
} from "./vrSession";

// Seed pendingSession through the same module path used by beginVrSessionFromClick.
async function seedPending(session: XRSession) {
  const xr = {
    requestSession: vi.fn().mockResolvedValue(session),
  };
  const original = navigator.xr;
  Object.defineProperty(navigator, "xr", { configurable: true, value: xr });
  const { beginVrSessionFromClick } = await import("./vrSession");
  await beginVrSessionFromClick();
  Object.defineProperty(navigator, "xr", { configurable: true, value: original });
}

describe("attachPendingSessionToRenderer", () => {
  afterEach(() => {
    clearPendingVrSession();
  });

  it("does not drop pending session when setSession fails", async () => {
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn(),
    } as unknown as XRSession;

    await seedPending(session);
    expect(peekPendingVrSession()).toBe(session);

    const setSession = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const gl = {
      xr: { setSession, enabled: false, isPresenting: false },
    } as unknown as import("three").WebGLRenderer;

    await expect(attachPendingSessionToRenderer(gl)).rejects.toThrow("boom");
    expect(peekPendingVrSession()).toBe(session);

    setSession.mockResolvedValueOnce(undefined);
    await expect(attachPendingSessionToRenderer(gl)).resolves.toBe(true);
    expect(peekPendingVrSession()).toBeNull();
  });
});
