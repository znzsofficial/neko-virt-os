import { findMmdAudioFiles, findMmdModelFiles, findMmdMotionFiles } from "@yohawing/three-mmd-loader";
import { classifyMotionSlot } from "./mmdUtils";

/** Recursively collect files from a dropped directory entry. */
export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  if (!items.length) return Array.from(dataTransfer.files ?? []);

  const files: File[] = [];

  async function walkEntry(entry: FileSystemEntry | null) {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
      });
      if (file) {
        const withPath = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
        Object.defineProperty(withPath, "webkitRelativePath", {
          value: entry.fullPath.replace(/^\//, ""),
          writable: false,
        });
        files.push(withPath);
      }
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = () => new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      let batch = await readBatch();
      while (batch.length) {
        for (const child of batch) await walkEntry(child);
        batch = await readBatch();
      }
    }
  }

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() ?? null;
    if (entry) await walkEntry(entry);
    else if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  return files.length ? files : Array.from(dataTransfer.files ?? []);
}

export function modelRelativePath(file: File) {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return path.replaceAll("\\", "/");
}

/** Directory portion of webkitRelativePath (or empty for bare files). */
export function relativeDirOf(file: File) {
  const normalized = modelRelativePath(file);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}

export function listModelFiles(files: File[]) {
  const models = findMmdModelFiles(files);
  return [...models].sort((a, b) => {
    const da = relativeDirOf(a);
    const db = relativeDirOf(b);
    if (da !== db) return da.localeCompare(db, "zh");
    return a.name.localeCompare(b.name, "zh");
  });
}

export function pickPrimaryModel(files: File[]) {
  const models = listModelFiles(files);
  return models[0] ?? null;
}

/**
 * Default multi-select: prefer one model per directory (typical pack layout),
 * otherwise select all when they share a single folder.
 */
export function defaultSelectedModels(models: File[]) {
  const selected: Record<string, boolean> = {};
  if (!models.length) return selected;
  const byDir = new Map<string, File[]>();
  for (const model of models) {
    const dir = relativeDirOf(model) || ".";
    const list = byDir.get(dir) ?? [];
    list.push(model);
    byDir.set(dir, list);
  }
  if (byDir.size === 1) {
    for (const model of models) selected[modelRelativePath(model)] = true;
    return selected;
  }
  // Multiple subfolders: pick first model in each folder by default.
  for (const list of byDir.values()) {
    const first = list[0];
    if (first) selected[modelRelativePath(first)] = true;
    for (let i = 1; i < list.length; i += 1) {
      selected[modelRelativePath(list[i]!)] = false;
    }
  }
  return selected;
}

/**
 * Companion pack for a model: prefer files under the same relative directory
 * (and nested), fall back to the full drop set so loose tex packs still resolve.
 */
export function companionsForModel(modelFile: File, allFiles: File[]) {
  const dir = relativeDirOf(modelFile);
  if (!dir) return allFiles.length ? allFiles : [modelFile];
  const prefix = `${dir}/`;
  const nested = allFiles.filter((file) => {
    const full = modelRelativePath(file);
    return full === modelRelativePath(modelFile) || full.startsWith(prefix) || relativeDirOf(file) === dir;
  });
  // Always include the model itself.
  if (!nested.some((file) => modelRelativePath(file) === modelRelativePath(modelFile))) {
    nested.unshift(modelFile);
  }
  return nested.length > 1 ? nested : allFiles.length ? allFiles : [modelFile];
}

export function pickPrimaryMotion(files: File[]) {
  return findMmdMotionFiles(files)[0] ?? null;
}

export function pickBodyAndFaceMotions(files: File[]) {
  const motions = findMmdMotionFiles(files);
  if (!motions.length) {
    return { body: null as File | null, face: null as File | null, camera: null as File | null };
  }

  const cameras = motions.filter((file) => classifyMotionSlot(file) === "camera");
  const faces = motions.filter((file) => classifyMotionSlot(file) === "face");
  const bodies = motions.filter((file) => classifyMotionSlot(file) === "body");

  if (motions.length === 1) {
    const only = motions[0]!;
    const slot = classifyMotionSlot(only);
    if (slot === "camera") return { body: null, face: null, camera: only };
    if (slot === "face") return { body: null, face: only, camera: null };
    return { body: only, face: null, camera: null };
  }

  // Prefer name-based slots when available.
  if (bodies.length || faces.length || cameras.length) {
    return {
      body: bodies[0] ?? null,
      face: faces[0] ?? null,
      camera: cameras[0] ?? null,
    };
  }

  // Unnamed multi-motion packs: first body, second face, third camera.
  return {
    body: motions[0] ?? null,
    face: motions[1] ?? null,
    camera: motions[2] ?? null,
  };
}

export function pickPrimaryAudio(files: File[]) {
  return findMmdAudioFiles(files)[0] ?? null;
}
