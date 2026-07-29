import "../styles/app.css";
import { applyTheme } from "../shared/theme";

applyTheme("light");
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Diagnostics root missing");

const states = [
  ["generating", "↻", "Generating", "Streaming markers and stop control detected."],
  ["finished_unread", "●", "Finished / Unread", "A new completed response was observed off-tab."],
  ["waiting", "?", "Waiting for Input", "Explicit confirmation request detected."],
  ["error", "!", "Error", "A platform error banner was detected."],
  ["idle", "✓", "Idle", "The latest response has been viewed."],
  ["recent", "◷", "Recent", "The original tab is closed and retained for 7 days."]
];

root.innerHTML = `<div class="app-shell diagnostics-shell">
  <header class="topbar"><a class="brand" href="dashboard.html"><img src="/icons/icon-48.png" alt="" width="38" height="38"/><span><strong>PromptDeck</strong><small>Diagnostics harness</small></span></a><a class="secondary button-link" href="dashboard.html">← Dashboard</a></header>
  <main>
    <section class="settings-intro"><span class="eyebrow">Development tool</span><h1>Status visual reference</h1><p>Use this offline harness to inspect every card state without a live AI service.</p></section>
    <div class="diagnostic-controls"><button id="toggle-theme">Toggle dark theme</button><button id="toggle-view">Toggle layout</button></div>
    <section id="diagnostic-grid" class="card-grid">${states
      .map(
        ([status, icon, name, detail], index) => `<article class="conversation-card card-${status}">
          <div class="card-stripe"></div><header class="card-header"><span class="platform-mark platform-${index % 3 === 0 ? "chatgpt" : index % 3 === 1 ? "claude" : "gemini"}">${index % 3 === 0 ? "C" : index % 3 === 1 ? "A" : "G"}</span><div class="card-heading"><span class="eyebrow">Fixture ${index + 1}</span><h3>${name} conversation</h3></div></header>
          <div class="status-row"><span class="status-badge status-${status}"><span>${icon}</span> ${name}</span></div>
          <p class="preview">${detail}</p><div class="label-row"><span class="label-chip label-work">Work</span><span class="label-chip label-review">Review</span></div>
          <dl class="card-meta"><div><dt>Window</dt><dd>Window 1</dd></div><div><dt>Activity</dt><dd>just now</dd></div><div><dt>Host</dt><dd>fixture.local</dd></div></dl>
          <button class="primary card-open">Focus conversation →</button>
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
