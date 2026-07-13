import { afterEach, describe, expect, it } from "vitest";
import {
  clearFilesBridgeHandlersForTest,
  openFilesFolder,
  registerFilesBridgeHandlers,
  startFilesCreateFile,
  startFilesCreateFolder,
} from "./filesBridge";

afterEach(() => {
  clearFilesBridgeHandlersForTest();
});

describe("filesBridge", () => {
  it("invokes registered handlers without store churn", () => {
    const calls: string[] = [];
    const dispose = registerFilesBridgeHandlers({
      startCreateFile: () => {
        calls.push("create-file");
      },
      createFolder: () => {
        calls.push("create-folder");
      },
      openFolder: (id) => {
        calls.push(`open:${id}`);
      },
    });

    startFilesCreateFile();
    void startFilesCreateFolder();
    openFilesFolder("abc");
    expect(calls).toEqual(["create-file", "create-folder", "open:abc"]);

    dispose();
    startFilesCreateFile();
    openFilesFolder("xyz");
    expect(calls).toEqual(["create-file", "create-folder", "open:abc"]);
  });

  it("does not clear a newer registration on stale dispose", () => {
    const calls: string[] = [];
    const first = registerFilesBridgeHandlers({
      startCreateFile: () => {
        calls.push("old");
      },
      createFolder: async () => undefined,
      openFolder: () => undefined,
    });
    const second = registerFilesBridgeHandlers({
      startCreateFile: () => {
        calls.push("new");
      },
      createFolder: async () => undefined,
      openFolder: () => undefined,
    });

    first();
    startFilesCreateFile();
    expect(calls).toEqual(["new"]);
    second();
  });
});
