import Dexie, { type EntityTable } from "dexie";
import { nanoid } from "nanoid";
import { useLanguageStore } from "../languageStore";
import { runPersistedWrite } from "../system/persistenceGate";
import { getUniqueFileName } from "./fileUtils";

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
  return runPersistedWrite(async () => {
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
  });
}

export async function createFolder(name: string, parentId: string | null = null) {
  return runPersistedWrite(async () => {
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
  });
}

export async function updateFileContent(id: string, content: string) {
  await runPersistedWrite(() => db.files.update(id, { content, updatedAt: Date.now() }));
}

export async function touchFile(id: string) {
  await runPersistedWrite(() => db.files.update(id, { updatedAt: Date.now() }));
}

export async function renameFile(id: string, name: string) {
  await runPersistedWrite(() => db.files.update(id, { name: name.trim(), updatedAt: Date.now() }));
}

export async function moveFile(id: string, parentId: string | null) {
  await runPersistedWrite(() => db.files.update(id, { parentId, updatedAt: Date.now() }));
}

export async function deleteFile(id: string) {
  await deleteFiles([id]);
}

export async function deleteFiles(ids: string[]) {
  return runPersistedWrite(async () => {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return;
    await db.transaction("rw", db.files, async () => {
      const files = await db.files.toArray();
      const idSet = new Set<string>();
      for (const id of unique) {
        for (const entryId of collectDescendantIds(id, files)) idSet.add(entryId);
      }
      const deletedAt = Date.now();
      await Promise.all([...idSet].map((entryId) => db.files.update(entryId, { trashed: true, deletedAt, updatedAt: deletedAt })));
    });
  });
}

export async function restoreFile(id: string) {
  return runPersistedWrite(async () => {
    const updatedAt = Date.now();
    await db.transaction("rw", db.files, async () => {
      const files = await db.files.toArray();
      const fileMap = new Map(files.map((file) => [file.id, file]));
      const ids = new Set(collectDescendantIds(id, files));
      const ancestorChain: string[] = [];
      let cursor = fileMap.get(id)?.parentId ?? null;
      while (cursor && !ids.has(cursor)) {
        ancestorChain.push(cursor);
        ids.add(cursor);
        cursor = fileMap.get(cursor)?.parentId ?? null;
      }
      const restoreOrder: string[] = [];
      for (let index = ancestorChain.length - 1; index >= 0; index -= 1) restoreOrder.push(ancestorChain[index]);
      const queue = [id];
      const enqueued = new Set<string>([id]);
      for (let index = 0; index < queue.length; index += 1) {
        const currentId = queue[index];
        restoreOrder.push(currentId);
        for (const file of files) {
          if (file.parentId === currentId && ids.has(file.id) && !enqueued.has(file.id)) {
            enqueued.add(file.id);
            queue.push(file.id);
          }
        }
      }
      const childrenByParent = new Map<string | null, FsFile[]>();
      for (const file of files) {
        const parentKey = file.parentId ?? null;
        const siblings = childrenByParent.get(parentKey);
        if (siblings) siblings.push(file);
        else childrenByParent.set(parentKey, [file]);
      }
      const finalNames = new Map<string, string>();
      for (const entryId of restoreOrder) {
        const file = fileMap.get(entryId);
        if (!file) continue;
        const wasTrashed = Boolean(file.trashed);
        const siblings = childrenByParent.get(file.parentId ?? null) ?? [];
        const takenNames = siblings.flatMap((sibling) => {
          if (sibling.id === entryId) return [];
          if (ids.has(sibling.id)) return [finalNames.get(sibling.id) ?? sibling.name];
          return sibling.trashed ? [] : [sibling.name];
        });
        const nextName = wasTrashed ? getUniqueFileName(file.name, takenNames) : file.name;
        finalNames.set(entryId, nextName);
        if (!wasTrashed) continue;
        await db.files.update(
          entryId,
          nextName !== file.name
            ? { name: nextName, trashed: false, deletedAt: undefined, updatedAt }
            : { trashed: false, deletedAt: undefined, updatedAt },
        );
      }
    });
  });
}

export async function permanentlyDeleteFile(id: string) {
  return runPersistedWrite(async () => {
    await db.transaction("rw", db.files, async () => {
      const files = await db.files.toArray();
      const ids = collectDescendantIds(id, files);
      const idSet = new Set(ids);
      const fileMap = new Map(files.map((file) => [file.id, file]));
      const takenNames = new Set(
        files
          .filter((file) => !idSet.has(file.id) && !file.trashed && (file.parentId ?? null) === null)
          .map((file) => file.name.toLowerCase()),
      );
      const rescuedRootIds = new Set<string>();
      const updatedAt = Date.now();
      for (const file of files) {
        if (file.trashed || file.id === id || !idSet.has(file.id)) continue;
        let current = file;
        let parent = current.parentId != null ? fileMap.get(current.parentId) : undefined;
        while (parent && parent.id !== id && idSet.has(parent.id) && !parent.trashed) {
          current = parent;
          parent = current.parentId != null ? fileMap.get(current.parentId) : undefined;
        }
        if (parent && parent.id !== id && !idSet.has(parent.id) && !parent.trashed) continue;
        if (rescuedRootIds.has(current.id)) continue;
        if ((current.parentId ?? null) === null && !takenNames.has(current.name.toLowerCase())) {
          rescuedRootIds.add(current.id);
          continue;
        }
        const nextName = getUniqueFileName(current.name, [...takenNames]);
        takenNames.add(nextName.toLowerCase());
        rescuedRootIds.add(current.id);
        await db.files.update(current.id, { name: nextName, parentId: null, updatedAt });
      }
      const freshFiles = await db.files.toArray();
      const keepIds = new Set<string>(rescuedRootIds);
      for (const rootId of rescuedRootIds) {
        for (const entryId of collectDescendantIds(rootId, freshFiles)) keepIds.add(entryId);
      }
      await db.files.bulkDelete(ids.filter((entryId) => !keepIds.has(entryId)));
    });
  });
}

export async function emptyTrash() {
  return runPersistedWrite(async () => {
    await db.transaction("rw", db.files, async () => {
      const trashed = await db.files.filter((file) => Boolean(file.trashed)).toArray();
      await db.files.bulkDelete(trashed.map((file) => file.id));
    });
  });
}

export async function resetVirtualFiles() {
  await runPersistedWrite(() =>
    db.transaction("rw", db.files, async () => {
      await db.files.clear();
      await seedFiles();
    }),
  );
}

export async function clearVirtualFilesForSiteReset() {
  await db.delete();
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
