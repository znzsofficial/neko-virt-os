import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVrDesktopStore } from "../vrDesktop/vrDesktopStore";
import { beginMmdVrSessionFromClick } from "./mmdVrSession";
import { useMmdVrStore } from "./mmdVrStore";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { getXrDiagnostics, getXrSystem } from "../xr/xrDetect";

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

vi.mock("./mmdVrSession", async () => {
  const actual = await vi.importActual<typeof import("./mmdVrSession")>("./mmdVrSession");
  return {
    ...actual,
    beginMmdVrSessionFromClick: vi.fn(async () => ({ id: "mmd-s1" })),
  };
});

vi.mock("./preloadMmdVrScene", () => ({
  preloadMmdVrScene: vi.fn(() => Promise.resolve()),
}));

describe("requestMmdVrEnter", () => {
  const t = (k: string) => k;
  const addNotification = vi.fn();

  beforeEach(() => {
    addNotification.mockClear();
    vi.mocked(beginMmdVrSessionFromClick).mockClear();
    vi.mocked(beginMmdVrSessionFromClick).mockResolvedValue({ id: "mmd-s1" } as unknown as XRSession);
    vi.mocked(getXrSystem).mockReturnValue({ requestSession: vi.fn() } as unknown as XRSystem);
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: true,
      hasXr: true,
      protocol: "https:",
      host: "example.com",
      summary: "secure=true xr=true https://example.com",
    });
    useVrDesktopStore.setState({ overlayOpen: false, phase: "idle" });
    useMmdVrStore.setState({
      prefs: {
        renderQuality: "balanced",
        showFps: false,
        loop: true,
        dprPref: "auto",
        frameRatePref: "auto",
        antialiasPref: "auto",
        shadowsPref: "auto",
        gridPref: "auto",
        walkSpeedPref: "auto",
        lightPreset: "stage",
      },
      phase: "idle",
      errorMessage: null,
      lastError: null,
      overlayOpen: false,
      playing: false,
      loop: true,
      statusLine: null,
      modelCount: 0,
      models: [],
      pendingVisibilityToggles: [],
      duration: 0,
      seekEpoch: 0,
      seekSeconds: 0,
      viewEpoch: 0,
    });
  });

  it("fails without secure context", async () => {
    vi.mocked(getXrDiagnostics).mockReturnValue({
      secure: false,
      hasXr: false,
      protocol: "http:",
      host: "192.168.1.1",
      summary: "secure=false",
    });
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginMmdVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("fails when VR desktop is open", async () => {
    useVrDesktopStore.setState({ overlayOpen: true, phase: "active" });
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginMmdVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("fails when VR desktop is entering", async () => {
    useVrDesktopStore.setState({ overlayOpen: false, phase: "entering" });
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("failed");
    expect(beginMmdVrSessionFromClick).not.toHaveBeenCalled();
  });

  it("enters when secure and WebXR present", async () => {
    const result = await requestMmdVrEnter({ t: t as never, addNotification });
    expect(result).toBe("entered");
    expect(beginMmdVrSessionFromClick).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState().overlayOpen).toBe(true);
  });
});
