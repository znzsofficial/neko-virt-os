import { Icon } from "@iconify-icon/react";
import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { apps } from "../apps";
import { appDescriptionKeys, appTitleKeys, getAppIcon } from "../appText";
import { useFsStore } from "../fsStore";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { useDesktopStore } from "../windowStore";
import type { AppId } from "../types";

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

    const fileCommands = files.filter((file) => !file.trashed).slice(0, 24).map((file) => ({
      id: `file:${file.id}`,
      group: "commandFiles" as const,
      title: file.name,
      subtitle: t("open"),
      icon: "solar:document-text-bold-duotone",
      run: () => {
        selectFile(file.id);
        openApp("notes" as AppId);
      },
    }));

    return [
      ...appCommands,
      ...windowCommands,
      ...fileCommands,
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

  const groups = ["commandApps", "commandWindows", "commandFiles", "commandSystem"] as const;

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
