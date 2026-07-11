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

export function pickPrimaryModel(files: File[]) {
  const models = findMmdModelFiles(files);
  return models[0] ?? null;
}

export function pickPrimaryMotion(files: File[]) {
  return findMmdMotionFiles(files)[0] ?? null;
}

export function pickBodyAndFaceMotions(files: File[]) {
  const motions = findMmdMotionFiles(files);
  if (!motions.length) return { body: null as File | null, face: null as File | null };

  const faces = motions.filter((file) => classifyMotionSlot(file) === "face");
  const bodies = motions.filter((file) => classifyMotionSlot(file) === "body");

  if (motions.length === 1) {
    return { body: motions[0], face: null };
  }

  if (bodies.length && faces.length) {
    return { body: bodies[0], face: faces[0] };
  }

  // Two+ motions without clear names: first = body, second = face (common pack layout).
  return { body: motions[0], face: motions[1] ?? null };
}

export function pickPrimaryAudio(files: File[]) {
  return findMmdAudioFiles(files)[0] ?? null;
}
