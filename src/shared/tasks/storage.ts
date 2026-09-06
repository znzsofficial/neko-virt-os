import { removeOwnedLocalStorageItem, setOwnedLocalStorageItem } from "../../system/persistenceGate";

export const TASKS_STORAGE_KEY = "neko-virt-os.tasks.v2";
const TASKS_LEGACY_KEY = "neko-virt-os.tasks.v1";

export type TaskPriority = "low" | "medium" | "high";

export type LocalTaskItem = {
  id: string;
  text: string;
  done: boolean;
  due?: string;
  priority: TaskPriority;
};

function normalizePriority(value: unknown): TaskPriority {
  if (value === "low" || value === "high") return value;
  return "medium";
}

function normalizeTaskList(raw: unknown): LocalTaskItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((task) => ({
      id: String(task.id ?? ""),
      text: String(task.text ?? ""),
      done: Boolean(task.done),
      due: typeof task.due === "string" && task.due ? task.due : undefined,
      priority: normalizePriority(task.priority),
    }))
    .filter((task) => task.id && task.text);
}

/** Historical format: bare JSON array (v1 + v2). */
export function readTasks(): LocalTaskItem[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          removeOwnedLocalStorageItem(TASKS_LEGACY_KEY);
          return normalizeTaskList(parsed);
        }
      } catch {
        // Corrupted v2 value: keep the legacy key and fall back to v1 below.
      }
    }
    const legacy = localStorage.getItem(TASKS_LEGACY_KEY);
    if (!legacy) return [];
    return normalizeTaskList(JSON.parse(legacy));
  } catch {
    return [];
  }
}

export function writeTasks(tasks: LocalTaskItem[]) {
  try {
    setOwnedLocalStorageItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

export function getPendingTasks(limit = 5): LocalTaskItem[] {
  return readTasks()
    .filter((task) => !task.done)
    .slice(0, limit);
}
