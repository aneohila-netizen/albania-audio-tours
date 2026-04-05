import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// ── iOS Safari viewport height fix ──────────────────────────────────────────────
// iOS Safari reports 100vh including the hidden browser chrome, causing
// content to be obscured. We set --app-height to window.innerHeight (the
// actual visible pixel height) and update it on resize/orientation change.
// Used by MapPage: height: calc(var(--app-height, 100dvh) - 114px)
function setAppHeight() {
  // Use window.innerHeight — the actual visible pixel height on iOS Safari
  // (100vh on iOS includes hidden browser chrome and is too tall)
  document.documentElement.style.setProperty(
    "--app-height",
    `${window.innerHeight}px`
  );
}

function setHeaderHeight() {
  // Measure the actual rendered height of all elements above the map
  // (LaunchBanner + NavBar) so the map fills exactly the remaining space.
  // Falls back to 114px if elements not yet rendered.
  const header = document.querySelector("[data-header-measure]") as HTMLElement | null;
  if (header) {
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`
    );
  }
}

setAppHeight();
window.addEventListener("resize", () => { setAppHeight(); setHeaderHeight(); });
window.addEventListener("orientationchange", () => {
  setTimeout(() => { setAppHeight(); setHeaderHeight(); }, 100);
});
// Set header height after first render
requestAnimationFrame(() => setTimeout(setHeaderHeight, 50));

createRoot(document.getElementById("root")!).render(<App />);
