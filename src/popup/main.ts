import "../styles/app.css";
import { send } from "../shared/api";
import { applyTheme } from "../shared/theme";
import type { ConversationRecord } from "../shared/types";
import { displayStatus } from "../dashboard/state";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Popup root missing");
const root: HTMLDivElement = rootElement;

function count(records: ConversationRecord[], status: ReturnType<typeof displayStatus>): number {
  return records.filter((record) => displayStatus(record) === status).length;
}

async function render(): Promise<void> {
  const response = await send({ type: "GET_DASHBOARD_STATE" });
  if (!response.ok || !response.state) {
    root.innerHTML = '<main class="popup"><p>PromptDeck is unavailable. Try opening the dashboard.</p></main>';
    return;
  }
  applyTheme(response.state.settings.theme);
  const records = response.state.conversations;
  const active = records.filter((record) => record.openTabIds.length).length;
  root.innerHTML = `<main class="popup">
    <header class="popup-brand"><img src="/icons/icon-48.png" alt="" width="38" height="38" /><div><strong>PromptDeck</strong><small>AI attention, organized.</small></div></header>
    <div class="popup-total"><span>Active conversations</span><strong>${active}</strong></div>
    <dl class="popup-stats">
      <div><dt><span class="dot generating"></span>Generating</dt><dd>${count(records, "generating")}</dd></div>
      <div><dt><span class="dot finished"></span>Unread</dt><dd>${records.filter((record) => record.isUnread).length}</dd></div>
      <div><dt><span class="dot waiting"></span>Waiting</dt><dd>${count(records, "waiting")}</dd></div>
      <div><dt><span class="dot error"></span>Errors</dt><dd>${count(records, "error")}</dd></div>
    </dl>
    <button class="primary popup-primary" id="open-dashboard">Open Dashboard <span>→</span></button>
    <div class="popup-actions"><button id="rescan">↻ Rescan Tabs</button><button id="settings">⚙ Settings</button></div>
    <p class="popup-footer">Local only · No external APIs</p>
  </main>`;
}

root.addEventListener("click", (event) => {
  const id = (event.target as HTMLElement).closest("button")?.id;
  if (id === "open-dashboard") void send({ type: "OPEN_DASHBOARD" }).then(() => window.close());
  if (id === "rescan") void send({ type: "RESCAN_TABS" }).then(() => render());
  if (id === "settings") void chrome.runtime.openOptionsPage();
});

void render();
