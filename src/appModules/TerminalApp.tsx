import { useEffect, useMemo, useRef, useState } from "react";
import { apps } from "../apps";
import { appTitleKeys } from "../appText";
import { useDownloadStore } from "../downloadStore";
import {
  formatFileSize,
  formatFileTime,
  resolveEntryPath,
  resolveFolderPath,
  splitFsPath,
  translateFileError,
  useFsStore,
  type FsFile,
} from "../fs";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import type { AppId, FileMutationResult } from "../types";
import { openFilesFolder } from "../shell/filesBridge";
import { useDesktopStore } from "../windowStore";

type TerminalContext = {
  files: FsFile[];
  getFiles: () => FsFile[];
  createNamedFile: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  createFolder: (name: string, parentId?: string | null) => Promise<FileMutationResult>;
  touchFileById: (id: string) => Promise<FsFile | null>;
  deleteFileById: (id: string) => Promise<FsFile | null>;
  restoreFileById: (id: string) => Promise<void>;
  renameFileById: (id: string, name: string) => Promise<FileMutationResult>;
  moveFileById: (id: string, parentId: string | null) => Promise<FileMutationResult>;
  saveFileDraft: (id: string, draft: string) => Promise<void>;
  selectFile: (id: string) => void;
  openNotes: () => void;
  openFolder: (id: string | null) => void;
  openApp: (appId: AppId) => void;
  addDownload: (entry: { name: string; source: string; size?: number; mimeType?: string; url?: string }) => unknown;
  closeWindow: () => boolean;
  commandHistory: string[];
  language: "zh" | "en";
};

const TERMINAL_COMMANDS = [
  "help", "ls", "cat", "touch", "new", "edit", "write", "append", "mkdir", "cd", "pwd",
  "rm", "trash", "restore", "cp", "mv", "rename", "open", "find", "grep", "tree",
  "head", "tail", "wc", "stat", "download", "echo", "history", "whoami", "uname",
  "apps", "launch", "close", "curl", "date", "theme", "clear", "cls",
] as const;

function getBootLines(t: (key: TranslationKey) => string) {
  return [
    t("terminalBootQuiet"),
    t("terminalBootWindowManager"),
    t("terminalBootMountFs"),
    t("terminalBootHelp"),
  ];
}

