import type { FileMutationErrorCode, FileSortMode } from "../types";
import type { FsFile } from "./virtualFs";

export function findFileByName(files: FsFile[], name: string) {
  const normalized = name.trim().toLowerCase();
  return files.find((file) => !file.trashed && file.name.toLowerCase() === normalized) ?? null;
}

export function findEntryByNameInFolder(files: FsFile[], name: string, parentId: string | null) {
  const normalized = name.trim().toLowerCase();
  return files.find((file) => !file.trashed && (file.parentId ?? null) === parentId && file.name.toLowerCase() === normalized) ?? null;
}

export function splitFsPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return [];
  const normalized = trimmed.replace(/^nya:\/\/local\/home/i, "/").replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean);
}

export function resolveFolderPath(files: FsFile[], currentFolderId: string | null, path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === ".") return { folderId: currentFolderId, error: null as string | null };

  const absolute = trimmed.startsWith("/") || /^nya:\/\/local\/home/i.test(trimmed) || trimmed === "~";
  const parts = splitFsPath(trimmed === "~" ? "/" : trimmed);
  let folderId = absolute ? null : currentFolderId;

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      const currentFolder = files.find((file) => file.id === folderId && file.kind === "folder" && !file.trashed) ?? null;
      folderId = currentFolder?.parentId ?? null;
      continue;
    }
    const nextFolder = files.find(
      (file) => !file.trashed && file.kind === "folder" && (file.parentId ?? null) === folderId && file.name.toLowerCase() === part.toLowerCase(),
    ) ?? null;
    if (!nextFolder) return { folderId, error: part };
    folderId = nextFolder.id;
  }

  return { folderId, error: null as string | null };
}

export function resolveEntryPath(files: FsFile[], currentFolderId: string | null, path: string) {
  const parts = splitFsPath(path);
  if (!parts.length) return { file: null, error: path.trim() || "." };

  const trimmed = path.trim();
  const absolute = trimmed.startsWith("/") || /^nya:\/\/local\/home/i.test(trimmed);
  const parentPath = parts.slice(0, -1).join("/");
  const entryName = parts[parts.length - 1];
  const resolvedParent = resolveFolderPath(files, absolute ? null : currentFolderId, parentPath || ".");
  if (resolvedParent.error) return { file: null, error: path.trim() };
  return { file: findEntryByNameInFolder(files, entryName, resolvedParent.folderId), error: null as string | null };
}

export function isFolderDescendant(files: FsFile[], folderId: string, parentCandidateId: string | null) {
  let cursor = parentCandidateId;
  while (cursor) {
    if (cursor === folderId) return true;
    const current = files.find((file) => file.id === cursor && file.kind === "folder") ?? null;
    cursor = current?.parentId ?? null;
  }
  return false;
}

export function getFileNameError(name: string, files: FsFile[], currentFileId?: string, parentId?: string | null): FileMutationErrorCode | null {
  const nextName = name.trim();
  if (!nextName) return "empty_name";
  if (/[\\/:*?"<>|]/.test(nextName)) return "invalid_characters";
  const duplicate = files.find(
    (file) => !file.trashed && file.id !== currentFileId && (file.parentId ?? null) === (parentId ?? null) && file.name.toLowerCase() === nextName.toLowerCase(),
  );
  if (duplicate) return "duplicate_name";
  return null;
}

export function getMoveError(files: FsFile[], fileId: string, parentId: string | null): FileMutationErrorCode | null {
  const file = files.find((item) => item.id === fileId) ?? null;
  if (!file) return "not_found";
  if (file.id === parentId) return "move_into_self";
  if (file.kind === "folder" && isFolderDescendant(files, file.id, parentId)) return "move_into_descendant";
  return getFileNameError(file.name, files, file.id, parentId);
}

export function sortFiles(files: FsFile[], sortMode: FileSortMode) {
  return [...files].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    if (sortMode === "name") return a.name.localeCompare(b.name);
    if (sortMode === "size") return new Blob([b.content]).size - new Blob([a.content]).size;
    return b.updatedAt - a.updatedAt;
  });
}

export function formatFileSize(content: string) {
  // Keep short labels for narrow terminal columns; full formatBytes is elsewhere.
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFileTime(timestamp: number, locale: "zh" | "en" = "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(timestamp);
}
