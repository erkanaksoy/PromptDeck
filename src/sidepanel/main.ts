import "../styles/app.css";
import { send } from "../shared/api";
import { applyTheme } from "../shared/theme";
import type { ConversationRecord, DisplayStatus } from "../shared/types";
import { displayStatus, sortConversations } from "../dashboard/state";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Side panel root missing");
const root: HTMLDivElement = rootElement;

const STATUS_META: Record<DisplayStatus, { name: string; icon: string }> = {
  generating: { name: "Generating", icon: "↻" },
  finished_unread: { name: "Finished / Unread", icon: "●" },
  waiting: { name: "Waiting for Input", icon: "?" },
  error: { name: "Error", icon: "!" },
  idle: { name: "Idle", icon: "✓" },
  unknown: { name: "Detection unavailable", icon: "–" },
  recent: { name: "Recent", icon: "◷" }
};

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function entry(record: ConversationRecord, tabId: number): string {
  const status = displayStatus(record);
  const meta = STATUS_META[status];
  return `<button class="tab-sidebar-entry sidepanel-entry sidebar-platform-${record.platform} sidebar-status-${status}"
    data-tab-id="${tabId}" title="${escapeText(record.title)} — ${escapeText(meta.name)}"
    aria-label="Focus ${escapeText(record.title)}. Status: ${escapeText(meta.name)}">
    <span class="tab-sidebar-status" aria-hidden="true">${meta.icon}</span>
    <span class="tab-sidebar-name">${escapeText(record.title)}</span>
  </button>`;
}

async function render(): Promise<void> {
  const response = await send({ type: "GET_DASHBOARD_STATE" });
  if (!response.ok || !response.state) {
    root.innerHTML = '<main class="sidepanel-shell"><p class="sidepanel-empty">PromptDeck is unavailable.</p></main>';
    return;
  }

  applyTheme(response.state.settings.theme);
  const openTabs = sortConversations(
    response.state.conversations.filter((record) => record.openTabIds.length > 0),
    "priority"
  ).flatMap((record) => record.openTabIds.map((tabId) => ({ record, tabId })));

  root.innerHTML = `<main class="sidepanel-shell">
    <header class="sidepanel-header">
      <div class="sidepanel-brand">
        <img src="/icons/icon-48.png" alt="" width="32" height="32" />
        <span><strong>PromptDeck</strong><small>${openTabs.length} open tab${openTabs.length === 1 ? "" : "s"}</small></span>
      </div>
      <div class="sidepanel-actions">
        <button id="sidepanel-rescan" title="Rescan tabs" aria-label="Rescan tabs">↻</button>
        <button id="sidepanel-dashboard" title="Open dashboard" aria-label="Open dashboard">▦</button>
        <button id="sidepanel-settings" title="Open settings" aria-label="Open settings">⚙</button>
      </div>
    </header>
    <nav class="sidepanel-list" aria-label="Open AI tabs">
      ${openTabs.length
        ? openTabs.map(({ record, tabId }) => entry(record, tabId)).join("")
        : '<div class="sidepanel-empty"><strong>No open AI chats</strong><span>Open ChatGPT, Claude, or Gemini, then rescan.</span></div>'}
    </nav>
    <p class="sidepanel-status" aria-live="polite"></p>
  </main>`;
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;
  const tabId = Number(button.dataset.tabId);
  if (Number.isInteger(tabId)) {
    void send({ type: "FOCUS_TAB", tabId }).then((response) => {
      if (!response.ok) {
        const status = root.querySelector<HTMLElement>(".sidepanel-status");
        if (status) status.textContent = response.error;
      }
    });
    return;
  }
  if (button.id === "sidepanel-rescan") {
    void send({ type: "RESCAN_TABS" }).then(() => window.setTimeout(() => void render(), 600));
  } else if (button.id === "sidepanel-dashboard") {
    void send({ type: "OPEN_DASHBOARD" });
  } else if (button.id === "sidepanel-settings") {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.storage.onChanged.addListener(() => void render());
void render();
