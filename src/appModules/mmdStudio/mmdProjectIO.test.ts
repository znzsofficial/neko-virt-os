import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getMmdProject: vi.fn(),
  loadMmdProjectAsset: vi.fn(),
  saveMmdProject: vi.fn(),
}));

vi.mock("./mmdProjectDb", () => ({
  ...db,
  fileWithRelativePath: (blob: Blob, name: string, mime: string, relativePath: string) => {
    const file = new File([blob], name, { type: mime });
    Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
    return file;
  },
}));

vi.mock("./mmdProjectPrefs", () => ({ writeProjectCatalogEntry: vi.fn() }));

import {
  buildMmdProjectPackage,
  importMmdProjectPackage,
  MMD_PROJECT_PACKAGE_FORMAT,
  MMD_PROJECT_PACKAGE_VERSION,
} from "./mmdProjectIO";

const scalarOverride = {
  opacity: 1,
  metallic: 0,
  roughness: 0.5,
  occlusion: 1,
  emission: 0,
  emissionColor: "#ffffff",
  envInfluence: 0,
  specularMode: "mmd" as const,
  lightingModel: "toon" as const,
};

function baseModel(materialOverrides: Record<string, unknown>) {
  return {
    id: "model-1",
    name: "model.pmx",
    visible: true,
    morphWeights: {},
    morphFavorites: [],
    materialVisible: {},
    materialOverrides,
    offsetX: 0,
    modelAssetId: "model-asset",
    companionAssetIds: [],
    bodyMotionAssetId: null,
    faceMotionAssetId: null,
    cameraMotionAssetId: null,
  };
}

describe("MMD project packages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.saveMmdProject.mockImplementation(async (input) => ({
      ...input,
      id: "imported-project",
      updatedAt: 1,
      isAutosave: false,
      models: [],
    }));
  });

  it("exports enhancement maps as v2 assets", async () => {
    const ao = new File([new Uint8Array([1, 2, 3])], "ao.png", { type: "image/png" });
    const modelFile = new File(["model"], "model.pmx");
    db.getMmdProject.mockResolvedValue({
      id: "project-1",
      name: "Project",
      updatedAt: 1,
      isAutosave: false,
      settings: {},
      models: [baseModel({ Mat: { ...scalarOverride, aoMapFile: ao, emissionMapFile: null, maskMapFile: null } })],
      audioAssetId: null,
      audioName: null,
      hdrAssetId: null,
      hdrName: null,
    });
    db.loadMmdProjectAsset.mockImplementation(async (id) => id === "model-asset" ? modelFile : null);

    const { blob } = await buildMmdProjectPackage("project-1");
    const pack = JSON.parse(await blob.text());
    const override = pack.project.models[0].materialOverrides.Mat;

    expect(pack.version).toBe(MMD_PROJECT_PACKAGE_VERSION);
    expect(override.aoMapFile).toBeUndefined();
    expect(override.aoMapAssetKey).toBe("model-0-material-0-ao");
    expect(pack.assets.find((asset: { key: string }) => asset.key === override.aoMapAssetKey)?.name).toBe("ao.png");
  });

  it("restores v2 enhancement assets as files", async () => {
    const bytes = btoa(String.fromCharCode(4, 5, 6));
    const pack = {
      format: MMD_PROJECT_PACKAGE_FORMAT,
      version: 2,
      exportedAt: 1,
      project: {
        name: "Imported",
        settings: {},
        models: [baseModel({ Mat: { ...scalarOverride, aoMapAssetKey: "ao" } })],
        audioName: null,
        hdrName: null,
        audioAssetKey: null,
        hdrAssetKey: null,
      },
      assets: [
        { key: "model-0", name: "model.pmx", mime: "application/octet-stream", dataBase64: btoa("model") },
        { key: "ao", name: "ao.png", mime: "image/png", relativePath: "tex/ao.png", dataBase64: bytes },
      ],
    };

    await importMmdProjectPackage(new File([JSON.stringify(pack)], "project.mmdstudio.json"));
    const input = db.saveMmdProject.mock.calls[0]![0];
    const ao = input.models[0].materialOverrides.Mat.aoMapFile as File;
    expect(ao).toBeInstanceOf(File);
    expect(ao.name).toBe("ao.png");
    expect((ao as File & { webkitRelativePath?: string }).webkitRelativePath).toBe("tex/ao.png");
    expect([...new Uint8Array(await ao.arrayBuffer())]).toEqual([4, 5, 6]);
  });

  it("rejects a v2 package with a missing referenced enhancement asset", async () => {
    const pack = {
      format: MMD_PROJECT_PACKAGE_FORMAT,
      version: 2,
      exportedAt: 1,
      project: {
        name: "Incomplete",
        settings: {},
        models: [baseModel({ Mat: { ...scalarOverride, aoMapAssetKey: "missing-ao" } })],
        audioName: null,
        hdrName: null,
        audioAssetKey: null,
        hdrAssetKey: null,
      },
      assets: [{ key: "model-0", name: "model.pmx", mime: "application/octet-stream", dataBase64: btoa("model") }],
    };

    await expect(importMmdProjectPackage(new File([JSON.stringify(pack)], "incomplete.mmdstudio.json")))
      .rejects.toThrow("Missing material asset");
    expect(db.saveMmdProject).not.toHaveBeenCalled();
  });

  it("sanitizes unrecoverable v1 File placeholders", async () => {
    const pack = {
      format: MMD_PROJECT_PACKAGE_FORMAT,
      version: 1,
      exportedAt: 1,
      project: {
        name: "Legacy",
        settings: {},
        models: [baseModel({ Mat: { ...scalarOverride, aoMapFile: {}, emissionMapFile: {}, maskMapFile: {} } })],
        audioName: null,
        hdrName: null,
        audioAssetKey: null,
        hdrAssetKey: null,
      },
      assets: [{ key: "model-0", name: "model.pmx", mime: "application/octet-stream", dataBase64: btoa("model") }],
    };

    await importMmdProjectPackage(new File([JSON.stringify(pack)], "legacy.mmdstudio.json"));
    const override = db.saveMmdProject.mock.calls[0]![0].models[0].materialOverrides.Mat;
    expect(override.aoMapFile).toBeNull();
    expect(override.emissionMapFile).toBeNull();
    expect(override.maskMapFile).toBeNull();
  });
});
