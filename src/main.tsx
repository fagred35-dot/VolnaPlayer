import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MiniPlayer from "./mini/MiniPlayer";

// Electron-окно мини-плеера грузит тот же index.html с параметром ?mini=1
const isMini = new URLSearchParams(window.location.search).get("mini") === "1";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isMini ? <MiniPlayer /> : <App />}</StrictMode>
);
