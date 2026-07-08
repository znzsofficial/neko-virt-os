import Dexie, { type EntityTable } from "dexie";
import { nanoid } from "nanoid";

export type FsFile = {
  id: string;
  name: string;
  kind: "text";
  content: string;
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

db.on("populate", async () => {
  const now = Date.now();
  await db.files.bulkAdd([
    {
      id: "welcome-txt",
      name: "Welcome.txt",
      kind: "text",
      content:
        "NekoVirtOS boot note\n\n- Build the shell first.\n- Keep Neko details quiet and useful.\n- Make files feel trustworthy.\n\nnya://local/home/Welcome.txt",
      createdAt: now - 120000,
      updatedAt: now - 90000,
    },
    {
      id: "theme-notes-md",
      name: "Theme Notes.md",
      kind: "text",
      content:
        "# Quiet Neko Workstation\n\nA restrained product UI with neutral surfaces, configurable identity accents, and compact desktop density.\n\nAvoid generic SaaS, toy retro OS styling, and excessive anime decoration.",
      createdAt: now - 90000,
      updatedAt: now - 60000,
    },
  ]);
});

export async function listFiles() {
  return db.files.orderBy("updatedAt").reverse().toArray();
}

export async function createTextFile(name?: string, content = "") {
  const now = Date.now();
  const file: FsFile = {
    id: nanoid(10),
    name: name?.trim() || `Untitled-${new Date(now).toLocaleTimeString("en-GB").replaceAll(":", "")}.txt`,
    kind: "text",
    content,
    createdAt: now,
    updatedAt: now,
    trashed: false,
  };
  await db.files.add(file);
  return file;
}

export async function updateFileContent(id: string, content: string) {
  await db.files.update(id, { content, updatedAt: Date.now(), trashed: false, deletedAt: undefined });
}

export async function renameFile(id: string, name: string) {
  await db.files.update(id, { name: name.trim(), updatedAt: Date.now() });
}

export async function deleteFile(id: string) {
  await db.files.update(id, { trashed: true, deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function restoreFile(id: string) {
  await db.files.update(id, { trashed: false, deletedAt: undefined, updatedAt: Date.now() });
}

export async function permanentlyDeleteFile(id: string) {
  await db.files.delete(id);
}

export async function emptyTrash() {
  const trashed = await db.files.filter((file) => Boolean(file.trashed)).toArray();
  await db.files.bulkDelete(trashed.map((file) => file.id));
}
