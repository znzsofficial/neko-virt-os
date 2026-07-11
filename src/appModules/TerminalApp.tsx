import { useEffect, useMemo, useRef, useState } from "react";
import { translateFileError } from "../fileErrorUtils";
import { formatFileSize, formatFileTime, resolveEntryPath, resolveFolderPath } from "../fileUtils";
import { useFsStore } from "../fsStore";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import type { FileMutationResult } from "../types";
import type { FsFile } from "../virtualFs";
import { useDesktopStore } from "../windowStore";

type TerminalContext = {
  files: FsFile[];
  createNamedFile: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  createFolder: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  deleteFileById: (id: string) => Promise<FsFile | null>;
  renameFileById: (id: string, name: string) => Promise<FileMutationResult>;
  moveFileById: (id: string, parentId: string | null) => Promise<FileMutationResult>;
  selectFile: (id: string) => void;
  openNotes: () => void;
};

export function TerminalApp() {
  const [command, setCommand] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([
    "boot --quiet",
    "loading window-manager... ok",
    "mounting indexeddb://local-fs... ok",
    "type `help` to list commands",
  ]);
  const files = useFsStore((state) => state.files);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const createFolder = useFsStore((state) => state.createFolder);
  const deleteFileById = useFsStore((state) => state.deleteFileById);
  const renameFileById = useFsStore((state) => state.renameFileById);
  const moveFileById = useFsStore((state) => state.moveFileById);
  const selectFile = useFsStore((state) => state.selectFile);
  const openApp = useDesktopStore((state) => state.openApp);
  const t = useLanguageStore((state) => state.t);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const linesRef = useRef<HTMLDivElement | null>(null);
  const completionCandidates = useMemo(() => {
    const names = files.filter((file) => !file.trashed && (file.parentId ?? null) === currentFolderId).map((file) => file.name);
    return ["help", "ls", "cat", "touch", "mkdir", "cd", "pwd", "rm", "mv", "rename", "open", "curl", "date", "theme", "clear", ...names];
  }, [files, currentFolderId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = linesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  async function runCommand(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    setLines((current) => [...current, `neko@virt-os:~$ ${trimmed}`]);
    setCommandHistory((current) => [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, 50));
    setHistoryIndex(null);
    setCommand("");

    if (trimmed === "clear") {
      setLines([]);
      return;
    }

    const output = await executeTerminalCommand(trimmed, {
      files,
      createNamedFile,
      createFolder,
      deleteFileById,
      renameFileById,
      moveFileById,
      selectFile,
      openNotes: () => openApp("notes"),
    }, currentFolderId, setCurrentFolderId, t);

    if (output?.length) {
      setLines((current) => [...current, ...output]);
    }
  }

  function applyCompletion() {
    const normalized = command.trim().toLowerCase();
    if (!normalized) return;
    const match = completionCandidates.find((candidate) => candidate.toLowerCase().startsWith(normalized));
    if (match) setCommand(match);
  }

  return (
    <div className="terminal-app" aria-label={t("terminalOutput")} onMouseDown={() => inputRef.current?.focus()}>
      <div className="terminal-lines" ref={linesRef}>
        {lines.map((line, index) => (
          <p key={`${line}-${index}`} className={line.startsWith("neko@virt-os") ? "terminal-prompt-line" : undefined}>
            {line}
          </p>
        ))}
      </div>
      <form
        className="terminal-input-line"
        onSubmit={(event) => {
          event.preventDefault();
          void runCommand(command);
        }}
      >
        <span>neko@virt-os:~$</span>
        <input
          ref={inputRef}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          placeholder="help"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              const nextIndex = historyIndex === null ? 0 : Math.min(historyIndex + 1, commandHistory.length - 1);
              if (commandHistory[nextIndex] !== undefined) {
                setHistoryIndex(nextIndex);
                setCommand(commandHistory[nextIndex]);
              }
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (historyIndex === null) return;
              const nextIndex = historyIndex - 1;
              if (nextIndex < 0) {
                setHistoryIndex(null);
                setCommand("");
                return;
              }
              setHistoryIndex(nextIndex);
              setCommand(commandHistory[nextIndex] ?? "");
              return;
            }
            if (event.key === "Tab") {
              event.preventDefault();
              applyCompletion();
            }
          }}
        />
      </form>
      <div className="terminal-status">
        <span>{currentFolderId ? getFolderPath(currentFolderId, files) : "nya://local/home"}</span>
        <span>{commandHistory.length ? `${commandHistory.length} history` : "ready"}</span>
      </div>
    </div>
  );
}

