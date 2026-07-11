import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useLanguageStore } from "../languageStore";

type TaskPriority = "low" | "medium" | "high";
type TaskFilter = "all" | "active" | "done";

type LocalTask = {
  id: string;
  text: string;
  done: boolean;
  due?: string;
  priority: TaskPriority;
};

const TASKS_STORAGE_KEY = "neko-virt-os.tasks.v2";
const TASKS_LEGACY_KEY = "neko-virt-os.tasks.v1";

function readTasks(): LocalTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY) ?? localStorage.getItem(TASKS_LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<LocalTask> & { id: string; text: string; done: boolean }>;
    return parsed.map((task) => ({
      id: task.id,
      text: task.text,
      done: Boolean(task.done),
      due: task.due,
      priority: task.priority === "low" || task.priority === "high" ? task.priority : "medium",
    }));
  } catch {
    return [];
  }
}

export function TasksApp() {
  const [tasks, setTasks] = useState<LocalTask[]>(readTasks);
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskPriority>("medium");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [query, setQuery] = useState("");
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (filter === "active" && task.done) return false;
        if (filter === "done" && !task.done) return false;
        if (normalized && !task.text.toLowerCase().includes(normalized)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const priorityRank = { high: 0, medium: 1, low: 2 };
        if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
        return (a.due || "9999").localeCompare(b.due || "9999");
      });
  }, [tasks, filter, query]);

  function addTask() {
    const text = draft.trim();
    if (!text) return;
    setTasks((current) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      done: false,
      due: draftDue || undefined,
      priority: draftPriority,
    }, ...current]);
    setDraft("");
    setDraftDue("");
    setDraftPriority("medium");
  }

  function moveTask(id: string, direction: -1 | 1) {
    setTasks((current) => {
      const index = current.findIndex((task) => task.id === id);
      if (index < 0) return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="tasks-app">
      <form className="tasks-form" onSubmit={(event) => { event.preventDefault(); addTask(); }}>
        <input value={draft} placeholder={t("tasksPlaceholder")} onChange={(event) => setDraft(event.target.value)} />
        <input type="date" value={draftDue} onChange={(event) => setDraftDue(event.target.value)} aria-label={t("tasksDue")} />
        <select value={draftPriority} onChange={(event) => setDraftPriority(event.target.value as TaskPriority)} aria-label={t("tasksPriority")}>
          <option value="low">{t("tasksPriorityLow")}</option>
          <option value="medium">{t("tasksPriorityMedium")}</option>
          <option value="high">{t("tasksPriorityHigh")}</option>
        </select>
        <button className="button-primary" type="submit">{t("addTask")}</button>
      </form>

      <div className="tasks-toolbar">
        <input value={query} placeholder={t("tasksSearch")} onChange={(event) => setQuery(event.target.value)} />
        <div className="tasks-filters">
          {([
            ["all", t("tasksFilterAll")],
            ["active", t("tasksFilterActive")],
            ["done", t("tasksFilterDone")],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={clsx(filter === id && "is-active")} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="tasks-summary">
        <span>{tasks.filter((task) => !task.done).length} {t("pending")}</span>
        <button className="button-ghost" onClick={() => setTasks((current) => current.filter((task) => !task.done))}>{t("clearDone")}</button>
      </div>

      <div className="tasks-list">
        {visibleTasks.length ? visibleTasks.map((task) => (
          <label key={task.id} className={clsx("task-item", task.done && "is-done", `priority-${task.priority}`)}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}
            />
            <span className="task-main">
              <strong>{task.text}</strong>
              <small>
                {task.priority === "high" ? t("tasksPriorityHigh") : task.priority === "low" ? t("tasksPriorityLow") : t("tasksPriorityMedium")}
                {task.due ? ` · ${task.due}` : ""}
              </small>
            </span>
            <div className="task-actions">
              <button type="button" onClick={(event) => { event.preventDefault(); moveTask(task.id, -1); }}>↑</button>
              <button type="button" onClick={(event) => { event.preventDefault(); moveTask(task.id, 1); }}>↓</button>
              <button type="button" onClick={(event) => { event.preventDefault(); setTasks((current) => current.filter((item) => item.id !== task.id)); }}>×</button>
            </div>
          </label>
        )) : <div className="empty-state"><p>{t("noTasks")}</p></div>}
      </div>
    </div>
  );
}
