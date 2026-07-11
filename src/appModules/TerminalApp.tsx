import { useState } from "react";
import { findFileByName, formatFileSize, formatFileTime } from "../fileUtils";
import { useFsStore } from "../fsStore";
import { useLanguageStore } from "../languageStore";
import type { FileMutationResult } from "../types";
import type { FsFile } from "../virtualFs";
import { useDesktopStore } from "../windowStore";

type TerminalContext = {
  files: FsFile[];
  createNamedFile: (name: string) => Promise<FileMutationResult>;
  deleteFileByName: (name: string) => Promise<FsFile | null>;
  renameFileByName: (fromName: string, toName: string) => Promise<FileMutationResult>;
  selectFileByName: (name: string) => FsFile | null;
  openNotes: () => void;
};

export function TerminalApp() {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<string[]>([
    "boot --quiet",
    "loading window-manager... ok",
    "mounting indexeddb://local-fs... ok",
    "type `help` to list commands",
  ]);
  const files = useFsStore((state) => state.files);
  const createNamedFile = useFsStore((state) => state.createNamedFile);
  const deleteFileByName = useFsStore((state) => state.deleteFileByName);
  const renameFileByName = useFsStore((state) => state.renameFileByName);
  const selectFileByName = useFsStore((state) => state.selectFileByName);
  const openApp = useDesktopStore((state) => state.openApp);
  const t = useLanguageStore((state) => state.t);

  async function runCommand(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setLines([]);
      setCommand("");
      return;
    }

    const output = await executeTerminalCommand(trimmed, {
      files,
      createNamedFile,
      deleteFileByName,
      renameFileByName,
      selectFileByName,
      openNotes: () => openApp("notes"),
    });

    setLines((current) => [...current, `neko@virt-os:~$ ${trimmed}`, ...(output || [])]);
    setCommand("");
  }

  return (
    <div className="terminal-app" aria-label={t("terminalOutput")}>
      <div className="terminal-lines">
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
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
      </form>
    </div>
  );
}

async function executeTerminalCommand(command: string, context: TerminalContext) {
  const [verb, ...args] = splitCommand(command);
  const filename = args.join(" ");

  switch (verb) {
    case "ls":
      return context.files.length
        ? context.files.map((file) => `${file.name.padEnd(22, " ")} ${formatFileSize(file.content).padStart(7, " ")}  ${formatFileTime(file.updatedAt)}`)
        : ["no files found"];
    case "cat": {
      if (!filename) return ["usage: cat <file>"];
      const file = findFileByName(context.files, filename);
      if (!file) return [`cat: ${filename}: no such file`];
      return file.content ? file.content.split("\n") : ["(empty file)"];
    }
    case "touch": {
      if (!filename) return ["usage: touch <file>"];
      const result = await context.createNamedFile(filename);
      if (result.error) return [`touch: ${result.error}`];
      return result.file ? [`created or selected ${result.file.name}`] : ["touch: create failed"];
    }
    case "pwd":
      return ["nya://local/home"];
    case "date":
      return [new Date().toString()];
    case "curl":
      return runCurl(args);
    case "rm": {
      if (!filename) return ["usage: rm <file>"];
      const deleted = await context.deleteFileByName(filename);
      return deleted ? [`moved ${deleted.name} to Trash`] : [`rm: ${filename}: no such file`];
    }
    case "mv":
    case "rename": {
      const [fromName, toName, ...extra] = args;
      if (!fromName || !toName || extra.length) return [`usage: ${verb} <from> <to>`];
      const result = await context.renameFileByName(fromName, toName);
      if (result.error) return [`${verb}: ${result.error}`];
      return result.file ? [`renamed ${fromName} -> ${result.file.name}`] : [`${verb}: rename failed`];
    }
    case "open": {
      if (!filename) return ["usage: open <file>"];
      const file = context.selectFileByName(filename);
      if (!file) return [`open: ${filename}: no such file`];
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
          case "rm": return ["rm <file> - Move a text file to Trash."];
          case "mv": return ["mv <from> <to> - Rename an existing file."];
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
        "  rm <file>          move a text file to Trash",
        "  mv <from> <to>     rename a text file",
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