async function executeTerminalCommand(command: string, context: TerminalContext, currentFolderId: string | null, setCurrentFolderId: (id: string | null) => void, t: (key: TranslationKey) => string) {
  const [verb, ...args] = splitCommand(command);
  const filename = args.join(" ");
  const visibleEntries = context.files.filter((file) => !file.trashed && (file.parentId ?? null) === currentFolderId);

  switch (verb) {
    case "ls":
      return visibleEntries.length
        ? visibleEntries.map((file) => `${`${file.kind === "folder" ? "[DIR] " : ""}${file.name}`.padEnd(22, " ")} ${(file.kind === "text" ? formatFileSize(file.content) : "-").padStart(7, " ")}  ${formatFileTime(file.updatedAt)}`)
        : ["no files found"];
    case "mkdir": {
      if (!filename) return ["usage: mkdir <folder>"];
      const deep = args[0] === "-p";
      const targetPath = deep ? args.slice(1).join(" ") : filename;
      if (!targetPath) return [deep ? "usage: mkdir -p <path>" : "usage: mkdir <folder>"];
      if (!deep) {
        const result = await context.createFolder(targetPath, currentFolderId);
        if (result.error) return [`mkdir: ${translateFileError(result.error, t)}`];
        return result.file ? [`created folder ${result.file.name}`] : ["mkdir: create failed"];
      }

      const parts = targetPath.split(/[\\/]+/).filter(Boolean);
      let folderId = targetPath.startsWith("/") || /^nya:\/\/local\/home/i.test(targetPath) ? null : currentFolderId;
      for (const part of parts) {
        const existing = context.files.find(
          (file) => !file.trashed && file.kind === "folder" && (file.parentId ?? null) === folderId && file.name.toLowerCase() === part.toLowerCase(),
        ) ?? null;
        if (existing) {
          folderId = existing.id;
          continue;
        }
        const result = await context.createFolder(part, folderId);
        if (result.error) return [`mkdir: ${translateFileError(result.error, t)}`];
        folderId = result.file?.id ?? folderId;
      }
      return [`created path ${targetPath}`];
    }
    case "cd": {
      const target = args[0];
      if (!target) return [getFolderPath(currentFolderId, context.files)];
      const resolved = resolveFolderPath(context.files, currentFolderId, target);
      if (resolved.error) return [`cd: ${target}: no such folder`];
      setCurrentFolderId(resolved.folderId);
      return [getFolderPath(resolved.folderId, context.files)];
    }
    case "cat": {
      if (!filename) return ["usage: cat <file>"];
      const resolved = resolveEntryPath(context.files, currentFolderId, filename);
      const file = resolved.file;
      if (!file) return [`cat: ${filename}: no such file`];
      if (file.kind !== "text") return [`cat: ${filename}: is a folder`];
      return file.content ? file.content.split("\n") : ["(empty file)"];
    }
    case "touch": {
      if (!filename) return ["usage: touch <file>"];
      const result = await context.createNamedFile(filename, currentFolderId);
      if (result.error) return [`touch: ${translateFileError(result.error, t)}`];
      return result.file ? [`created or selected ${result.file.name}`] : ["touch: create failed"];
    }
    case "pwd":
      return [getFolderPath(currentFolderId, context.files)];
    case "date":
      return [new Date().toString()];
    case "curl":
      return runCurl(args);
    case "rm": {
      if (!filename) return ["usage: rm <file>"];
      const resolved = resolveEntryPath(context.files, currentFolderId, filename);
      if (!resolved.file) return [`rm: ${filename}: no such file`];
      const deleted = await context.deleteFileById(resolved.file.id);
      return deleted ? [`moved ${deleted.name} to Trash`] : [`rm: ${filename}: no such file`];
    }
    case "mv":
    case "rename": {
      const [fromName, toName, ...extra] = args;
      if (!fromName || !toName || extra.length) return [`usage: ${verb} <from> <to>`];
      const resolved = resolveEntryPath(context.files, currentFolderId, fromName);
      if (!resolved.file) return [`${verb}: ${fromName}: no such file`];
      const sourceFile = resolved.file;
      const targetEntry = resolveEntryPath(context.files, currentFolderId, toName).file;
      if (targetEntry?.kind === "folder") {
        const moveResult = await context.moveFileById(sourceFile.id, targetEntry.id);
        if (moveResult.error) return [`${verb}: ${translateFileError(moveResult.error, t)}`];
        return moveResult.file ? [`moved ${sourceFile.name} -> ${getFolderPath(targetEntry.id, context.files)}`] : [`${verb}: move failed`];
      }

      const normalizedTarget = toName.trim().replaceAll("\\", "/");
      const targetSegments = normalizedTarget.split("/").filter(Boolean);
      if (targetSegments.length > 1 || normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget)) {
        const parentPath = targetSegments.slice(0, -1).join("/");
        const nextName = targetSegments[targetSegments.length - 1];
        const targetFolder = resolveFolderPath(
          context.files,
          normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget) ? null : currentFolderId,
          parentPath || ".",
        );
        if (targetFolder.error || !nextName) return [`${verb}: ${translateFileError("invalid_target_path", t)}`];
        const siblingConflict = context.files.find(
          (file) => !file.trashed && file.id !== sourceFile.id && (file.parentId ?? null) === targetFolder.folderId && file.name.toLowerCase() === nextName.toLowerCase(),
        );
        if (siblingConflict) return [`${verb}: ${translateFileError("duplicate_name", t)}`];
        const moveResult = await context.moveFileById(sourceFile.id, targetFolder.folderId);
        if (moveResult.error) return [`${verb}: ${translateFileError(moveResult.error, t)}`];
        const renameResult = await context.renameFileById(sourceFile.id, nextName);
        if (renameResult.error) return [`${verb}: ${translateFileError(renameResult.error, t)}`];
        return renameResult.file ? [`moved ${fromName} -> ${getFolderPath(targetFolder.folderId, context.files)}/${renameResult.file.name}`] : [`${verb}: move failed`];
      }

      const result = await context.renameFileById(resolved.file.id, toName);
      if (result.error) return [`${verb}: ${translateFileError(result.error, t)}`];
      return result.file ? [`renamed ${fromName} -> ${result.file.name}`] : [`${verb}: rename failed`];
    }
    case "open": {
      if (!filename) return ["usage: open <file>"];
      const resolved = resolveEntryPath(context.files, currentFolderId, filename);
      const file = resolved.file;
      if (!file) return [`open: ${filename}: no such file`];
      if (file.kind !== "text") return [`open: ${filename}: is a folder`];
      context.selectFile(file.id);
      context.openNotes();
      return [`opened ${file.name} in Notes`];
    }
    case "theme":
      return ["Quiet Neko Workstation", "primary: oxblood kernel", "accent: neko focus rose", "surface: midnight desktop"];
    case "help": {
      const sub = args[0];
      if (sub) {
        switch (sub) {
          case "ls": return ["ls - List virtual files inside local IndexedDB."];
          case "cat": return ["cat <file> - Print content of a file."];
          case "touch": return ["touch <file> - Create a text file or update its modified date."];
          case "mkdir": return ["mkdir <folder> - Create a folder in the current directory.", "mkdir -p <path> - Create nested folders."];
          case "cd": return ["cd <folder> - Change the current directory.", "cd a/b - Change into a nested folder path."];
          case "rm": return ["rm <file> - Move a text file to Trash."];
          case "mv": return ["mv <from> <to> - Rename a file or move it into a folder/path."];
          case "open": return ["open <file> - Load a text file and bring up the Notes app."];
          case "theme": return ["theme - Print details about system design aesthetic."];
          case "pwd": return ["pwd - Print name of current virtual working directory."];
          case "date": return ["date - Display current local clock time."];
          case "curl": return ["curl <url> - Fetch an HTTP(S) URL and print the text response. Falls back to a read-only proxy when direct browser access is blocked."];
          default: return [`No help topic found for '${sub}'`];
        }
      }
      return [
        "available commands:",
        "  ls                 list local files",
        "  cat <file>         print file content",
        "  touch <file>       create a text file",
        "  mkdir <folder>     create a folder",
        "  mkdir -p <path>    create nested folders",
        "  rm <file>          move a text file to Trash",
        "  mv <from> <to>     rename or move a file",
        "  cd <folder>        change directory",
        "  cd a/b             change into nested folder path",
        "  open <file>        select a file and open Notes",
        "  curl <url>         fetch an HTTP(S) URL with proxy fallback",
        "  pwd                print working directory",
        "  date               print current date/time",
        "  theme              print current design theme",
        "  clear              clear terminal output",
        "",
        "Type `help <cmd>` to get detailed info on a command.",
      ];
    }
  }
}

