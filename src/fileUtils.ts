import type { FsFile } from "./virtualFs";
import type { FileSortMode } from "./types";

export function findFileByName(files: FsFile[], name: string) {
  const normalized = name.trim().toLowerCase();
  return files.find((file) => !file.trashed && file.name.toLowerCase() === normalized) ?? null;
}

export function getFileNameError(name: string, files: FsFile[], currentFileId?: string) {
  const nextName = name.trim();
  if (!nextName) return "File name cannot be empty.";
  if (/[\\/:*?"<>|]/.test(nextName)) return "File name contains unsupported characters.";
  const duplicate = files.find(
    (file) => !file.trashed && file.id !== currentFileId && file.name.toLowerCase() === nextName.toLowerCase(),
  );
  if (duplicate) return "A file with that name already exists.";
  return null;
}

export function sortFiles(files: FsFile[], sortMode: FileSortMode) {
  return [...files].sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name);
    if (sortMode === "size") return new Blob([b.content]).size - new Blob([a.content]).size;
    return b.updatedAt - a.updatedAt;
  });
}

export function formatFileSize(content: string) {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatFileTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(timestamp);
}
