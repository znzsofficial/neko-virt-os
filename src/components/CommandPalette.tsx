import { Icon } from "@iconify-icon/react";
import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { apps } from "../apps";
import { appDescriptionKeys, appTitleKeys, getAppIcon } from "../appText";
import { getFileOpenApp, queueBrowserOpenUrl } from "../fileOpen";
import { useFsStore } from "../fsStore";
import { readLocalBookmarks, readLocalCalendarEvents, readLocalTasks } from "../localData";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useDesktopStore } from "../windowStore";
type CommandItem = {
  id: string;
  group: TranslationKey;
  title: string;
  subtitle: string;
  icon: string;
  run: () => void;
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const windows = useDesktopStore((state) => state.windows);
  const openApp = useDesktopStore((state) => state.openApp);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const resetWindowLayout = useDesktopStore((state) => state.resetWindowLayout);
  const files = useFsStore((state) => state.files);
  const selectFile = useFsStore((state) => state.selectFile);
  const t = useLanguageStore((state) => state.t);

  const commands = useMemo<CommandItem[]>(() => {
    const appCommands = apps.map((app) => ({
      id: `app:${app.id}`,
      group: "commandApps" as const,
      title: t(appTitleKeys[app.id]),
      subtitle: t(appDescriptionKeys[app.id]),
      icon: app.icon,
      run: () => openApp(app.id),
    }));

    const windowCommands = windows.map((window) => ({
      id: `window:${window.id}`,
      group: "commandWindows" as const,
      title: window.title,
      subtitle: window.minimized ? t("minimized") : t("running"),
      icon: getAppIcon(window.appId, window.icon),
      run: () => {
        restoreWindow(window.id);
        focusWindow(window.id);
      },
    }));

    const fileCommands = files.filter((file) => !file.trashed).slice(0, 40).map((file) => ({
      id: `file:${file.id}`,
      group: "commandFiles" as const,
      title: file.name,
      subtitle: file.kind === "folder" ? t("openFolder") : t("openInNotes"),
      icon: file.kind === "folder" ? "solar:folder-with-files-bold-duotone" : "solar:document-text-bold-duotone",
      run: () => {
        if (file.kind === "folder") {
          const openFolder = (globalThis as any).__files_open_folder as ((folderId: string | null) => void) | undefined;
          openFolder?.(file.id);
          openApp("files");
          return;
        }
        selectFile(file.id);
        openApp(getFileOpenApp(file));
      },
    }));

    const taskCommands = readLocalTasks().filter((task) => !task.done).slice(0, 20).map((task) => ({
      id: `task:${task.id}`,
      group: "commandTasks" as const,
      title: task.text,
      subtitle: task.due ? `${t("tasksDue")}: ${task.due}` : t("pending"),
      icon: "solar:checklist-minimalistic-bold-duotone",
      run: () => openApp("tasks"),
    }));

    const eventCommands = readLocalCalendarEvents().slice(0, 20).map((event) => ({
      id: `event:${event.id}`,
      group: "commandEvents" as const,
      title: event.title,
      subtitle: `${event.date}${event.time ? ` ${event.time}` : ""}`,
      icon: "solar:calendar-bold-duotone",
      run: () => openApp("calendar"),
    }));

    const bookmarkCommands = readLocalBookmarks().slice(0, 20).map((bookmark) => ({
      id: `bookmark:${bookmark.url}`,
      group: "commandBookmarks" as const,
      title: bookmark.title,
      subtitle: bookmark.url,
      icon: bookmark.icon ?? "solar:bookmark-bold-duotone",
      run: () => {
        queueBrowserOpenUrl(bookmark.url);
        openApp("browser");
      },
    }));

    return [
      ...appCommands,
      ...windowCommands,
      ...fileCommands,
      ...taskCommands,
      ...eventCommands,
      ...bookmarkCommands,
      {
        id: "system:reset-windows",
        group: "commandSystem",
        title: t("resetWindowLayoutLabel"),
        subtitle: t("resetWindows"),
        icon: "solar:restart-bold-duotone",
        run: resetWindowLayout,
      },
    ];
  }, [files, focusWindow, openApp, resetWindowLayout, restoreWindow, selectFile, t, windows]);

  const visibleCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const fuse = new Fuse(commands, { keys: ["title", "subtitle"], threshold: 0.38 });
    return fuse.search(query).map((result) => result.item);
  }, [commands, query]);

  const groups = ["commandApps", "commandWindows", "commandFiles", "commandTasks", "commandEvents", "commandBookmarks", "commandSystem"] as const;

  function runCommand(command: CommandItem) {
    command.run();
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label={t("commandPalette")} shouldFilter={false}>
      <Command.Input value={query} onValueChange={setQuery} placeholder={t("commandPlaceholder")} />
      <Command.List>
        <Command.Empty>{t("commandNoResults")}</Command.Empty>
        {groups.map((group) => {
          const items = visibleCommands.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <Command.Group key={group} heading={t(group)}>
              {items.map((item) => (
                <Command.Item key={item.id} value={item.id} onSelect={() => runCommand(item)}>
                  <Icon icon={item.icon} width={18} height={18} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command.Dialog>
  );
}
