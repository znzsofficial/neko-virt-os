import { afterEach, describe, expect, it, vi } from "vitest";
import { attachPendingMmdVrSessionToRenderer, beginMmdVrSessionFromClick, endMmdVrSession } from "./mmdVrSession";

describe("MMD VR session", () => {
  afterEach(async () => {
    await endMmdVrSession();
    vi.unstubAllGlobals();
  });

  it("attaches without changing renderer XR quality before setSession", async () => {
    const session = {
      addEventListener: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as XRSession;
    vi.stubGlobal("navigator", {
      xr: { requestSession: vi.fn().mockResolvedValue(session) },
    });
    vi.stubGlobal("isSecureContext", true);

    await beginMmdVrSessionFromClick();

    const setSession = vi.fn().mockResolvedValue(undefined);
    const setFramebufferScaleFactor = vi.fn();
    const setFoveation = vi.fn();
    const renderer = {
      xr: {
        enabled: false,
        isPresenting: false,
        setSession,
        setFramebufferScaleFactor,
        setFoveation,
      },
    };

    await attachPendingMmdVrSessionToRenderer(renderer as never, "balanced");

    expect(setSession).toHaveBeenCalledWith(session);
    expect(setFramebufferScaleFactor).not.toHaveBeenCalled();
    expect(setFoveation).not.toHaveBeenCalled();
  });
});