export function TerminalApp({ windowId }: { windowId?: string }) {
  const [command, setCommand] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [lines, setLines] = useState<string[]>(() => getBootLines(useLanguageStore.getState().t));
  const files = useFsStore((state) => state.files);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const createFolder = useFsStore((state) => state.createFolder);
  const touchFileById = useFsStore((state) => state.touchFileById);
  const deleteFileById = useFsStore((state) => state.deleteFileById);
  const restoreFileById = useFsStore((state) => state.restoreFileById);
  const renameFileById = useFsStore((state) => state.renameFileById);
  const moveFileById = useFsStore((state) => state.moveFileById);
  const saveFileDraft = useFsStore((state) => state.saveFileDraft);
  const addDownload = useDownloadStore((state) => state.addDownload);
  const selectFile = useFsStore((state) => state.selectFile);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const linesRef = useRef<HTMLDivElement | null>(null);
  const completionCandidates = useMemo(() => {
    const names = files.filter((file) => !file.trashed && (file.parentId ?? null) === currentFolderId).map((file) => file.name);
    const appIds = apps.map((app) => app.id);
    return [...TERMINAL_COMMANDS, ...appIds, ...names];
  }, [files, currentFolderId]);
  const suggestions = useMemo(() => suggestionsDismissed ? [] : getCompletionSuggestions(command, completionCandidates), [command, completionCandidates, suggestionsDismissed]);
  const selectedSuggestion = suggestions[selectedSuggestionIndex] ?? suggestions[0] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = linesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
    setSuggestionsDismissed(false);
  }, [command, currentFolderId]);

  useEffect(() => {
    if (commandHistory.length) return;
    setLines(getBootLines(t));
  }, [language, t, commandHistory.length]);

  useEffect(() => {
    if (!currentFolderId) return;
    const stillExists = files.some((file) => file.id === currentFolderId && file.kind === "folder" && !file.trashed);
    if (!stillExists) setCurrentFolderId(null);
  }, [files, currentFolderId]);

  async function runCommand(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    setLines((current) => [...current, `neko@virt-os:~$ ${trimmed}`]);
    setCommandHistory((current) => [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, 50));
    setHistoryIndex(null);
    setCommand("");
    setSelectedSuggestionIndex(0);
    setSuggestionsDismissed(false);

    if (trimmed === "clear" || trimmed === "cls") {
      setLines([]);
      return;
    }

    const output = await executeTerminalCommand(trimmed, {
      files: useFsStore.getState().files,
      getFiles: () => useFsStore.getState().files,
      createNamedFile,
      createFolder,
      touchFileById,
      deleteFileById,
      restoreFileById,
      renameFileById,
      moveFileById,
      saveFileDraft,
      selectFile,
      openNotes: () => openApp("notes"),
      openFolder: (folderId) => {
        openFilesFolder(folderId);
        openApp("files");
      },
      openApp: (appId) => {
        openApp(appId);
      },
      addDownload,
      closeWindow: () => {
        if (!windowId) return false;
        closeWindow(windowId);
        return true;
      },
      commandHistory: [trimmed, ...commandHistory.filter((entry) => entry !== trimmed)].slice(0, 50),
      language,
    }, currentFolderId, setCurrentFolderId, t);

    if (output?.length) {
      setLines((current) => [...current, ...output]);
    }
  }

  function applyCompletion(nextSuggestion = selectedSuggestion) {
    if (!nextSuggestion) return;
    setCommand(completeCommand(command, nextSuggestion));
    setSelectedSuggestionIndex(0);
    setSuggestionsDismissed(false);
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
        <div className="terminal-input-shell">
          <input
            ref={inputRef}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            placeholder={t("terminalPromptPlaceholder")}
            value={command}
            onChange={(event) => {
              setHistoryIndex(null);
              setSuggestionsDismissed(false);
              setCommand(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (suggestions.length) {
                  setSelectedSuggestionIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1);
                  return;
                }
                const nextIndex = historyIndex === null ? 0 : Math.min(historyIndex + 1, commandHistory.length - 1);
                if (commandHistory[nextIndex] !== undefined) {
                  setHistoryIndex(nextIndex);
                  setCommand(commandHistory[nextIndex]);
                }
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (suggestions.length) {
                  setSelectedSuggestionIndex((current) => current >= suggestions.length - 1 ? 0 : current + 1);
                  return;
                }
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
              if (event.key === "Escape") {
                if (!suggestions.length) return;
                event.preventDefault();
                setSelectedSuggestionIndex(0);
                setSuggestionsDismissed(true);
                return;
              }
              if (event.key === "Tab") {
                event.preventDefault();
                applyCompletion();
              }
            }}
          />
          {suggestions.length ? (
            <div className="terminal-suggestions" role="listbox" aria-label={t("terminalSuggestions")}>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className={index === selectedSuggestionIndex ? "is-selected" : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    applyCompletion(suggestion);
                    inputRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </form>
      <div className="terminal-status">
        <span>{currentFolderId ? getFolderPath(currentFolderId, files) : "nya://local/home"}</span>
        <span>{commandHistory.length ? `${commandHistory.length}${t("terminalHistoryCountSuffix")}` : t("terminalReady")}</span>
      </div>
    </div>
  );
}

function getCompletionSuggestions(command: string, candidates: string[]) {
  const token = getCompletionToken(command).toLowerCase();
  if (!token) return [];
  return Array.from(new Set(candidates.filter((candidate) => candidate.toLowerCase().startsWith(token)))).slice(0, 8);
}

function getCompletionToken(command: string) {
  const trimmedEnd = command.replace(/\s+$/, "");
  if (!trimmedEnd) return "";
  const parts = trimmedEnd.split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

function completeCommand(command: string, suggestion: string) {
  const hasTrailingSpace = /\s$/.test(command);
  if (!command.trim() || hasTrailingSpace) return `${command}${suggestion}`;
  const parts = command.split(/(\s+)/);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].trim()) {
      parts[index] = suggestion;
      return parts.join("");
    }
  }
  return suggestion;
}

function getLineSlice(content: string, start: number, end: number, t: (key: TranslationKey) => string) {
  const lines = content ? content.split("\n") : [];
  const slice = lines.slice(start, end);
  return slice.length ? slice : [t("terminalEmptyFile")];
}

function renderTree(files: FsFile[], currentFolderId: string | null, dirLabel: string) {
  const roots = files
    .filter((file) => !file.trashed && (file.parentId ?? null) === currentFolderId)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
  const lines: string[] = [];
  roots.forEach((file, index) => {
    appendTreeLine(lines, files, file, "", index === roots.length - 1, dirLabel);
  });
  return lines;
}

function appendTreeLine(lines: string[], files: FsFile[], file: FsFile, prefix: string, isLast: boolean, dirLabel: string) {
  const branch = `${prefix}${isLast ? "└─ " : "├─ "}`;
  lines.push(`${branch}${file.kind === "folder" ? `${dirLabel}${file.name}` : file.name}`);
  if (file.kind !== "folder") return;
  const children = files
    .filter((entry) => !entry.trashed && (entry.parentId ?? null) === file.id)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
  const nextPrefix = `${prefix}${isLast ? "   " : "│  "}`;
  children.forEach((child, index) => appendTreeLine(lines, files, child, nextPrefix, index === children.length - 1, dirLabel));
}

function formatTreeEntry(file: FsFile, files: FsFile[], absolute = false, dirLabel = "[DIR] ") {
  const path = absolute ? getEntryPath(file, files) : file.name;
  return `${file.kind === "folder" ? dirLabel : ""}${path}`;
}

function resolveWritableTarget(files: FsFile[], currentFolderId: string | null, path: string) {
  const trimmed = path.trim();
  if (!trimmed) return { parentId: currentFolderId, name: "", error: "empty_name" as const };
  const parts = splitFsPath(trimmed);
  if (!parts.length) return { parentId: currentFolderId, name: "", error: "empty_name" as const };
  const absolute = trimmed.startsWith("/") || /^nya:\/\/local\/home/i.test(trimmed);
  const parentParts = parts.slice(0, -1);
  const name = parts[parts.length - 1] ?? "";
  if (!parentParts.length) {
    return { parentId: absolute ? null : currentFolderId, name, error: null as null };
  }
  const parentPath = parentParts.join("/");
  const resolved = resolveFolderPath(files, absolute ? null : currentFolderId, parentPath);
  if (resolved.error) return { parentId: null, name: "", error: "invalid_target_path" as const };
  return { parentId: resolved.folderId, name, error: null as null };
}

