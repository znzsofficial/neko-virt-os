import { beforeEach, describe, expect, it } from "vitest";
import {
  MMD_VR_MAX_MODELS,
  beginMmdVrAssetSession,
  endMmdVrAssetSession,
  getMmdVrSessionAssets,
  peekMmdVrPendingAssets,
  setMmdVrPendingAssets,
} from "./mmdVrAssets";

function fakeFile(name: string) {
  return new File([name], name, { type: "application/octet-stream" });
}

describe("mmdVrAssets", () => {
  beforeEach(() => {
    endMmdVrAssetSession();
  });

  it("caps pending slots", () => {
    const slots = Array.from({ length: MMD_VR_MAX_MODELS + 2 }, (_, i) => ({
      modelFile: fakeFile(`m${i}.pmx`),
      companionFiles: [fakeFile(`m${i}.pmx`)],
      bodyMotionFile: null,
    }));
    setMmdVrPendingAssets(slots);
    expect(peekMmdVrPendingAssets()).toHaveLength(MMD_VR_MAX_MODELS);
  });

  it("begin promotes pending and survives second begin", () => {
    setMmdVrPendingAssets([
      {
        modelFile: fakeFile("a.pmx"),
        companionFiles: [fakeFile("a.pmx")],
        bodyMotionFile: fakeFile("a.vmd"),
      },
    ]);
    beginMmdVrAssetSession();
    expect(getMmdVrSessionAssets()).toHaveLength(1);
    expect(peekMmdVrPendingAssets()).toHaveLength(0);
    // Strict Mode remount / second begin without new pending keeps session
    beginMmdVrAssetSession();
    expect(getMmdVrSessionAssets()[0]?.bodyMotionFile?.name).toBe("a.vmd");
  });

  it("end clears session", () => {
    setMmdVrPendingAssets([
      {
        modelFile: fakeFile("a.pmx"),
        companionFiles: [fakeFile("a.pmx")],
        bodyMotionFile: null,
      },
    ]);
    beginMmdVrAssetSession();
    endMmdVrAssetSession();
    expect(getMmdVrSessionAssets()).toHaveLength(0);
  });
});
