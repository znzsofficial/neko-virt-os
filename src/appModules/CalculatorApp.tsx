import { useState } from "react";

export function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

  function press(key: string) {
    if (key === "C") {
      setDisplay("0");
      return;
    }
    if (key === "⌫") {
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : "0");
      return;
    }
    if (key === "=") {
      if (!/^[\d+\-*/().\s]+$/.test(display)) return;
      try {
        const result = Function(`"use strict"; return (${display})`)();
        setDisplay(String(Number.isFinite(result) ? Math.round(result * 100000000) / 100000000 : "Error"));
      } catch {
        setDisplay("Error");
      }
      return;
    }
    setDisplay((current) => current === "0" || current === "Error" ? key : current + key);
  }

  return (
    <div className="calculator-app">
      <output>{display}</output>
      <div className="calculator-grid">
        <button className="calculator-wide" onClick={() => press("C")}>C</button>
        <button onClick={() => press("⌫")}>⌫</button>
        {keys.map((key) => <button key={key} className={key === "=" ? "is-equals" : undefined} onClick={() => press(key)}>{key}</button>)}
      </div>
    </div>
  );
}
