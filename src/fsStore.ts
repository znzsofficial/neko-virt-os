import { create } from "zustand";
import {
  createFolder as createFolderEntry,
  createTextFile,
  deleteFile,
  emptyTrash,
  listFiles,
  moveFile,
  permanentlyDeleteFile,
  renameFile,
  resetVirtualFiles,
  restoreFile,
  touchFile,
  updateFileContent,
} from "./virtualFs";
import { findEntryByNameInFolder, findFileByName, getFileNameError, getMoveError } from "./fileUtils";
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
      draft: selectedFile?.kind === "text" ? selectedFile.content : "",
      loaded: true,
      dirty: false,
    });
  },
  selectFile: (id) => {
    const selectedFile = get().files.find((file) => file.id === id);
    if (!selectedFile) return;
    set({ selectedFileId: id, draft: selectedFile.kind === "text" ? selectedFile.content : "", dirty: false });
  },
  setDraft: (draft) => set({ draft, dirty: true }),
  createFile: async (parentId = null) => {
    const file = await createTextFile(undefined, "", parentId);
    const files = await listFiles();
    set({ files, selectedFileId: file.id, draft: file.content, dirty: false });
    return file;
  },
  createNamedFile: async (name, parentId = null) => {
    const existing = findEntryByNameInFolder(get().files, name, parentId);
    if (existing?.kind === "text") {
      set({ selectedFileId: existing.id, draft: existing.content, dirty: false });
      return { file: existing };
    }
    if (existing?.kind === "folder") return { file: null, error: "duplicate_name" };

    const error = getFileNameError(name, get().files, undefined, parentId);
    if (error) return { file: null, error };

    const file = await createTextFile(name.trim(), "", parentId);
    const files = await listFiles();
    set({ files, selectedFileId: file.id, draft: file.content, dirty: false });
    return { file };
  },
  touchFileById: async (id) => {
    const file = get().files.find((item) => item.id === id) ?? null;
    if (!file || file.trashed) return null;
    await touchFile(id);
    const files = await listFiles();
    const next = files.find((item) => item.id === id) ?? null;
    set({ files });
    return next;
  },
  createFolder: async (name, parentId = null) => {
    const error = getFileNameError(name, get().files, undefined, parentId);
    if (error) return { file: null, error };

    const folder = await createFolderEntry(name.trim(), parentId);
    const files = await listFiles();
    set({ files, selectedFileId: folder.id, draft: "", dirty: false });
    return { file: folder };
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
    const selectedFile = get().files.find((file) => file.id === selectedFileId) ?? null;
    const error = getFileNameError(name, get().files, selectedFileId, selectedFile?.parentId ?? null);
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
    if (!file) return { file: null, error: "not_found" };
    const error = getFileNameError(toName, get().files, file.id, file.parentId ?? null);
    if (error) return { file: null, error };

    await renameFile(file.id, toName.trim());
    const files = await listFiles();
    const renamed = files.find((item) => item.id === file.id) ?? null;
    set({ files, selectedFileId: file.id, draft: renamed?.content ?? file.content, dirty: false });
    return { file: renamed };
  },
  renameFileById: async (id, name) => {
    const file = get().files.find((item) => item.id === id) ?? null;
    if (!file) return { file: null, error: "not_found" };
    const error = getFileNameError(name, get().files, file.id, file.parentId ?? null);
    if (error) return { file: null, error };

    await renameFile(file.id, name.trim());
    const files = await listFiles();
    const renamed = files.find((item) => item.id === file.id) ?? null;
    set({ files, selectedFileId: file.id, draft: renamed?.kind === "text" ? renamed.content : "", dirty: false });
    return { file: renamed };
  },
  moveFileById: async (id, parentId) => {
    const file = get().files.find((item) => item.id === id) ?? null;
    const error = getMoveError(get().files, id, parentId);
    if (error) return { file: null, error };

    await moveFile(id, parentId);
    const files = await listFiles();
    const moved = files.find((item) => item.id === id) ?? null;
    set({ files, selectedFileId: moved?.id ?? get().selectedFileId, draft: moved?.kind === "text" ? moved.content : "", dirty: false });
    return { file: moved };
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
  deleteFileById: async (id) => {
    const file = get().files.find((item) => item.id === id) ?? null;
    if (!file) return null;
    await deleteFile(id);
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
  resetVirtualFiles: async () => {
    await resetVirtualFiles();
    const files = await listFiles();
    const nextFile = files.find((file) => !file.trashed) ?? null;
    set({ files, selectedFileId: nextFile?.id ?? null, draft: nextFile?.content ?? "", dirty: false, loaded: true });
  },
  selectFileByName: (name) => {
    const file = findFileByName(get().files, name);
    if (!file) return null;
    set({ selectedFileId: file.id, draft: file.kind === "text" ? file.content : "", dirty: false });
    return file;
  },
  saveDraft: async () => {
    const selectedFileId = get().selectedFileId;
    if (!selectedFileId) return;
    const selectedFile = get().files.find((file) => file.id === selectedFileId);
    if (!selectedFile || selectedFile.kind !== "text") return;
    await updateFileContent(selectedFileId, get().draft);
    const files = await listFiles();
    set({ files, dirty: false });
  },
  saveFileDraft: async (id, draft) => {
    const file = get().files.find((item) => item.id === id);
    if (!file || file.kind !== "text") return;
    await updateFileContent(id, draft);
    const files = await listFiles();
    const selectedFile = files.find((file) => file.id === get().selectedFileId);
    set({ files, draft: selectedFile?.kind === "text" ? selectedFile.content : get().draft, dirty: get().selectedFileId === id ? false : get().dirty });
  },
}));

async function restoreFileWithUniqueName(id: string, files: ReturnType<typeof useFsStore.getState>["files"]) {
  const file = files.find((item) => item.id === id);
  if (!file) return;
  const targetParentId = file.parentId ?? null;
  const activeNames = new Set(
    files
      .filter((item) => !item.trashed && item.id !== id && (item.parentId ?? null) === targetParentId)
      .map((item) => item.name.toLowerCase()),
  );
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
