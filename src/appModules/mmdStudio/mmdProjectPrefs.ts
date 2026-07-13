import { createFolder, listFiles, createTextFile, updateFileContent, type FsFile } from "../../fs";
import { findEntryByNameInFolder } from "../../fs";

const FOLDER_KEY = "neko-virt-os.mmd-project-folder.v1";
const DEFAULT_FOLDER_NAME = "MMD Projects";

export function getMmdProjectFolderId(): string | null {
  try {
    const value = localStorage.getItem(FOLDER_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function setMmdProjectFolderId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(FOLDER_KEY);
    else localStorage.setItem(FOLDER_KEY, id);
  } catch {
    // ignore
  }
}

export async function listFolderCandidates(): Promise<FsFile[]> {
  const files = await listFiles();
  return files.filter((file) => file.kind === "folder" && !file.trashed);
}

export async function ensureMmdProjectFolder(preferredParentId: string | null = null): Promise<FsFile> {
  const files = await listFiles();
  const savedId = getMmdProjectFolderId();
  if (savedId) {
    const existing = files.find((file) => file.id === savedId && file.kind === "folder" && !file.trashed);
    if (existing) return existing;
  }

  const parentId = preferredParentId;
  const found = findEntryByNameInFolder(files, DEFAULT_FOLDER_NAME, parentId);
  if (found?.kind === "folder" && !found.trashed) {
    setMmdProjectFolderId(found.id);
    return found;
  }

  const folder = await createFolder(DEFAULT_FOLDER_NAME, parentId);
  setMmdProjectFolderId(folder.id);
  return folder;
}

export async function writeProjectCatalogEntry(entry: {
  id: string;
  name: string;
  updatedAt: number;
  modelCount: number;
}) {
  try {
    const folder = await ensureMmdProjectFolder();
    const files = await listFiles();
    const fileName = `${sanitizeFileStem(entry.name)}.mmdproj.json`;
    const payload = JSON.stringify(
      {
        format: "neko-mmd-project-catalog",
        version: 1,
        projectId: entry.id,
        name: entry.name,
        updatedAt: entry.updatedAt,
        modelCount: entry.modelCount,
        note: "Binary assets live in MMD Studio IndexedDB. This is a catalog pointer for the virtual filesystem.",
      },
      null,
      2,
    );
    const existing = findEntryByNameInFolder(files, fileName, folder.id);
    if (existing?.kind === "text") {
      await updateFileContent(existing.id, payload);
      return;
    }
    await createTextFile(fileName, payload, folder.id);
  } catch {
    // catalog is best-effort
  }
}

function sanitizeFileStem(name: string) {
  return (name.trim() || "untitled-project").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
}
