import "../styles/app.css";
import { send } from "../shared/api";
import { applyTheme } from "../shared/theme";
import type { Settings } from "../shared/types";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Options root missing");
const root: HTMLDivElement = rootElement;

let settings: Settings | null = null;

function selected(value: string, expected: string): string {
  return value === expected ? " selected" : "";
}

async function render(message = ""): Promise<void> {
  const response = await send({ type: "GET_DASHBOARD_STATE" });
  if (!response.ok || !response.state) {
    root.innerHTML = '<main class="settings-shell"><h1>Settings unavailable</h1></main>';
    return;
  }
  settings = response.state.settings;
  applyTheme(settings.theme);
  root.innerHTML = `<div class="settings-shell">
    <header class="settings-header"><a class="brand" href="dashboard.html"><img src="/icons/icon-48.png" alt="" width="38" height="38" /><span><strong>PromptDeck</strong><small>Settings</small></span></a><a class="secondary button-link" href="dashboard.html">← Dashboard</a></header>
    <main class="settings-main">
      <div class="settings-intro"><span class="eyebrow">Preferences</span><h1>Make PromptDeck yours.</h1><p>Every setting is stored locally in Chrome.</p></div>
      ${message ? `<div class="banner success-banner" role="status">${message}</div>` : ""}
      <section class="settings-section"><div><h2>Appearance</h2><p>Choose how the dashboard looks.</p></div><div class="settings-controls">
        <label>Theme<select id="theme">
          <option value="light"${selected(settings.theme, "light")}>Light</option>
          <option value="dark"${selected(settings.theme, "dark")}>Dark</option>
          <option value="system"${selected(settings.theme, "system")}>System</option>
        </select></label>
        <label>Default dashboard view<select id="defaultView">
          <option value="grid"${selected(settings.defaultView, "grid")}>Grid</option>
          <option value="kanban"${selected(settings.defaultView, "kanban")}>Kanban</option>
        </select></label>
      </div></section>
      <section class="settings-section"><div><h2>Privacy</h2><p>Previews are always plain text and off by default.</p></div><div class="settings-controls">
        <label class="toggle-row"><span><strong>Show message previews</strong><small>Reveal short assistant excerpts in cards.</small></span><input id="showMessagePreviews" type="checkbox" ${settings.showMessagePreviews ? "checked" : ""}/></label>
        <label class="toggle-row"><span><strong>Persist message previews</strong><small>Store short excerpts across Chrome restarts.</small></span><input id="persistMessagePreviews" type="checkbox" ${settings.persistMessagePreviews ? "checked" : ""}/></label>
        <div class="button-row"><button data-command="CLEAR_PREVIEWS">Clear stored previews</button><button data-command="CLEAR_RECENT">Clear recent conversations</button><button class="danger" data-command="CLEAR_ALL_DATA">Clear all PromptDeck data</button></div>
      </div></section>
      <section class="settings-section"><div><h2>Notifications</h2><p>Chrome controls final delivery and presentation.</p></div><div class="settings-controls">
        <label class="toggle-row"><span><strong>Generation finished</strong><small>Notify when a new response completes.</small></span><input id="notifyFinished" type="checkbox" ${settings.notifyFinished ? "checked" : ""}/></label>
        <label class="toggle-row"><span><strong>Waiting for input</strong><small>Notify for explicit requests that need you.</small></span><input id="notifyWaiting" type="checkbox" ${settings.notifyWaiting ? "checked" : ""}/></label>
        <label class="toggle-row"><span><strong>Errors</strong><small>Notify when the platform reports a failure.</small></span><input id="notifyError" type="checkbox" ${settings.notifyError ? "checked" : ""}/></label>
        <label class="toggle-row"><span><strong>Suppress finished while visible</strong><small>Skip finished alerts when you are already viewing the chat.</small></span><input id="suppressFinishedWhenVisible" type="checkbox" ${settings.suppressFinishedWhenVisible ? "checked" : ""}/></label>
      </div></section>
      <section class="settings-section"><div><h2>Behavior</h2><p>Recent retention is fixed at exactly 7 days.</p></div><div class="settings-controls">
        <label>Mark viewed after focus delay
          <select id="markViewedDelayMs">
            <option value="500"${selected(String(settings.markViewedDelayMs), "500")}>0.5 seconds</option>
            <option value="900"${selected(String(settings.markViewedDelayMs), "900")}>0.9 seconds</option>
            <option value="1500"${selected(String(settings.markViewedDelayMs), "1500")}>1.5 seconds</option>
            <option value="2500"${selected(String(settings.markViewedDelayMs), "2500")}>2.5 seconds</option>
          </select>
        </label>
        <button id="rescan">Rescan supported tabs now</button>
      </div></section>
      <p class="privacy-note">PromptDeck never sends conversation data to external servers. It does not read cookies, credentials, localStorage, request headers, or hidden page data.</p>
    </main>
  </div>`;
}

root.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (!settings || !target.id) return;
  const value =
    target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.id === "markViewedDelayMs"
        ? Number(target.value)
        : target.value;
  const patch =
    target.id === "defaultView"
      ? { defaultView: value, viewMode: value }
      : { [target.id]: value };
  void send({ type: "UPDATE_SETTINGS", patch: patch as Partial<Settings> }).then(() =>
    render("Setting saved")
  );
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;
  if (button.id === "rescan") {
    void send({ type: "RESCAN_TABS" }).then(() => render("Supported tabs rescanned"));
    return;
  }
  const command = button.dataset.command;
  if (command === "CLEAR_ALL_DATA") {
    if (!window.confirm("Clear all PromptDeck conversations, labels, settings, and recent items?")) return;
    void send({ type: "CLEAR_ALL_DATA" }).then(() => render("All local PromptDeck data cleared"));
  } else if (command === "CLEAR_PREVIEWS" || command === "CLEAR_RECENT") {
    void send({ type: command }).then(() =>
      render(command === "CLEAR_PREVIEWS" ? "Stored previews cleared" : "Recent conversations cleared")
    );
  }
});

void render();
