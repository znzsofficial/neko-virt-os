import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/MmdVrPrepApp";
import { applyThemeSettings, readThemeSettings } from "./system/theme";
import "./styles.css";
import "./styles/mmd-vr-prep.css";

applyThemeSettings(readThemeSettings());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp />
  </StrictMode>,
);
