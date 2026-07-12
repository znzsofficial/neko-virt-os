import {
  fileWithRelativePath,
  getMmdProject,
  loadMmdProjectAsset,
  saveMmdProject,
  type MmdProjectRecord,
  type SaveMmdProjectInput,
} from "./mmdProjectDb";
import { writeProjectCatalogEntry } from "./mmdProjectPrefs";

export const MMD_PROJECT_PACKAGE_FORMAT = "neko-mmd-project";
export const MMD_PROJECT_PACKAGE_VERSION = 1;

type PackageAsset = {
  key: string;
  name: string;
  mime: string;
  dataBase64: string;
  relativePath?: string;
};

export type MmdProjectPackage = {
  format: typeof MMD_PROJECT_PACKAGE_FORMAT;
  version: typeof MMD_PROJECT_PACKAGE_VERSION;
  exportedAt: number;
  project: {
    name: string;
    settings: MmdProjectRecord["settings"];
    models: MmdProjectRecord["models"];
    audioName: string | null;
    hdrName: string | null;
    audioAssetKey: string | null;
    hdrAssetKey: string | null;
  };
  assets: PackageAsset[];
};

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToFile(base64: string, name: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime || "application/octet-stream" });
}

export async function buildMmdProjectPackage(projectId: string): Promise<{ blob: Blob; fileName: string; record: MmdProjectRecord }> {
  const record = await getMmdProject(projectId);
  if (!record || record.isAutosave) throw new Error("Project not found");

  const assets: PackageAsset[] = [];
  const pushAsset = async (key: string, assetId: string | null | undefined) => {
    if (!assetId) return;
    const file = await loadMmdProjectAsset(assetId);
    if (!file) return;
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    assets.push({
      key,
      name: file.name,
      mime: file.type || "application/octet-stream",
      dataBase64: await blobToBase64(file),
      relativePath,
    });
  };

  for (const [index, model] of record.models.entries()) {
    await pushAsset(`model-${index}`, model.modelAssetId);
    for (const [cIndex, companionId] of model.companionAssetIds.entries()) {
      await pushAsset(`model-${index}-tex-${cIndex}`, companionId);
    }
    await pushAsset(`model-${index}-body`, model.bodyMotionAssetId);
    await pushAsset(`model-${index}-face`, model.faceMotionAssetId);
    await pushAsset(`model-${index}-camera`, model.cameraMotionAssetId);
  }
  await pushAsset("audio", record.audioAssetId);
  await pushAsset("hdr", record.hdrAssetId);

  const pack: MmdProjectPackage = {
    format: MMD_PROJECT_PACKAGE_FORMAT,
    version: MMD_PROJECT_PACKAGE_VERSION,
    exportedAt: Date.now(),
    project: {
      name: record.name,
      settings: record.settings,
      models: record.models,
      audioName: record.audioName,
      hdrName: record.hdrName,
      audioAssetKey: record.audioAssetId ? "audio" : null,
      hdrAssetKey: record.hdrAssetId ? "hdr" : null,
    },
    assets,
  };

  const text = JSON.stringify(pack);
  const blob = new Blob([text], { type: "application/json" });
  const safe = (record.name.trim() || "mmd-project").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
  return { blob, fileName: `${safe}.mmdstudio.json`, record };
}

export async function importMmdProjectPackage(file: File): Promise<MmdProjectRecord> {
  const text = await file.text();
  let pack: MmdProjectPackage;
  try {
    pack = JSON.parse(text) as MmdProjectPackage;
  } catch {
    throw new Error("Invalid project package");
  }
  if (pack.format !== MMD_PROJECT_PACKAGE_FORMAT || pack.version !== MMD_PROJECT_PACKAGE_VERSION) {
    throw new Error("Unsupported project package version");
  }
  if (!pack.project?.settings || !Array.isArray(pack.project.models) || !Array.isArray(pack.assets)) {
    throw new Error("Malformed project package");
  }

  const byKey = new Map(pack.assets.map((asset) => [asset.key, asset]));
  const resolveFile = (key: string | null | undefined) => {
    if (!key) return null;
    const asset = byKey.get(key);
    if (!asset) return null;
    const blob = (() => {
      const binary = atob(asset.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: asset.mime || "application/octet-stream" });
    })();
    return fileWithRelativePath(blob, asset.name, asset.mime, asset.relativePath ?? asset.name);
  };

  const models: SaveMmdProjectInput["models"] = pack.project.models.map((model, index) => {
    const modelFile = resolveFile(`model-${index}`) ?? resolveFile(model.modelAssetId);
    if (!modelFile) throw new Error(`Missing model asset: ${model.name}`);
    const companionFiles: File[] = [];
    for (let cIndex = 0; cIndex < model.companionAssetIds.length; cIndex += 1) {
      const companion = resolveFile(`model-${index}-tex-${cIndex}`) ?? resolveFile(model.companionAssetIds[cIndex]);
      if (companion) companionFiles.push(companion);
    }
    const bodyMotionFile = resolveFile(`model-${index}-body`) ?? resolveFile(model.bodyMotionAssetId);
    const faceMotionFile = resolveFile(`model-${index}-face`) ?? resolveFile(model.faceMotionAssetId);
    const cameraMotionFile = resolveFile(`model-${index}-camera`) ?? resolveFile(model.cameraMotionAssetId);
    const transform = model.transform ?? {
      positionX: model.offsetX ?? 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    };
    return {
      id: model.id || `imported-model-${index}`,
      name: model.name,
      visible: model.visible !== false,
      morphWeights: model.morphWeights ?? {},
      morphFavorites: model.morphFavorites ?? [],
      materialVisible: model.materialVisible ?? {},
      materialOverrides: model.materialOverrides ?? {},
      transform,
      modelFile,
      companionFiles: companionFiles.length ? companionFiles : [modelFile],
      bodyMotionFile,
      faceMotionFile,
      cameraMotionFile,
    };
  });

  const audioFile = resolveFile(pack.project.audioAssetKey) ?? resolveFile("audio");
  const hdrFile = resolveFile(pack.project.hdrAssetKey) ?? resolveFile("hdr");

  const record = await saveMmdProject({
    name: pack.project.name || file.name.replace(/\.mmdstudio\.json$/i, "") || "Imported Project",
    settings: pack.project.settings,
    models,
    audioFile,
    audioName: pack.project.audioName ?? audioFile?.name ?? null,
    hdrFile,
    hdrName: pack.project.hdrName ?? hdrFile?.name ?? null,
  });

  await writeProjectCatalogEntry({
    id: record.id,
    name: record.name,
    updatedAt: record.updatedAt,
    modelCount: record.models.length,
  });

  return record;
}

export function triggerPackageDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 60_000);
  return url;
}
