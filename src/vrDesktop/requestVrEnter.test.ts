import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestVrDesktopEnter } from "./requestVrEnter";
import { beginVrSessionFromClick, getXrDiagnostics, getXrSystem } from "./vrSession";
import { useVrDesktopStore } from "./vrDesktopStore";

vi.mock("./vrSession", async () => {
  const actual = await vi.importActual<typeof import("./vrSession")>("./vrSession");
  return {
    ...actual,
    beginVrSessionFromClick: vi.fn(async () => ({ id: "s1" })),
    getXrSystem: vi.fn(() => ({ requestSession: vi.fn() })),
    getXrDiagnostics: vi.fn(() => ({
      secure: true,
      hasXr: true,
      protocol: "https:",
      host: "example.com",
      summary: "secure=true xr=true https://example.com",
    })),
  };
});

vi.mock("./VrDesktopOverlay", () => ({
  preloadVrDesktopScene: vi.fn(() => Promise.resolve()),
}));

describe("requestVrDesktopEnter", () => {
  const t = (k: string) => k;
  const addNotification = vi.fn();

  beforeEach(() => {
    addNotification.mockClear();
    vi.mocked(beginVrSessionFromClick).mockClear();
    vi.mocked(beginVrSessionFromClick).mockResolvedValue({ id: "s1" } as unknown as XRSession);
    vi.mocked(getXrSystem).mockReturnValue({ requestSession: vi.fn() } as unknown as XRSystem);
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: true,
      hasXr: true,
      protocol: "https:",
      host: "example.com",
      summary: "secure=true xr=true https://example.com",
    });
    useVrDesktopStore.setState({
      prefs: { enabled: true, softEdges: false, renderQuality: "balanced", showFps: false },
      capability: "ready",
      sessionSupported: null,
      phase: "idle",
      errorMessage: null,
      lastError: null,
      overlayOpen: false,
      layoutEpoch: 0,
    });
  });

  it("fails without secure context", async () => {
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: false,
      hasXr: false,
      protocol: "http:",
      host: "192.168.1.1",
      summary: "secure=false xr=false http://192.168.1.1",
    });
    const result = await requestVrDesktopEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("fails without WebXR API", async () => {
    vi.mocked(getXrSystem).mockReturnValue(null);
    const result = await requestVrDesktopEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("enters when secure and WebXR present", async () => {
    const result = await requestVrDesktopEnter({ t: t as never, addNotification });
    expect(result).toBe("entered");
    expect(beginVrSessionFromClick).toHaveBeenCalledOnce();
    expect(useVrDesktopStore.getState().overlayOpen).toBe(true);
  });
});
