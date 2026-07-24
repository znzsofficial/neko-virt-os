import { Icon } from "@iconify-icon/react";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../languageStore";
import { readStickyNotes, writeStickyNotes, type StickyNote } from "../shared";

export function StickyBoardApp() {
  const [notes, setNotes] = useState<StickyNote[]>(readStickyNotes);
  const t = useLanguageStore((state) => state.t);

  useEffect(() => {
    writeStickyNotes(notes);
  }, [notes]);

  function addNote() {
    setNotes((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "" }, ...current]);
  }

  return (
    <div className="sticky-board-app">
      <div className="app-toolbar compact">
        <div>
          <h2>{t("appStickyBoard")}</h2>
          <p>{notes.length ? `${notes.length} ${t("itemsCount")}` : t("stickyBoardEmpty")}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="button-ghost" disabled={!notes.length} onClick={() => setNotes([])}>
            {t("stickyBoardClearAll")}
          </button>
          <button type="button" className="button-primary" onClick={addNote}>
            {t("stickyBoardNew")}
          </button>
        </div>
      </div>
      {notes.length ? (
        <div className="sticky-board-grid">
          {notes.map((note, index) => (
            <article key={note.id} className={`sticky-card sticky-color-${index % 4}`}>
              <textarea
                value={note.text}
                placeholder={t("stickyBoardPlaceholder")}
                onChange={(event) => setNotes((current) => current.map((item) => item.id === note.id ? { ...item, text: event.target.value } : item))}
              />
              <button type="button" className="sticky-delete" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}>
                {t("delete")}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon icon="solar:notes-bold-duotone" width={34} height={34} />
          <p>{t("stickyBoardEmpty")}</p>
        </div>
      )}
    </div>
  );
}
