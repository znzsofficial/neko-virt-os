export type SettingsSection = "general" | "appearance" | "notifications" | "network" | "data" | "developer" | "about";

let requestedSection: SettingsSection | null = null;
const listeners = new Set<(section: SettingsSection) => void>();

export function requestSettingsSection(section: SettingsSection) {
  if (listeners.size === 0) {
    requestedSection = section;
    return;
  }
  requestedSection = null;
  listeners.forEach((listener) => listener(section));
}

export function consumeSettingsSection(fallback: SettingsSection): SettingsSection {
  const section = requestedSection ?? fallback;
  requestedSection = null;
  return section;
}

export function subscribeSettingsSection(listener: (section: SettingsSection) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