async function runCurl(args: string[]) {
  const urlArg = args.find((arg) => !arg.startsWith("-"));
  if (!urlArg) return ["usage: curl <url>"];

  let url: URL;
  try {
    url = new URL(urlArg.includes("://") ? urlArg : `https://${urlArg}`);
  } catch {
    return [`curl: invalid URL: ${urlArg}`];
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return ["curl: only http:// and https:// URLs are supported"];
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const result = await fetchWithCorsFallback(url.toString(), controller.signal);
    const contentType = result.response.headers.get("content-type") ?? "unknown";
    const text = await result.response.text();
    const body = text.length > 8000 ? `${text.slice(0, 8000)}\n... truncated ...` : text;
    return [
      `HTTP ${result.response.status} ${result.response.statusText}${result.viaProxy ? ` (${result.viaProxy})` : ""}`.trim(),
      `content-type: ${contentType}`,
      `source: ${result.finalUrl}`,
      "",
      ...(body ? body.split("\n") : ["(empty response)"]),
    ];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return ["curl: request timed out after 10s"];
    return [
      "curl: request failed after direct fetch and proxy fallback.",
      "The target may block automated access, or the network/proxy may be unavailable.",
    ];
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchWithCorsFallback(url: string, signal: AbortSignal) {
  try {
    const response = await fetch(url, { signal });
    return { response, viaProxy: null as string | null, finalUrl: url };
  } catch {
    const proxyCandidates = [
      {
        label: "via cors.isomorphic-git.org",
        requestUrl: `https://cors.isomorphic-git.org/${url}`,
      },
      {
        label: "via allorigins",
        requestUrl: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      },
    ];

    for (const proxy of proxyCandidates) {
      try {
        const response = await fetch(proxy.requestUrl, { signal });
        if (!response.ok) continue;
        return { response, viaProxy: proxy.label, finalUrl: url };
      } catch {
        continue;
      }
    }

    throw new Error("curl proxy fallback failed");
  }
}

function splitCommand(command: string) {
  const matches = command.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g);
  return Array.from(matches, (match) => match[1] ?? match[2] ?? match[3]);
}

function getFolderPath(currentFolderId: string | null, files: FsFile[]) {
  if (!currentFolderId) return "nya://local/home";
  const chain: string[] = [];
  let cursor = files.find((file) => file.id === currentFolderId && file.kind === "folder") ?? null;
  while (cursor) {
    chain.unshift(cursor.name);
    cursor = cursor.parentId ? files.find((file) => file.id === cursor?.parentId && file.kind === "folder") ?? null : null;
  }
  return `nya://local/home/${chain.join("/")}`;
}
