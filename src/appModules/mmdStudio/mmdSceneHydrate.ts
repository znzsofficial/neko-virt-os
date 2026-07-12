import type { MmdSceneApi } from "./MmdCanvas";
import type { MmdProjectModelAssets } from "./mmdRuntime";
import type { MaterialOverride } from "./mmdRuntimeMaterials";
import { DEFAULT_MODEL_TRANSFORM, type MmdModelTransform } from "./mmdRuntimeEntry";
import { useMmdStudioStore } from "./mmdStudioStore";

export type MmdHydrateModelInput = {
  id?: string;
  name?: string;
  visible?: boolean;
  morphWeights?: Record<string, number>;
  morphFavorites?: string[];
  materialVisible?: Record<string, boolean>;
  materialOverrides?: Record<string, Partial<MaterialOverride>>;
  transform?: Partial<MmdModelTransform> | null;
  /** legacy single-axis offset */
  offsetX?: number;
  modelFile: File;
  companionFiles?: File[];
  bodyMotionFile?: File | null;
  faceMotionFile?: File | null;
};

export type MmdHydrateOptions = {
  physics?: boolean;
  selectedId?: string | null;
  clearFirst?: boolean;
};

/** Shared model rebuild path for project load + backend remount restore. */
export async function hydrateMmdModels(
  api: Pick<
    MmdSceneApi,
    | "clearScene"
    | "addModel"
    | "setModelVisible"
    | "setModelTransform"
    | "loadMotion"
    | "setMorphWeight"
    | "setMaterialVisible"
    | "setMaterialOverride"
    | "selectModel"
    | "listModels"
  >,
  models: readonly MmdHydrateModelInput[],
  options: MmdHydrateOptions = {},
) {
  if (options.clearFirst !== false) api.clearScene();

  const physics = options.physics ?? useMmdStudioStore.getState().physicsEnabled;
  let lastId: string | null = null;

  for (const model of models) {
    const companions = model.companionFiles?.length ? model.companionFiles : [model.modelFile];
    const transform: MmdModelTransform = model.transform
      ? { ...DEFAULT_MODEL_TRANSFORM, ...model.transform }
      : { ...DEFAULT_MODEL_TRANSFORM, positionX: model.offsetX ?? 0 };

    const report = await api.addModel(model.modelFile, companions, {
      physics,
      preferredId: model.id,
      transform,
    });
    const modelId = report.modelId;
    lastId = modelId;

    api.setModelVisible(modelId, model.visible !== false);
    api.setModelTransform(modelId, transform);

    if (model.bodyMotionFile) await api.loadMotion(model.bodyMotionFile, "body", modelId);
    if (model.faceMotionFile) await api.loadMotion(model.faceMotionFile, "face", modelId);

    for (const [name, weight] of Object.entries(model.morphWeights ?? {})) {
      api.setMorphWeight(modelId, name, weight);
    }
    if (model.morphFavorites?.length) {
      useMmdStudioStore.getState().setMorphFavorites(modelId, model.morphFavorites);
    }
    for (const [name, visible] of Object.entries(model.materialVisible ?? {})) {
      api.setMaterialVisible(modelId, name, visible);
    }
    for (const [name, override] of Object.entries(model.materialOverrides ?? {})) {
      api.setMaterialOverride(modelId, name, {
        aoMapFile: override.aoMapFile ?? null,
        emissionMapFile: override.emissionMapFile ?? null,
        maskMapFile: override.maskMapFile ?? null,
        opacity: override.opacity,
        metallic: override.metallic,
        roughness: override.roughness,
        occlusion: override.occlusion,
        emission: override.emission,
        emissionColor: override.emissionColor,
        envInfluence: override.envInfluence,
        specularMode: override.specularMode,
        lightingModel: override.lightingModel,
      });
    }
  }

  const prefer = options.selectedId;
  const selected =
    prefer && api.listModels().some((item) => item.id === prefer) ? prefer : lastId;
  if (selected) api.selectModel(selected);
  return selected;
}

export function projectAssetsToHydrateInput(models: MmdProjectModelAssets[]): MmdHydrateModelInput[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    visible: model.visible,
    morphWeights: model.morphWeights,
    morphFavorites: model.morphFavorites,
    materialVisible: model.materialVisible,
    materialOverrides: model.materialOverrides,
    transform: model.transform,
    modelFile: model.modelFile,
    companionFiles: model.companionFiles,
    bodyMotionFile: model.bodyMotionFile,
    faceMotionFile: model.faceMotionFile,
  }));
}
