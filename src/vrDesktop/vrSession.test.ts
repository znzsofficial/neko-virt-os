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

  it("keeps pending session after successful setSession (remount re-bind)", async () => {
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn(),
    } as unknown as XRSession;

    await seedPending(session);
    expect(peekPendingVrSession()).toBe(session);

    const setSession = vi.fn().mockResolvedValue(undefined);
    const gl = {
      xr: { setSession, enabled: false, isPresenting: false },
    } as unknown as import("three").WebGLRenderer;

    await expect(attachPendingSessionToRenderer(gl)).resolves.toBe(true);
    expect(setSession).toHaveBeenCalledWith(session);
    // Must keep pending so Strict Mode / second Canvas can setSession again.
    expect(peekPendingVrSession()).toBe(session);
    expect(gl.xr.enabled).toBe(true);
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
    expect(peekPendingVrSession()).toBe(session);
  });

  it("serializes concurrent attaches", async () => {
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn(),
    } as unknown as XRSession;
    await seedPending(session);

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const order: string[] = [];
    const setSession = vi.fn().mockImplementation(async () => {
      order.push("start");
      await gate;
      order.push("end");
    });
    const gl = {
      xr: { setSession, enabled: false, isPresenting: false },
    } as unknown as import("three").WebGLRenderer;

    const a = attachPendingSessionToRenderer(gl);
    const b = attachPendingSessionToRenderer(gl);
    release();
    await Promise.all([a, b]);
    expect(setSession).toHaveBeenCalledTimes(2);
    expect(order).toEqual(["start", "end", "start", "end"]);
  });
});
