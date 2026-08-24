import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MiniPlayer from "./mini/MiniPlayer";
import { LangProvider } from "./lib/i18n";

// Electron-окно мини-плеера грузит тот же index.html с параметром ?mini=1
const isMini = new URLSearchParams(window.location.search).get("mini") === "1";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>{isMini ? <MiniPlayer /> : <App />}</LangProvider>
  </StrictMode>
);
