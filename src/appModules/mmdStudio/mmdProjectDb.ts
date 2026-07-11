import Dexie, { type EntityTable } from "dexie";
import type {
  MmdCameraMode,
  MmdExportBitrate,
  MmdExportCodec,
  MmdExportResolution,
  MmdPostFxPreset,
  MmdPostFxTune,
  MmdRendererBackend,
} from "./mmdStudioStore";

export type MmdLightSettings = {
  ambientIntensity: number;
  sunIntensity: number;
  sunAzimuth: number;
  sunElevation: number;
  sunCastShadow: boolean;
};

export type MmdProjectSettings = {
  backend: MmdRendererBackend;
  postFx: MmdPostFxPreset;
  postFxTune: MmdPostFxTune;
  cameraMode: MmdCameraMode;
  physicsEnabled: boolean;
  loop: boolean;
  speed: number;
  cameraMoveSpeed: number;
  currentTime: number;
  showGrid: boolean;
  skyAsBackground: boolean;
  skyAsEnvironment: boolean;
  envIntensity: number;
  lights: MmdLightSettings;
  exportResolution: MmdExportResolution;
  exportFps: 24 | 30 | 60 | 120;
  exportCodec: MmdExportCodec;
  exportBitrate: MmdExportBitrate;
  exportIncludeAudio: boolean;
  exportHideGrid: boolean;
  exportFilePrefix: string;
  exportIn: number;
  exportOut: number;
};

export type MmdProjectModelMeta = {
  id: string;
  name: string;
  visible: boolean;
  morphWeights: Record<string, number>;
  materialVisible: Record<string, boolean>;
  offsetX: number;
  modelAssetId: string;
  companionAssetIds: string[];
  bodyMotionAssetId: string | null;
  faceMotionAssetId: string | null;
};

export type MmdProjectRecord = {
  id: string;
  name: string;
  updatedAt: number;
  isAutosave: boolean;
  settings: MmdProjectSettings;
  models: MmdProjectModelMeta[];
  audioAssetId: string | null;
  audioName: string | null;
  hdrAssetId: string | null;
  hdrName: string | null;
};

export type MmdProjectAsset = {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  blob: Blob;
};

const db = new Dexie("NekoVirtOSMmdStudio") as Dexie & {
  projects: EntityTable<MmdProjectRecord, "id">;
  assets: EntityTable<MmdProjectAsset, "id">;
};

db.version(1).stores({
  projects: "id, updatedAt, isAutosave, name",
  assets: "id, projectId, name",
});

export const AUTOSAVE_PROJECT_ID = "mmd-autosave";

function assetId(projectId: string, key: string) {
  return `${projectId}::${key}`;
}

export async function listMmdProjects() {
  const rows = await db.projects.orderBy("updatedAt").reverse().toArray();
  return rows.filter((row) => !row.isAutosave);
}

export async function getMmdProject(id: string) {
  return (await db.projects.get(id)) ?? null;
}

export async function getMmdAutosave() {
  return getMmdProject(AUTOSAVE_PROJECT_ID);
}

export async function deleteMmdProject(id: string) {
  await db.transaction("rw", db.projects, db.assets, async () => {
    await db.assets.where("projectId").equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function loadMmdProjectAsset(assetId: string): Promise<File | null> {
  const row = await db.assets.get(assetId);
  if (!row) return null;
  return new File([row.blob], row.name, { type: row.mime || row.blob.type || "application/octet-stream" });
}

export type SaveMmdProjectInput = {
  id?: string;
  name: string;
  isAutosave?: boolean;
  settings: MmdProjectSettings;
  models: Array<{
    id: string;
    name: string;
    visible: boolean;
    morphWeights: Record<string, number>;
    materialVisible: Record<string, boolean>;
    offsetX: number;
    modelFile: File;
    companionFiles: File[];
    bodyMotionFile: File | null;
    faceMotionFile: File | null;
  }>;
  audioFile: File | null;
  audioName: string | null;
  hdrFile: File | null;
  hdrName: string | null;
};

export async function saveMmdProject(input: SaveMmdProjectInput) {
  const projectId = input.id || (input.isAutosave ? AUTOSAVE_PROJECT_ID : `mmd-project-${Date.now()}`);
  const assets: MmdProjectAsset[] = [];
  const models: MmdProjectModelMeta[] = [];

  for (const [index, model] of input.models.entries()) {
    const modelAsset = assetId(projectId, `model-${index}`);
    assets.push({
      id: modelAsset,
      projectId,
      name: model.modelFile.name,
      mime: model.modelFile.type || "application/octet-stream",
      blob: model.modelFile,
    });
    const companionAssetIds: string[] = [];
    for (const [cIndex, file] of model.companionFiles.entries()) {
      const cid = assetId(projectId, `model-${index}-tex-${cIndex}`);
      companionAssetIds.push(cid);
      assets.push({
        id: cid,
        projectId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        blob: file,
      });
    }
    let bodyMotionAssetId: string | null = null;
    if (model.bodyMotionFile) {
      bodyMotionAssetId = assetId(projectId, `model-${index}-body`);
      assets.push({
        id: bodyMotionAssetId,
        projectId,
        name: model.bodyMotionFile.name,
        mime: model.bodyMotionFile.type || "application/octet-stream",
        blob: model.bodyMotionFile,
      });
    }
    let faceMotionAssetId: string | null = null;
    if (model.faceMotionFile) {
      faceMotionAssetId = assetId(projectId, `model-${index}-face`);
      assets.push({
        id: faceMotionAssetId,
        projectId,
        name: model.faceMotionFile.name,
        mime: model.faceMotionFile.type || "application/octet-stream",
        blob: model.faceMotionFile,
      });
    }
    models.push({
      id: model.id,
      name: model.name,
      visible: model.visible,
      morphWeights: model.morphWeights,
      materialVisible: model.materialVisible,
      offsetX: model.offsetX,
      modelAssetId: modelAsset,
      companionAssetIds,
      bodyMotionAssetId,
      faceMotionAssetId,
    });
  }

  let audioAssetId: string | null = null;
  if (input.audioFile) {
    audioAssetId = assetId(projectId, "audio");
    assets.push({
      id: audioAssetId,
      projectId,
      name: input.audioFile.name,
      mime: input.audioFile.type || "audio/*",
      blob: input.audioFile,
    });
  }

  let hdrAssetId: string | null = null;
  if (input.hdrFile) {
    hdrAssetId = assetId(projectId, "hdr");
    assets.push({
      id: hdrAssetId,
      projectId,
      name: input.hdrFile.name,
      mime: input.hdrFile.type || "application/octet-stream",
      blob: input.hdrFile,
    });
  }

  const record: MmdProjectRecord = {
    id: projectId,
    name: input.name,
    updatedAt: Date.now(),
    isAutosave: Boolean(input.isAutosave),
    settings: input.settings,
    models,
    audioAssetId,
    audioName: input.audioName,
    hdrAssetId,
    hdrName: input.hdrName,
  };

  await db.transaction("rw", db.projects, db.assets, async () => {
    await db.assets.where("projectId").equals(projectId).delete();
    await db.projects.put(record);
    if (assets.length) await db.assets.bulkPut(assets);
  });

  return record;
}

export function sunPositionFromAngles(azimuthDeg: number, elevationDeg: number, distance = 12): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const x = distance * Math.cos(el) * Math.sin(az);
  const y = distance * Math.sin(el);
  const z = distance * Math.cos(el) * Math.cos(az);
  return [x, y, z];
}