function formatEntryLine(file: FsFile, dirLabel: string, locale: "zh" | "en") {
  return `${`${file.kind === "folder" ? dirLabel : ""}${file.name}`.padEnd(22, " ")} ${(file.kind === "text" ? formatFileSize(file.content) : "-").padStart(7, " ")}  ${formatFileTime(file.updatedAt, locale)}`;
}

function getEntryPath(file: FsFile, files: FsFile[]) {
  const chain = [file.name];
  let cursor = file.parentId ? files.find((entry) => entry.id === file.parentId && entry.kind === "folder") ?? null : null;
  while (cursor) {
    chain.unshift(cursor.name);
    cursor = cursor.parentId ? files.find((entry) => entry.id === cursor?.parentId && entry.kind === "folder") ?? null : null;
  }
  return `nya://local/home/${chain.join("/")}`;
}

function listEntries(files: FsFile[], folderId: string | null) {
  return files
    .filter((file) => !file.trashed && (file.parentId ?? null) === folderId)
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
}

function collectTextFiles(files: FsFile[], folderId: string | null, recursive: boolean): FsFile[] {
  const direct = files.filter((file) => !file.trashed && (file.parentId ?? null) === folderId);
  const texts = direct.filter((file) => file.kind === "text");
  if (!recursive) return texts;
  const nested = direct
    .filter((file) => file.kind === "folder")
    .flatMap((folder) => collectTextFiles(files, folder.id, true));
  return [...texts, ...nested];
}

function isDescendantOf(files: FsFile[], sourceId: string, targetFolderId: string | null) {
  let cursor = targetFolderId;
  while (cursor) {
    if (cursor === sourceId) return true;
    const current = files.find((file) => file.id === cursor && file.kind === "folder") ?? null;
    cursor = current?.parentId ?? null;
  }
  return false;
}

function resolveCopyTarget(files: FsFile[], currentFolderId: string | null, toName: string, source: FsFile) {
  const targetEntry = resolveEntryPath(files, currentFolderId, toName).file;
  if (targetEntry?.kind === "folder") {
    return { targetFolderId: targetEntry.id, nextName: source.name, error: null as string | null };
  }
  if (targetEntry) {
    return { targetFolderId: null, nextName: "", error: "duplicate_name" as const };
  }

  const normalizedTarget = toName.trim().replaceAll("\\", "/");
  const targetSegments = normalizedTarget.split("/").filter(Boolean);
  let targetFolderId = currentFolderId;
  let nextName = toName.trim();
  if (targetSegments.length > 1 || normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget)) {
    const parentPath = targetSegments.slice(0, -1).join("/");
    nextName = targetSegments[targetSegments.length - 1] ?? nextName;
    const resolvedFolder = resolveFolderPath(
      files,
      normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget) ? null : currentFolderId,
      parentPath || ".",
    );
    if (resolvedFolder.error || !nextName) {
      return { targetFolderId: null, nextName: "", error: "invalid_target_path" as const };
    }
    targetFolderId = resolvedFolder.folderId;
  }

  const duplicate = files.find(
    (file) => !file.trashed && (file.parentId ?? null) === targetFolderId && file.name.toLowerCase() === nextName.toLowerCase(),
  );
  if (duplicate) {
    return { targetFolderId: null, nextName: "", error: "duplicate_name" as const };
  }
  return { targetFolderId, nextName, error: null as string | null };
}

async function copyEntryTree(
  context: TerminalContext,
  source: FsFile,
  targetFolderId: string | null,
  nextName: string,
  sourceSnapshot: FsFile[],
): Promise<{ error: string | null; createdName: string }> {
  if (source.kind === "text") {
    const result = await context.createNamedFile(nextName, targetFolderId);
    if (result.error) return { error: result.error, createdName: nextName };
    if (!result.file || result.file.kind !== "text") return { error: "create_failed", createdName: nextName };
    await context.saveFileDraft(result.file.id, source.content);
    return { error: null, createdName: result.file.name };
  }

  const folderResult = await context.createFolder(nextName, targetFolderId);
  if (folderResult.error) return { error: folderResult.error, createdName: nextName };
  if (!folderResult.file) return { error: "create_failed", createdName: nextName };
  const children = sourceSnapshot.filter((file) => !file.trashed && (file.parentId ?? null) === source.id);
  for (const child of children) {
    const nested = await copyEntryTree(context, child, folderResult.file.id, child.name, sourceSnapshot);
    if (nested.error) return nested;
  }
  return { error: null, createdName: folderResult.file.name };
}

