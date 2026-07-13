import Dexie, { type EntityTable } from "dexie";
import { nanoid } from "nanoid";
import { useLanguageStore } from "../languageStore";

export type FsFile = {
  id: string;
  name: string;
  kind: "text" | "folder";
  content: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;
  deletedAt?: number;
};

const db = new Dexie("NekoVirtOS") as Dexie & {
  files: EntityTable<FsFile, "id">;
};

db.version(1).stores({
  files: "id, name, kind, updatedAt",
});

db.version(2).stores({
  files: "id, name, kind, updatedAt, trashed, deletedAt",
});

db.version(3).stores({
  files: "id, name, kind, parentId, updatedAt, trashed, deletedAt",
});

db.on("populate", async () => {
  await seedFiles();
});

async function seedFiles() {
  const now = Date.now();
  const t = useLanguageStore.getState().t;
  await db.files.bulkAdd([
    {
      id: "workspace-folder",
      name: t("seededWorkspaceFolder"),
      kind: "folder",
      content: "",
      parentId: null,
      createdAt: now - 150000,
      updatedAt: now - 100000,
      trashed: false,
    },
    {
      id: "welcome-txt",
      name: t("seededWelcomeFile"),
      kind: "text",
      content: t("seededWelcomeContent"),
      parentId: null,
      createdAt: now - 120000,
      updatedAt: now - 90000,
      trashed: false,
    },
    {
      id: "theme-notes-md",
      name: t("seededThemeNotesFile"),
      kind: "text",
      content: t("seededThemeNotesContent"),
      parentId: "workspace-folder",
      createdAt: now - 90000,
      updatedAt: now - 60000,
      trashed: false,
    },
  ]);
}

export async function listFiles() {
  return db.files.orderBy("updatedAt").reverse().toArray();
}

export async function createTextFile(name?: string, content = "", parentId: string | null = null) {
  const now = Date.now();
  const t = useLanguageStore.getState().t;
  const file: FsFile = {
    id: nanoid(10),
    name: name?.trim() || `${t("defaultUntitledPrefix")}${new Date(now).toLocaleTimeString("en-GB").replaceAll(":", "")}.txt`,
    kind: "text",
    content,
    parentId,
    createdAt: now,
    updatedAt: now,
    trashed: false,
  };
  await db.files.add(file);
  return file;
}

export async function createFolder(name: string, parentId: string | null = null) {
  const now = Date.now();
  const folder: FsFile = {
    id: nanoid(10),
    name: name.trim(),
    kind: "folder",
    content: "",
    parentId,
    createdAt: now,
    updatedAt: now,
    trashed: false,
  };
  await db.files.add(folder);
  return folder;
}

export async function updateFileContent(id: string, content: string) {
  await db.files.update(id, { content, updatedAt: Date.now(), trashed: false, deletedAt: undefined });
}

export async function touchFile(id: string) {
  await db.files.update(id, { updatedAt: Date.now() });
}

export async function renameFile(id: string, name: string) {
  await db.files.update(id, { name: name.trim(), updatedAt: Date.now() });
}

export async function moveFile(id: string, parentId: string | null) {
  await db.files.update(id, { parentId, updatedAt: Date.now() });
}

export async function deleteFile(id: string) {
  const files = await db.files.toArray();
  const ids = collectDescendantIds(id, files);
  const deletedAt = Date.now();
  await db.transaction("rw", db.files, async () => {
    await Promise.all(ids.map((entryId) => db.files.update(entryId, { trashed: true, deletedAt, updatedAt: deletedAt })));
  });
}

export async function restoreFile(id: string) {
  const files = await db.files.toArray();
  const ids = collectDescendantIds(id, files);
  const updatedAt = Date.now();
  await db.transaction("rw", db.files, async () => {
    await Promise.all(ids.map((entryId) => db.files.update(entryId, { trashed: false, deletedAt: undefined, updatedAt })));
  });
}

export async function permanentlyDeleteFile(id: string) {
  const files = await db.files.toArray();
  const ids = collectDescendantIds(id, files);
  await db.files.bulkDelete(ids);
}

export async function emptyTrash() {
  const trashed = await db.files.filter((file) => Boolean(file.trashed)).toArray();
  await db.files.bulkDelete(trashed.map((file) => file.id));
}

export async function resetVirtualFiles() {
  await db.files.clear();
  await seedFiles();
}

function collectDescendantIds(id: string, files: FsFile[]) {
  const ids = [id];
  for (let index = 0; index < ids.length; index += 1) {
    const currentId = ids[index];
    for (const file of files) {
      if (file.parentId === currentId) ids.push(file.id);
    }
  }
  return ids;
}
