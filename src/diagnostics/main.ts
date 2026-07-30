import "../styles/app.css";
import { applyTheme } from "../shared/theme";

applyTheme("light");
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Diagnostics root missing");

const states = [
  ["generating", "↻", "Generating"],
  ["finished_unread", "●", "Finished / Unread"],
  ["waiting", "?", "Waiting for Input"],
  ["error", "!", "Error"],
  ["idle", "✓", "Idle"],
  ["recent", "◷", "Recent"]
];

root.innerHTML = `<div class="app-shell diagnostics-shell">
  <header class="topbar"><a class="brand" href="dashboard.html"><img src="/icons/icon-48.png" alt="" width="38" height="38"/><span><strong>PromptDeck</strong><small>Diagnostics harness</small></span></a><a class="secondary button-link" href="dashboard.html">← Dashboard</a></header>
  <main>
    <section class="settings-intro"><span class="eyebrow">Development tool</span><h1>Status visual reference</h1><p>Use this offline harness to inspect every card state without a live AI service.</p></section>
    <div class="diagnostic-controls"><button id="toggle-theme">Toggle dark theme</button><button id="toggle-view">Toggle layout</button></div>
    <section id="diagnostic-grid" class="card-grid">${states
      .map(
        ([status, icon, name], index) => `<article class="conversation-card card-${status}">
          <div class="card-stripe"></div><header class="card-header"><button class="card-focus"><span class="platform-mark platform-${index % 3 === 0 ? "chatgpt" : index % 3 === 1 ? "claude" : "gemini"}">${index % 3 === 0 ? "C" : index % 3 === 1 ? "A" : "G"}</span><span class="card-heading"><span class="eyebrow">Fixture ${index + 1}</span><span class="card-title">${name} conversation</span></span></button></header>
          <div class="status-row"><span class="status-badge status-${status}"><span>${icon}</span> ${name}</span></div>
          <p class="card-activity"><span>Activity</span> just now</p>
        </article>`
      )
      .join("")}</section>
  </main>
</div>`;

let dark = false;
let compact = false;
root.addEventListener("click", (event) => {
  const id = (event.target as HTMLElement).closest("button")?.id;
  if (id === "toggle-theme") {
    dark = !dark;
    applyTheme(dark ? "dark" : "light");
  }
  if (id === "toggle-view") {
    compact = !compact;
    document.querySelector("#diagnostic-grid")?.classList.toggle("diagnostic-list", compact);
  }
});
