import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";

type LocalTask = { id: string; text: string; done: boolean };

const TASKS_STORAGE_KEY = "neko-virt-os.tasks.v1";

function readTasks(): LocalTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function TasksApp() {
  const [tasks, setTasks] = useState<LocalTask[]>(readTasks);
  const [draft, setDraft] = useState("");
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask() {
    const text = draft.trim();
    if (!text) return;
    setTasks((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, done: false }, ...current]);
    setDraft("");
  }

  return (
    <div className="tasks-app">
      <form className="tasks-form" onSubmit={(event) => { event.preventDefault(); addTask(); }}>
        <input value={draft} placeholder={t("tasksPlaceholder")} onChange={(event) => setDraft(event.target.value)} />
        <button className="button-primary" type="submit">{t("addTask")}</button>
      </form>
      <div className="tasks-summary">
        <span>{tasks.filter((task) => !task.done).length} {t("pending")}</span>
        <button className="button-ghost" onClick={() => setTasks((current) => current.filter((task) => !task.done))}>{t("clearDone")}</button>
      </div>
      <div className="tasks-list">
        {tasks.length ? tasks.map((task) => (
          <label key={task.id} className={clsx("task-item", task.done && "is-done")}>
            <input type="checkbox" checked={task.done} onChange={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />
            <span>{task.text}</span>
            <button type="button" onClick={(event) => { event.preventDefault(); setTasks((current) => current.filter((item) => item.id !== task.id)); }}>×</button>
          </label>
        )) : <div className="empty-state"><p>{t("noTasks")}</p></div>}
      </div>
    </div>
  );
}