async function executeTerminalCommand(command: string, context: TerminalContext, currentFolderId: string | null, setCurrentFolderId: (id: string | null) => void, t: (key: TranslationKey) => string) {
  const [verb, ...args] = splitCommand(command);
  if (!verb) return [];
  const filename = args.join(" ");
  const files = context.getFiles();
  const visibleEntries = listEntries(files, currentFolderId);
  const dirLabel = t("terminalDirLabel");
  const locale = context.language;

  switch (verb) {
    case "ls": {
      const target = args[0];
      if (!target) {
        return visibleEntries.length
          ? visibleEntries.map((file) => formatEntryLine(file, dirLabel, locale))
          : [t("terminalNoFilesFound")];
      }
      const asFolder = resolveFolderPath(files, currentFolderId, target);
      if (!asFolder.error) {
        const entries = listEntries(files, asFolder.folderId);
        return entries.length
          ? entries.map((file) => formatEntryLine(file, dirLabel, locale))
          : [t("terminalNoFilesFound")];
      }
      const asEntry = resolveEntryPath(files, currentFolderId, target).file;
      if (!asEntry) return [`ls: ${target}${t("terminalNoSuchFileSuffix")}`];
      return [formatEntryLine(asEntry, dirLabel, locale)];
    }
    case "mkdir": {
      if (!filename) return [t("terminalUsageMkdir")];
      const deep = args[0] === "-p";
      const targetPath = deep ? args.slice(1).join(" ") : filename;
      if (!targetPath) return [deep ? t("terminalUsageMkdirPath") : t("terminalUsageMkdir")];
      if (!deep) {
        const target = resolveWritableTarget(context.getFiles(), currentFolderId, targetPath);
        if (target.error === "empty_name") return [`mkdir: ${translateFileError("empty_name", t)}`];
        if (target.error === "invalid_target_path") return [`mkdir: ${translateFileError("invalid_target_path", t)}`];
        const result = await context.createFolder(target.name, target.parentId);
        if (result.error) return [`mkdir: ${translateFileError(result.error, t)}`];
        return result.file ? [`${t("terminalCreatedFolderPrefix")}${result.file.name}`] : [`mkdir: ${t("terminalCreateFailed")}`];
      }

      const parts = splitFsPath(targetPath);
      let folderId = targetPath.startsWith("/") || /^nya:\/\/local\/home/i.test(targetPath) ? null : currentFolderId;
      for (const part of parts) {
        const liveFiles = context.getFiles();
        const existing = liveFiles.find(
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
      return [`${t("terminalCreatedPathPrefix")}${targetPath}`];
    }
    case "cd": {
      const target = args[0];
      if (!target) return [getFolderPath(currentFolderId, files)];
      const resolved = resolveFolderPath(files, currentFolderId, target);
      if (resolved.error) return [`cd: ${target}${t("terminalNoSuchFolderSuffix")}`];
      setCurrentFolderId(resolved.folderId);
      return [getFolderPath(resolved.folderId, files)];
    }
    case "cat": {
      if (!filename) return [t("terminalUsageCat")];
      const resolved = resolveEntryPath(files, currentFolderId, filename);
      const file = resolved.file;
      if (!file) return [`cat: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (file.kind !== "text") return [`cat: ${filename}${t("terminalIsFolderSuffix")}`];
      return file.content ? file.content.split("\n") : [t("terminalEmptyFile")];
    }
    case "touch": {
      if (!filename) return [t("terminalUsageTouch")];
      const existing = resolveEntryPath(files, currentFolderId, filename).file;
      if (existing) {
        const touched = await context.touchFileById(existing.id);
        return touched ? [`${t("terminalTouchedPrefix")}${touched.name}`] : [`touch: ${filename}${t("terminalNoSuchFileSuffix")}`];
      }
      const target = resolveWritableTarget(files, currentFolderId, filename);
      if (target.error === "empty_name") return [`touch: ${translateFileError("empty_name", t)}`];
      if (target.error === "invalid_target_path") return [`touch: ${translateFileError("invalid_target_path", t)}`];
      const result = await context.createNamedFile(target.name, target.parentId);
      if (result.error) return [`touch: ${translateFileError(result.error, t)}`];
      return result.file ? [`${t("terminalCreatedFilePrefix")}${result.file.name}`] : [`touch: ${t("terminalCreateFailed")}`];
    }
    case "new": {
      if (!filename) return [t("terminalUsageNew")];
      const target = resolveWritableTarget(files, currentFolderId, filename);
      if (target.error === "empty_name") return [`new: ${translateFileError("empty_name", t)}`];
      if (target.error === "invalid_target_path") return [`new: ${translateFileError("invalid_target_path", t)}`];
      const existing = listEntries(files, target.parentId).find((file) => file.name.toLowerCase() === target.name.toLowerCase()) ?? null;
      if (existing) return [`new: ${translateFileError("duplicate_name", t)}`];
      const result = await context.createNamedFile(target.name, target.parentId);
      if (result.error) return [`new: ${translateFileError(result.error, t)}`];
      return result.file ? [`${t("terminalCreatedFilePrefix")}${result.file.name}`] : [`new: ${t("terminalCreateFailed")}`];
    }
    case "edit": {
      if (!filename) return [t("terminalUsageEdit")];
      let file = resolveEntryPath(files, currentFolderId, filename).file ?? null;
      if (!file) {
        const target = resolveWritableTarget(files, currentFolderId, filename);
        if (target.error === "empty_name") return [`edit: ${translateFileError("empty_name", t)}`];
        if (target.error === "invalid_target_path") return [`edit: ${translateFileError("invalid_target_path", t)}`];
        const result = await context.createNamedFile(target.name, target.parentId);
        if (result.error) return [`edit: ${translateFileError(result.error, t)}`];
        file = result.file;
      }
      if (!file) return [`edit: ${t("terminalCreateFailed")}`];
      if (file.kind !== "text") return [`edit: ${filename}${t("terminalIsFolderSuffix")}`];
      context.selectFile(file.id);
      context.openNotes();
      return [`${t("terminalOpenedInNotesPrefix")}${file.name}`];
    }
    case "write": {
      const targetName = args[0];
      const text = args.slice(1).join(" ");
      if (!targetName || !text) return [t("terminalUsageWrite")];
      let file = resolveEntryPath(files, currentFolderId, targetName).file ?? null;
      if (!file) {
        const target = resolveWritableTarget(files, currentFolderId, targetName);
        if (target.error === "empty_name") return [`write: ${translateFileError("empty_name", t)}`];
        if (target.error === "invalid_target_path") return [`write: ${translateFileError("invalid_target_path", t)}`];
        const result = await context.createNamedFile(target.name, target.parentId);
        if (result.error) return [`write: ${translateFileError(result.error, t)}`];
        file = result.file;
      }
      if (!file) return [`write: ${t("terminalCreateFailed")}`];
      if (file.kind !== "text") return [`write: ${targetName}${t("terminalIsFolderSuffix")}`];
      await context.saveFileDraft(file.id, text);
      return [`${t("terminalWroteFilePrefix")}${file.name}`];
    }
    case "append": {
      const targetName = args[0];
      const text = args.slice(1).join(" ");
      if (!targetName || !text) return [t("terminalUsageAppend")];
      let file = resolveEntryPath(files, currentFolderId, targetName).file ?? null;
      if (!file) {
        const target = resolveWritableTarget(files, currentFolderId, targetName);
        if (target.error === "empty_name") return [`append: ${translateFileError("empty_name", t)}`];
        if (target.error === "invalid_target_path") return [`append: ${translateFileError("invalid_target_path", t)}`];
        const result = await context.createNamedFile(target.name, target.parentId);
        if (result.error) return [`append: ${translateFileError(result.error, t)}`];
        file = result.file;
      }
      if (!file) return [`append: ${t("terminalCreateFailed")}`];
      if (file.kind !== "text") return [`append: ${targetName}${t("terminalIsFolderSuffix")}`];
      await context.saveFileDraft(file.id, file.content ? `${file.content}\n${text}` : text);
      return [`${t("terminalAppendedFilePrefix")}${file.name}`];
    }
    case "pwd":
      return [getFolderPath(currentFolderId, files)];
    case "date":
      return [new Date().toLocaleString(locale === "zh" ? "zh-CN" : "en-US")];
    case "echo":
      return [args.join(" ") || " "];
    case "history": {
      if (!context.commandHistory.length) return [t("terminalHistoryEmpty")];
      return [...context.commandHistory].reverse().map((entry, index) => `${String(index + 1).padStart(3, " ")}  ${entry}`);
    }
    case "whoami":
      return ["neko"];
    case "uname":
      return args[0] === "-a"
        ? [`NekoVirtOS 1.0 ${navigator.platform || "browser"} ${navigator.userAgent}`]
        : ["NekoVirtOS"];
    case "apps":
      return apps.map((app) => `${app.id.padEnd(16, " ")} ${t(appTitleKeys[app.id])}`);
    case "launch": {
      const appId = args[0] as AppId | undefined;
      if (!appId) return [t("terminalUsageLaunch")];
      const app = apps.find((entry) => entry.id === appId || t(appTitleKeys[entry.id]).toLowerCase() === appId.toLowerCase());
      if (!app) return [`launch: ${appId}${t("terminalNoSuchAppSuffix")}`];
      context.openApp(app.id);
      return [`${t("terminalLaunchedAppPrefix")}${t(appTitleKeys[app.id])}`];
    }
    case "curl":
      return runCurl(args);
    case "rm":
    case "trash": {
      if (!filename) return [t("terminalUsageRm")];
      const resolved = resolveEntryPath(files, currentFolderId, filename);
      if (!resolved.file) return [`${verb}: ${filename}${t("terminalNoSuchFileSuffix")}`];
      const deleted = await context.deleteFileById(resolved.file.id);
      return deleted ? [`${t("terminalMovedToTrashPrefix")}${deleted.name}${t("terminalMovedToTrashSuffix")}`] : [`${verb}: ${filename}${t("terminalNoSuchFileSuffix")}`];
    }
    case "restore": {
      if (!filename) return [t("terminalUsageRestore")];
      const file = files.find((entry) => entry.trashed && entry.name.toLowerCase() === filename.toLowerCase()) ?? null;
      if (!file) return [`restore: ${filename}${t("terminalNoSuchFileSuffix")}`];
      await context.restoreFileById(file.id);
      return [`${t("terminalRestoredFilePrefix")}${file.name}`];
    }
    case "cp": {
      const [fromName, toName, ...extra] = args;
      if (!fromName || !toName || extra.length) return [t("terminalUsageCp")];
      const sourceSnapshot = context.getFiles();
      const source = resolveEntryPath(sourceSnapshot, currentFolderId, fromName).file;
      if (!source) return [`cp: ${fromName}${t("terminalNoSuchFileSuffix")}`];
      const target = resolveCopyTarget(sourceSnapshot, currentFolderId, toName, source);
      if (target.error === "duplicate_name") return [`cp: ${translateFileError("duplicate_name", t)}`];
      if (target.error === "invalid_target_path" || !target.nextName) return [`cp: ${translateFileError("invalid_target_path", t)}`];
      if (source.kind === "folder" && isDescendantOf(sourceSnapshot, source.id, target.targetFolderId)) {
        return [`cp: ${translateFileError("move_into_descendant", t)}`];
      }
      const copied = await copyEntryTree(context, source, target.targetFolderId, target.nextName, sourceSnapshot);
      if (copied.error === "create_failed") return [`cp: ${t("terminalCreateFailed")}`];
      if (copied.error === "empty_name" || copied.error === "invalid_characters" || copied.error === "duplicate_name" || copied.error === "not_found" || copied.error === "move_into_self" || copied.error === "move_into_descendant" || copied.error === "invalid_target_path") {
        return [`cp: ${translateFileError(copied.error, t)}`];
      }
      if (copied.error) return [`cp: ${t("terminalCreateFailed")}`];
      return [`${t("terminalCopiedFilePrefix")}${source.name}${t("terminalRenamedArrow")}${copied.createdName}`];
    }
    case "mv":
    case "rename": {
      const [fromName, toName, ...extra] = args;
      if (!fromName || !toName || extra.length) return [`${t("terminalUsageRename")}${verb} <from> <to>`];
      const resolved = resolveEntryPath(files, currentFolderId, fromName);
      if (!resolved.file) return [`${verb}: ${fromName}${t("terminalNoSuchFileSuffix")}`];
      const sourceFile = resolved.file;
      const targetEntry = resolveEntryPath(files, currentFolderId, toName).file;
      if (targetEntry?.kind === "folder") {
        const moveResult = await context.moveFileById(sourceFile.id, targetEntry.id);
        if (moveResult.error) return [`${verb}: ${translateFileError(moveResult.error, t)}`];
        return moveResult.file ? [`${t("terminalMovedPrefix")}${sourceFile.name}${t("terminalRenamedArrow")}${getFolderPath(targetEntry.id, files)}`] : [`${verb}: ${t("terminalMoveFailed")}`];
      }

      const normalizedTarget = toName.trim().replaceAll("\\", "/");
      const targetSegments = normalizedTarget.split("/").filter(Boolean);
      if (targetSegments.length > 1 || normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget)) {
        const parentPath = targetSegments.slice(0, -1).join("/");
        const nextName = targetSegments[targetSegments.length - 1];
        const targetFolder = resolveFolderPath(
          files,
          normalizedTarget.startsWith("/") || /^nya:\/\/local\/home/i.test(normalizedTarget) ? null : currentFolderId,
          parentPath || ".",
        );
        if (targetFolder.error || !nextName) return [`${verb}: ${translateFileError("invalid_target_path", t)}`];
        const siblingConflict = files.find(
          (file) => !file.trashed && file.id !== sourceFile.id && (file.parentId ?? null) === targetFolder.folderId && file.name.toLowerCase() === nextName.toLowerCase(),
        );
        if (siblingConflict) return [`${verb}: ${translateFileError("duplicate_name", t)}`];
        const moveResult = await context.moveFileById(sourceFile.id, targetFolder.folderId);
        if (moveResult.error) return [`${verb}: ${translateFileError(moveResult.error, t)}`];
        const renameResult = await context.renameFileById(sourceFile.id, nextName);
        if (renameResult.error) return [`${verb}: ${translateFileError(renameResult.error, t)}`];
        return renameResult.file ? [`${t("terminalMovedPrefix")}${fromName}${t("terminalRenamedArrow")}${getFolderPath(targetFolder.folderId, files)}/${renameResult.file.name}`] : [`${verb}: ${t("terminalMoveFailed")}`];
      }

      const result = await context.renameFileById(resolved.file.id, toName);
      if (result.error) return [`${verb}: ${translateFileError(result.error, t)}`];
      return result.file ? [`${t("terminalRenamedPrefix")}${fromName}${t("terminalRenamedArrow")}${result.file.name}`] : [`${verb}: ${t("renameFailed")}`];
    }
    case "open": {
      if (!filename) return [t("terminalUsageOpen")];
      const resolved = resolveEntryPath(files, currentFolderId, filename);
      const file = resolved.file;
      if (!file) return [`open: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (file.kind === "folder") {
        context.openFolder(file.id);
        return [`${t("terminalOpenedFolderPrefix")}${file.name}`];
      }
      context.selectFile(file.id);
      context.openNotes();
      return [`${t("terminalOpenedInNotesPrefix")}${file.name}`];
    }
    case "find": {
      if (!filename) return [t("terminalUsageFind")];
      const matched = files
        .filter((file) => !file.trashed && file.name.toLowerCase().includes(filename.toLowerCase()))
        .map((file) => formatTreeEntry(file, files, true, dirLabel));
      return matched.length ? matched : [t("terminalNoMatches")];
    }
    case "grep": {
      const recursive = args[0] === "-r";
      const query = recursive ? args[1] : args[0];
      const targetName = recursive ? args.slice(2).join(" ") : args.slice(1).join(" ");
      if (!query) return [t("terminalUsageGrep")];

      let targets: FsFile[] = [];
      if (!targetName) {
        targets = collectTextFiles(files, currentFolderId, recursive);
      } else {
        const asFolder = resolveFolderPath(files, currentFolderId, targetName);
        if (!asFolder.error) {
          targets = collectTextFiles(files, asFolder.folderId, true);
        } else {
          const entry = resolveEntryPath(files, currentFolderId, targetName).file;
          if (!entry) return [`grep: ${targetName}${t("terminalNoSuchFileSuffix")}`];
          if (entry.kind === "folder") {
            targets = collectTextFiles(files, entry.id, true);
          } else {
            targets = [entry];
          }
        }
      }

      const matches = targets.flatMap((file) => file.content
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
        .map(({ line, index }) => {
          const multi = !targetName || recursive || targets.length > 1;
          return `${multi ? `${file.name}:` : ""}${index + 1}: ${line}`;
        }),
      );
      return matches.length ? matches : [t("terminalNoMatches")];
    }
    case "tree": {
      const lines = renderTree(files, currentFolderId, dirLabel);
      return lines.length ? lines : [t("terminalNoFilesFound")];
    }
    case "head": {
      if (!filename) return [t("terminalUsageHead")];
      const resolved = resolveEntryPath(files, currentFolderId, filename).file;
      if (!resolved) return [`head: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (resolved.kind !== "text") return [`head: ${filename}${t("terminalIsFolderSuffix")}`];
      return getLineSlice(resolved.content, 0, 10, t);
    }
    case "tail": {
      if (!filename) return [t("terminalUsageTail")];
      const resolved = resolveEntryPath(files, currentFolderId, filename).file;
      if (!resolved) return [`tail: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (resolved.kind !== "text") return [`tail: ${filename}${t("terminalIsFolderSuffix")}`];
      const lines = resolved.content ? resolved.content.split("\n") : [];
      return lines.length ? lines.slice(-10) : [t("terminalEmptyFile")];
    }
    case "wc": {
      if (!filename) return [t("terminalUsageWc")];
      const resolved = resolveEntryPath(files, currentFolderId, filename).file;
      if (!resolved) return [`wc: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (resolved.kind !== "text") return [`wc: ${filename}${t("terminalIsFolderSuffix")}`];
      const lineCount = resolved.content ? resolved.content.split("\n").length : 0;
      const wordCount = resolved.content.trim() ? resolved.content.trim().split(/\s+/).length : 0;
      const charCount = resolved.content.length;
      return [`${t("terminalWcLinesPrefix")}${lineCount}  ${t("terminalWcWordsPrefix")}${wordCount}  ${t("terminalWcCharsPrefix")}${charCount}`];
    }
    case "stat": {
      if (!filename) return [t("terminalUsageStat")];
      const resolved = resolveEntryPath(files, currentFolderId, filename).file;
      if (!resolved) return [`stat: ${filename}${t("terminalNoSuchFileSuffix")}`];
      return [
        `${t("terminalStatNamePrefix")}${resolved.name}`,
        `${t("terminalStatKindPrefix")}${resolved.kind === "folder" ? t("terminalStatKindFolder") : t("terminalStatKindText")}`,
        `${t("terminalStatPathPrefix")}${getEntryPath(resolved, files)}`,
        `${t("terminalStatSizePrefix")}${resolved.kind === "text" ? formatFileSize(resolved.content) : "-"}`,
        `${t("terminalStatUpdatedPrefix")}${formatFileTime(resolved.updatedAt, locale)}`,
      ];
    }
    case "download": {
      if (!filename) return [t("terminalUsageDownload")];
      const resolved = resolveEntryPath(files, currentFolderId, filename).file;
      if (!resolved) return [`download: ${filename}${t("terminalNoSuchFileSuffix")}`];
      if (resolved.kind !== "text") return [`download: ${filename}${t("terminalIsFolderSuffix")}`];
      const blob = new Blob([resolved.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      context.addDownload({
        name: resolved.name,
        source: t("appTerminal"),
        size: blob.size,
        mimeType: blob.type,
        url,
      });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resolved.name;
      anchor.click();
      return [`${t("terminalDownloadedFilePrefix")}${resolved.name}`];
    }
    case "close": {
      return context.closeWindow() ? [t("terminalClosedWindow")] : [t("terminalCloseFailed")];
    }
    case "theme":
      return [t("terminalThemeLine1"), t("terminalThemeLine2"), t("terminalThemeLine3"), t("terminalThemeLine4")];
    case "help": {
      const sub = args[0];
      if (sub) {
        switch (sub) {
          case "ls": return [t("terminalHelpLs")];
          case "cat": return [t("terminalHelpCat")];
          case "touch": return [t("terminalHelpTouch")];
          case "new": return [t("terminalHelpNew")];
          case "edit": return [t("terminalHelpEdit")];
          case "write": return [t("terminalHelpWrite")];
          case "append": return [t("terminalHelpAppend")];
          case "mkdir": return [t("terminalHelpMkdir1"), t("terminalHelpMkdir2")];
          case "cd": return [t("terminalHelpCd1"), t("terminalHelpCd2")];
          case "rm": return [t("terminalHelpRm")];
          case "trash": return [t("terminalHelpTrash")];
          case "restore": return [t("terminalHelpRestore")];
          case "cp": return [t("terminalHelpCp")];
          case "mv":
          case "rename": return [t("terminalHelpMv")];
          case "open": return [t("terminalHelpOpen")];
          case "find": return [t("terminalHelpFind")];
          case "grep": return [t("terminalHelpGrep")];
          case "tree": return [t("terminalHelpTree")];
          case "head": return [t("terminalHelpHead")];
          case "tail": return [t("terminalHelpTail")];
          case "wc": return [t("terminalHelpWc")];
          case "stat": return [t("terminalHelpStat")];
          case "download": return [t("terminalHelpDownload")];
          case "echo": return [t("terminalHelpEcho")];
          case "history": return [t("terminalHelpHistory")];
          case "whoami": return [t("terminalHelpWhoami")];
          case "uname": return [t("terminalHelpUname")];
          case "apps": return [t("terminalHelpApps")];
          case "launch": return [t("terminalHelpLaunch")];
          case "close": return [t("terminalHelpClose")];
          case "theme": return [t("terminalHelpTheme")];
          case "pwd": return [t("terminalHelpPwd")];
          case "date": return [t("terminalHelpDate")];
          case "curl": return [t("terminalHelpCurl")];
          case "clear":
          case "cls": return [t("terminalHelpClear")];
          default: return [`${t("terminalNoHelpTopicPrefix")}'${sub}'`];
        }
      }
      return [
        t("terminalHelpTitle"),
        t("terminalHelpListLs"),
        t("terminalHelpListCat"),
        t("terminalHelpListTouch"),
        t("terminalHelpListNew"),
        t("terminalHelpListEdit"),
        t("terminalHelpListWrite"),
        t("terminalHelpListAppend"),
        t("terminalHelpListMkdir"),
        t("terminalHelpListMkdirPath"),
        t("terminalHelpListRm"),
        t("terminalHelpListTrash"),
        t("terminalHelpListRestore"),
        t("terminalHelpListCp"),
        t("terminalHelpListMv"),
        t("terminalHelpListCd"),
        t("terminalHelpListCdPath"),
        t("terminalHelpListOpen"),
        t("terminalHelpListFind"),
        t("terminalHelpListGrep"),
        t("terminalHelpListTree"),
        t("terminalHelpListHead"),
        t("terminalHelpListTail"),
        t("terminalHelpListWc"),
        t("terminalHelpListStat"),
        t("terminalHelpListDownload"),
        t("terminalHelpListEcho"),
        t("terminalHelpListHistory"),
        t("terminalHelpListWhoami"),
        t("terminalHelpListUname"),
        t("terminalHelpListApps"),
        t("terminalHelpListLaunch"),
        t("terminalHelpListClose"),
        t("terminalHelpListCurl"),
        t("terminalHelpListPwd"),
        t("terminalHelpListDate"),
        t("terminalHelpListTheme"),
        t("terminalHelpListClear"),
        "",
        t("terminalHelpHint"),
      ];
    }
    default:
      return [`${verb}: ${t("terminalUnknownCommand")}`];
  }
}

async function runCurl(args: string[]) {
  const urlArg = args.find((arg) => !arg.startsWith("-"));
  if (!urlArg) return [useLanguageStore.getState().t("terminalUsageCurl")];

  let url: URL;
  try {
    url = new URL(urlArg.includes("://") ? urlArg : `https://${urlArg}`);
  } catch {
    return [`${useLanguageStore.getState().t("terminalInvalidUrlPrefix")}${urlArg}`];
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return [useLanguageStore.getState().t("terminalCurlHttpOnly")];
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const result = await fetchWithCorsFallback(url.toString(), controller.signal);
    const contentType = result.response.headers.get("content-type") ?? "unknown";
    const text = await result.response.text();
    const body = text.length > 8000 ? `${text.slice(0, 8000)}\n${useLanguageStore.getState().t("terminalTruncated")}` : text;
    return [
      `HTTP ${result.response.status} ${result.response.statusText}${result.viaProxy ? ` (${result.viaProxy})` : ""}`.trim(),
      `${useLanguageStore.getState().t("terminalContentTypePrefix")}${contentType}`,
      `${useLanguageStore.getState().t("terminalSourcePrefix")}${result.finalUrl}`,
      "",
      ...(body ? body.split("\n") : [useLanguageStore.getState().t("terminalEmptyResponse")]),
    ];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return [useLanguageStore.getState().t("terminalCurlTimeout")];
    return [
      useLanguageStore.getState().t("terminalCurlFailed1"),
      useLanguageStore.getState().t("terminalCurlFailed2"),
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
