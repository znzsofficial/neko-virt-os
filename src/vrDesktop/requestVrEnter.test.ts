import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMmdVrStore } from "../mmdVrShowcase/mmdVrStore";
import { requestVrDesktopEnter } from "./requestVrEnter";
import { beginVrSessionFromClick } from "./vrSession";
import { useVrDesktopStore } from "./vrDesktopStore";
import { getXrDiagnostics, getXrSystem } from "../xr/xrDetect";

// requestImmersiveEnter imports xrDetect directly — mock the module path it uses.
vi.mock("../xr/xrDetect", async () => {
  const actual = await vi.importActual<typeof import("../xr/xrDetect")>("../xr/xrDetect");
  return {
    ...actual,
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

vi.mock("./vrSession", async () => {
  const actual = await vi.importActual<typeof import("./vrSession")>("./vrSession");
  return {
    ...actual,
    beginVrSessionFromClick: vi.fn(async () => ({ id: "s1" })),
  };
});

vi.mock("./preloadVrDesktopScene", () => ({
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
      prefs: {
        enabled: true,
        softEdges: false,
        renderQuality: "balanced",
        showFps: false,
        dprPref: "auto",
        panelScalePref: "auto",
        frameRatePref: "auto",
        antialiasPref: "auto",
        framebufferScalePref: "auto",
        foveationPref: "auto",
        floorDetailPref: "auto",
        themeColor: "blue",
      },
      capability: "ready",
      sessionSupported: null,
      phase: "idle",
      errorMessage: null,
      lastError: null,
      overlayOpen: false,
      layoutEpoch: 0,
    });
    useMmdVrStore.setState({ overlayOpen: false, phase: "idle" });
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
