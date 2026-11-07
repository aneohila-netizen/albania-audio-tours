import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerOfflineWorker } from "./lib/offline";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);

// Offline downloads + weak-signal fallback (see public/sw.js). Silent if the browser lacks support.
registerOfflineWorker();
