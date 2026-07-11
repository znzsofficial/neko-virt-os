import { useEffect, useRef, useState } from "react";

type HistoryEntry = { expression: string; result: string };

export function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [memory, setMemory] = useState(0);
  const pressRef = useRef<(key: string) => void>(() => {});
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

  function evaluate(expression: string) {
    if (!/^[\d+\-*/().\s]+$/.test(expression)) return null;
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      if (typeof result !== "number" || !Number.isFinite(result)) return null;
      return String(Math.round(result * 1e8) / 1e8);
    } catch {
      return null;
    }
  }

  function press(key: string) {
    if (key === "C") {
      setDisplay("0");
      return;
    }
    if (key === "⌫") {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : "0");
      return;
    }
    if (key === "±") {
      setDisplay((current) => {
        if (current === "0" || current === "Error") return current;
        return current.startsWith("-") ? current.slice(1) : `-${current}`;
      });
      return;
    }
    if (key === "%") {
      setDisplay((current) => {
        const value = Number(current);
        if (!Number.isFinite(value)) return "Error";
        return String(Math.round(value * 1e6) / 1e8);
      });
      return;
    }
    if (key === "MC") {
      setMemory(0);
      return;
    }
    if (key === "MR") {
      setDisplay(String(memory));
      return;
    }
    if (key === "M+") {
      const value = Number(display);
      if (Number.isFinite(value)) setMemory((current) => current + value);
      return;
    }
    if (key === "M-") {
      const value = Number(display);
      if (Number.isFinite(value)) setMemory((current) => current - value);
      return;
    }
    if (key === "=") {
      const expression = display;
      const result = evaluate(expression);
      if (result == null) {
        setDisplay("Error");
        return;
      }
      setHistory((current) => [{ expression, result }, ...current].slice(0, 12));
      setDisplay(result);
      return;
    }
    setDisplay((current) => current === "0" || current === "Error" ? key : current + key);
  }

  pressRef.current = press;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = event.key;
      if (/^[0-9.+\-*/]$/.test(key)) {
        event.preventDefault();
        pressRef.current(key);
        return;
      }
      if (key === "Enter" || key === "=") {
        event.preventDefault();
        pressRef.current("=");
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        pressRef.current("⌫");
        return;
      }
      if (key === "Escape" || key.toLowerCase() === "c") {
        event.preventDefault();
        pressRef.current("C");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="calculator-app">
      <output aria-live="polite">{display}</output>
      {memory !== 0 ? <div className="calculator-memory">M: {memory}</div> : null}
      <div className="calculator-grid">
        <button type="button" onClick={() => press("MC")}>MC</button>
        <button type="button" onClick={() => press("MR")}>MR</button>
        <button type="button" onClick={() => press("M+")}>M+</button>
        <button type="button" onClick={() => press("M-")}>M-</button>
        <button type="button" className="calculator-wide" onClick={() => press("C")}>C</button>
        <button type="button" onClick={() => press("⌫")}>⌫</button>
        <button type="button" onClick={() => press("%")}>%</button>
        <button type="button" onClick={() => press("±")}>±</button>
        {keys.map((key) => (
          <button key={key} type="button" className={key === "=" ? "is-equals" : undefined} onClick={() => press(key)}>
            {key}
          </button>
        ))}
      </div>
      {history.length ? (
        <div className="calculator-history">
          {history.map((entry, index) => (
            <button
              key={`${entry.expression}-${entry.result}-${index}`}
              type="button"
              className="calculator-history-item"
              onClick={() => setDisplay(entry.result)}
            >
              <span>{entry.expression}</span>
              <strong>={entry.result}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
