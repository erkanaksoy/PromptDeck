import "../styles/app.css";
import { send } from "../shared/api";
import { applyTheme } from "../shared/theme";
import type { ConversationRecord, DisplayStatus } from "../shared/types";
import { displayStatus, sortConversations } from "../dashboard/state";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Side panel root missing");
const root: HTMLDivElement = rootElement;
let placementOpen = false;

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

async function currentPanelSide(): Promise<"left" | "right" | null> {
  try {
    if (typeof chrome.sidePanel.getLayout !== "function") return null;
    return (await chrome.sidePanel.getLayout()).side;
  } catch {
    return null;
  }
}

async function render(): Promise<void> {
  const [response, panelSide] = await Promise.all([
    send({ type: "GET_DASHBOARD_STATE" }),
    currentPanelSide()
  ]);
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
        <button id="sidepanel-placement" title="Side panel position" aria-label="Side panel position" aria-expanded="${placementOpen}">⇆</button>
        <button id="sidepanel-settings" title="Open settings" aria-label="Open settings">⚙</button>
      </div>
    </header>
    ${placementOpen ? `<section class="sidepanel-placement">
      <div><strong>Side panel position</strong><span>${panelSide ? `Currently ${panelSide}` : "Managed by Chrome"}</span></div>
      <p>Chrome applies this position to every side panel.</p>
      <button id="sidepanel-placement-settings">Choose left or right in Chrome settings</button>
    </section>` : ""}
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
  } else if (button.id === "sidepanel-placement") {
    placementOpen = !placementOpen;
    void render();
  } else if (button.id === "sidepanel-placement-settings") {
    void chrome.tabs.create({ url: "chrome://settings/appearance" }).catch(() => {
      const status = root.querySelector<HTMLElement>(".sidepanel-status");
      if (status) status.textContent = "Open Chrome Settings → Appearance → Side panel.";
    });
  } else if (button.id === "sidepanel-settings") {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.storage.onChanged.addListener(() => void render());
void render();
