import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useLanguageStore } from "./languageStore";
import { syncDeferredUiFont } from "./system/deferredUiFont";
import { initOverlayScrollbars } from "./system/overlayScrollbars";
import { initializeThemeSync } from "./system/theme";
import "./styles.css";
import "./styles/material.css";

initOverlayScrollbars();
initializeThemeSync();
syncDeferredUiFont(useLanguageStore.getState().language);
useLanguageStore.subscribe((state, previousState) => {
  if (state.language !== previousState.language) syncDeferredUiFont(state.language);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
