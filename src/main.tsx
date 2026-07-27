import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useLanguageStore } from "./languageStore";
import { syncDeferredUiFont } from "./system/deferredUiFont";
import "./styles.css";

syncDeferredUiFont(useLanguageStore.getState().language);
useLanguageStore.subscribe((state, previousState) => {
  if (state.language !== previousState.language) syncDeferredUiFont(state.language);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
