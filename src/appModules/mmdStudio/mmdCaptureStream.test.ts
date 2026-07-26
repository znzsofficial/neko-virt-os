import { describe, expect, it, vi } from "vitest";
import { stopCaptureVideoTracks } from "./mmdCaptureStream";

describe("MMD capture stream cleanup", () => {
  it("stops canvas video tracks without ending the reusable audio track", () => {
    const videoTrack = { stop: vi.fn() };
    const audioTrack = { stop: vi.fn() };
    const stream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack],
    };

    stopCaptureVideoTracks(stream as unknown as MediaStream);

    expect(videoTrack.stop).toHaveBeenCalledOnce();
    expect(audioTrack.stop).not.toHaveBeenCalled();
  });
});
