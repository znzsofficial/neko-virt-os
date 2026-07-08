import { create } from "zustand";
import {
  createTextFile,
  deleteFile,
  emptyTrash,
  listFiles,
  permanentlyDeleteFile,
  renameFile,
  restoreFile,
  updateFileContent,
} from "./virtualFs";
import { findFileByName, getFileNameError } from "./fileUtils";
import type { FsStore } from "./types";

export const useFsStore = create<FsStore>((set, get) => ({
  files: [],
  selectedFileId: null,
  draft: "",
  loaded: false,
  dirty: false,
  init: async () => {
    const files = await listFiles();
    const activeFiles = files.filter((file) => !file.trashed);
    const selectedFileId = get().selectedFileId ?? activeFiles[0]?.id ?? null;
    const selectedFile = activeFiles.find((file) => file.id === selectedFileId) ?? activeFiles[0];
    set({
      files,
      selectedFileId: selectedFile?.id ?? null,
      draft: selectedFile?.content ?? "",
      loaded: true,
      dirty: false,
    });
  },
  selectFile: (id) => {
    const selectedFile = get().files.find((file) => file.id === id);
    if (!selectedFile) return;
    set({ selectedFileId: id, draft: selectedFile.content, dirty: false });
  },
  setDraft: (draft) => set({ draft, dirty: true }),
  createFile: async () => {
    const file = await createTextFile();
    const files = await listFiles();
    set({ files, selectedFileId: file.id, draft: file.content, dirty: false });
  },
  createNamedFile: async (name) => {
    const existing = findFileByName(get().files, name);
    if (existing) {
      set({ selectedFileId: existing.id, draft: existing.content, dirty: false });
      return { file: existing };
    }

    const error = getFileNameError(name, get().files);
    if (error) return { file: null, error };

    const file = await createTextFile(name.trim());
    const files = await listFiles();
    set({ files, selectedFileId: file.id, draft: file.content, dirty: false });
    return { file };
  },
  deleteSelectedFile: async () => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return;
    await deleteFile(selectedFileId);
    const files = await listFiles();
    const nextFile = files.find((file) => !file.trashed) ?? null;
    set({
      files,
      selectedFileId: nextFile?.id ?? null,
      draft: nextFile?.content ?? "",
      dirty: false,
    });
  },
  renameSelectedFile: async (name) => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return { file: null };
    const error = getFileNameError(name, get().files, selectedFileId);
    if (error) return { file: null, error };

    const nextName = name.trim();
    await renameFile(selectedFileId, nextName);
    const files = await listFiles();
    const renamed = files.find((file) => file.id === selectedFileId) ?? null;
    set({ files, selectedFileId, draft: renamed?.content ?? get().draft, dirty: false });
    return { file: renamed };
  },
  renameFileByName: async (fromName, toName) => {
    const file = findFileByName(get().files, fromName);
    if (!file) return { file: null, error: `${fromName}: no such file` };
    const error = getFileNameError(toName, get().files, file.id);
    if (error) return { file: null, error };

    await renameFile(file.id, toName.trim());
    const files = await listFiles();
    const renamed = files.find((item) => item.id === file.id) ?? null;
    set({ files, selectedFileId: file.id, draft: renamed?.content ?? file.content, dirty: false });
    return { file: renamed };
  },
  deleteFileByName: async (name) => {
    const file = findFileByName(get().files, name);
    if (!file) return null;
    await deleteFile(file.id);
    const files = await listFiles();
    const nextFile = files.find((item) => !item.trashed) ?? null;
    set({
      files,
      selectedFileId: nextFile?.id ?? null,
      draft: nextFile?.content ?? "",
      dirty: false,
    });
    return file;
  },
  restoreSelectedFile: async () => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return;
    await restoreFileWithUniqueName(selectedFileId, get().files);
    const files = await listFiles();
    const restored = files.find((file) => file.id === selectedFileId) ?? null;
    set({ files, selectedFileId, draft: restored?.content ?? "", dirty: false });
  },
  restoreFileById: async (id) => {
    await restoreFileWithUniqueName(id, get().files);
    const files = await listFiles();
    const restored = files.find((file) => file.id === id) ?? null;
    set({ files, selectedFileId: id, draft: restored?.content ?? "", dirty: false });
  },
  permanentlyDeleteSelectedFile: async () => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return;
    await permanentlyDeleteFile(selectedFileId);
    const files = await listFiles();
    const nextFile = files.find((file) => !file.trashed) ?? files.find((file) => file.trashed) ?? null;
    set({ files, selectedFileId: nextFile?.id ?? null, draft: nextFile?.content ?? "", dirty: false });
  },
  permanentlyDeleteFileById: async (id) => {
    await permanentlyDeleteFile(id);
    const files = await listFiles();
    const nextFile = get().selectedFileId === id ? files.find((file) => !file.trashed) ?? files.find((file) => file.trashed) ?? null : files.find((file) => file.id === get().selectedFileId) ?? null;
    set({ files, selectedFileId: nextFile?.id ?? null, draft: nextFile?.content ?? "", dirty: false });
  },
  emptyTrash: async () => {
    await emptyTrash();
    const files = await listFiles();
    const nextFile = files.find((file) => !file.trashed) ?? null;
    set({ files, selectedFileId: nextFile?.id ?? null, draft: nextFile?.content ?? "", dirty: false });
  },
  selectFileByName: (name) => {
    const file = findFileByName(get().files, name);
    if (!file) return null;
    set({ selectedFileId: file.id, draft: file.content, dirty: false });
    return file;
  },
  saveDraft: async () => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return;
    await updateFileContent(selectedFileId, get().draft);
    const files = await listFiles();
    set({ files, dirty: false });
  },
  saveFileDraft: async (id, draft) => {
    await updateFileContent(id, draft);
    const files = await listFiles();
    const selectedFile = files.find((file) => file.id === get().selectedFileId);
    set({ files, draft: selectedFile?.content ?? get().draft, dirty: get().selectedFileId === id ? false : get().dirty });
  },
}));

async function restoreFileWithUniqueName(id: string, files: ReturnType<typeof useFsStore.getState>["files"]) {
  const file = files.find((item) => item.id === id);
  if (!file) return;
  const activeNames = new Set(files.filter((item) => !item.trashed && item.id !== id).map((item) => item.name.toLowerCase()));
  let nextName = file.name;
  if (activeNames.has(nextName.toLowerCase())) {
    const dotIndex = file.name.lastIndexOf(".");
    const base = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
    const ext = dotIndex > 0 ? file.name.slice(dotIndex) : "";
    let index = 1;
    do {
      nextName = `${base} (restored ${index})${ext}`;
      index += 1;
    } while (activeNames.has(nextName.toLowerCase()));
    await renameFile(id, nextName);
  }
  await restoreFile(id);
}
