import { useEffect, useRef, useState } from "react";
import { useDialogStore } from "../dialogStore";
import { useLanguageStore } from "../languageStore";

export function AppDialogHost() {
  const t = useLanguageStore((state) => state.t);
  const current = useDialogStore((state) => state.current);
  const settle = useDialogStore((state) => state.settle);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (current && !restoreFocusRef.current) {
      const active = document.activeElement;
      restoreFocusRef.current = active instanceof HTMLElement ? active : null;
    }
    if (current) return;
    const element = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (element?.isConnected) {
      window.setTimeout(() => element.focus(), 0);
    }
  }, [current]);

  useEffect(() => {
    if (!current) return;
    setValue(current.defaultValue ?? "");
    const id = window.setTimeout(() => {
      if (current.kind === "prompt") inputRef.current?.focus();
      else if (current.danger) cancelRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(current!.kind === "alert" ? true : null);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, settle]);

  if (!current) return null;

  const confirmLabel = current.confirmLabel
    ?? (current.kind === "alert" ? t("dialogOk") : t("dialogConfirm"));
  const cancelLabel = current.cancelLabel ?? t("dialogCancel");

  return (
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && current.kind !== "alert") {
          settle(null);
        }
      }}
    >
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
      >
        <h3 id="app-dialog-title">{current.title}</h3>
        <p id="app-dialog-message" className="app-dialog-message">
          {current.message}
        </p>
        {current.kind === "prompt" ? (
          <input
            ref={inputRef}
            className="app-dialog-input"
            value={value}
            placeholder={current.placeholder}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                settle(value);
              }
            }}
          />
        ) : null}
        <div className="app-dialog-actions">
          {current.kind !== "alert" ? (
            <button ref={cancelRef} type="button" className="button-ghost" onClick={() => settle(null)}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            className={current.danger ? "button-primary app-dialog-danger" : "button-primary"}
            onClick={() => {
              if (current.kind === "prompt") settle(value);
              else settle(true);
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
