import { describe, expect, it } from "vitest";
import type { FsFile } from "./virtualFs";
import {
  findEntryByNameInFolder,
  getFileNameError,
  getMoveError,
  isFolderDescendant,
  splitFsPath,
} from "./fileUtils";

function file(partial: Partial<FsFile> & Pick<FsFile, "id" | "name" | "kind">): FsFile {
  return {
    content: "",
    parentId: null,
    createdAt: 1,
    updatedAt: 1,
    trashed: false,
    ...partial,
  };
}

const sample: FsFile[] = [
  file({ id: "root-a", name: "Docs", kind: "folder" }),
  file({ id: "nested", name: "Notes", kind: "folder", parentId: "root-a" }),
  file({ id: "leaf", name: "hello.txt", kind: "text", parentId: "nested", content: "hi" }),
  file({ id: "sibling", name: "readme.md", kind: "text", parentId: "root-a" }),
];

describe("splitFsPath", () => {
  it("normalizes home URI and slashes", () => {
    expect(splitFsPath("nya://local/home/Docs/Notes")).toEqual(["Docs", "Notes"]);
    expect(splitFsPath("/Docs\\Notes")).toEqual(["Docs", "Notes"]);
    expect(splitFsPath("")).toEqual([]);
  });
});

describe("getFileNameError", () => {
  it("rejects empty and illegal characters", () => {
    expect(getFileNameError("  ", sample, undefined, "root-a")).toBe("empty_name");
    expect(getFileNameError("bad:name", sample, undefined, "root-a")).toBe("invalid_characters");
  });

  it("detects duplicates in the same folder", () => {
    expect(getFileNameError("readme.md", sample, undefined, "root-a")).toBe("duplicate_name");
    expect(getFileNameError("readme.md", sample, "sibling", "root-a")).toBeNull();
  });
});

describe("getMoveError / isFolderDescendant", () => {
  it("blocks moving a folder into itself or a descendant", () => {
    expect(isFolderDescendant(sample, "root-a", "nested")).toBe(true);
    expect(getMoveError(sample, "root-a", "nested")).toBe("move_into_descendant");
    expect(getMoveError(sample, "root-a", "root-a")).toBe("move_into_self");
  });

  it("allows moving a file into another folder when name is free", () => {
    expect(getMoveError(sample, "leaf", "root-a")).toBeNull();
  });
});

describe("findEntryByNameInFolder", () => {
  it("finds case-insensitive names", () => {
    expect(findEntryByNameInFolder(sample, "HELLO.TXT", "nested")?.id).toBe("leaf");
    expect(findEntryByNameInFolder(sample, "missing", "nested")).toBeNull();
  });
});
