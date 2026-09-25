import "../styles/app.css";
import { send } from "../shared/api";
import { PLATFORM_NAMES } from "../shared/constants";
import { providerFaviconUrl } from "../shared/favicon";
import { applyTheme } from "../shared/theme";
import type { DisplayStatus, Platform } from "../shared/types";
import {
  buildSidePanelItems,
  groupSidePanelItems,
  type SidePanelGroupMode,
  type SidePanelItem,
  type SidePanelQuickFilter
} from "./state";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Side panel root missing");
const root: HTMLDivElement = rootElement;
let placementOpen = false;
let groupMode: SidePanelGroupMode = "none";
let selectedConversationKey: string | null = null;
let renderSequence = 0;
const quickFilters = new Set<SidePanelQuickFilter>();
const GROUP_MODE_KEY = "promptdeck-side-panel-group-mode";

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

function entry(item: SidePanelItem, isKeyboardTarget: boolean): string {
  const { record, status, targetTabId, duplicateCount, isCurrent } = item;
  const meta = STATUS_META[status];
  const duplicateLabel = duplicateCount > 1 ? `, ${duplicateCount} duplicate tabs` : "";
  const currentLabel = isCurrent ? ", currently focused" : "";
  return `<button class="tab-sidebar-entry sidepanel-entry sidebar-platform-${record.platform} sidebar-status-${status}${isCurrent ? " is-current" : ""}"
    data-sidebar-row data-conversation-key="${escapeText(record.key)}" data-tab-id="${targetTabId}"
    tabindex="${isKeyboardTarget ? "0" : "-1"}" ${isCurrent ? 'aria-current="true"' : ""}
    title="${escapeText(record.title)} — ${escapeText(meta.name)}${duplicateCount > 1 ? ` — ${duplicateCount} tabs` : ""}"
    aria-label="Focus ${escapeText(PLATFORM_NAMES[record.platform])} chat ${escapeText(record.title)}. Status: ${escapeText(meta.name)}${duplicateLabel}${currentLabel}">
    <img class="tab-sidebar-provider" src="${providerFaviconUrl(record.platform)}" alt="" width="22" height="22" />
    <span class="tab-sidebar-status" aria-hidden="true">${meta.icon}</span>
    <span class="tab-sidebar-name">${escapeText(record.title)}</span>
    ${duplicateCount > 1 ? `<span class="sidepanel-duplicate-count" title="${duplicateCount} open copies" aria-hidden="true">${duplicateCount}</span>` : ""}
  </button>`;
}

function groupLabel(platform: Platform | undefined, status: DisplayStatus | undefined): string {
  if (platform) return PLATFORM_NAMES[platform];
  if (status) return STATUS_META[status].name;
  return "";
}

function renderGroups(items: SidePanelItem[]): string {
  const groups = groupSidePanelItems(items, groupMode);
  return groups.map((group) => {
    const heading = groupMode === "none"
      ? ""
      : `<h2 class="sidepanel-group-heading"><span>${escapeText(groupLabel(group.platform, group.status))}</span><strong>${group.items.length}</strong></h2>`;
    return `<section class="sidepanel-group-section">${heading}<div class="sidepanel-group-items">${group.items
      .map((item) => entry(item, item.record.key === selectedConversationKey))
      .join("")}</div></section>`;
  }).join("");
}

function filterButton(status: SidePanelQuickFilter, label: string, count: number): string {
  const active = quickFilters.has(status);
  return `<button class="sidepanel-filter sidebar-status-${status}${active ? " active" : ""}"
    data-sidepanel-filter="${status}" aria-pressed="${active}">${label}<strong>${count}</strong></button>`;
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function currentPanelSide(): Promise<"left" | "right" | null> {
  try {
    if (typeof chrome.sidePanel.getLayout !== "function") return null;
    return (await chrome.sidePanel.getLayout()).side;
  } catch {
    return null;
  }
}

async function currentShortcut(): Promise<string> {
  const commands = await chrome.commands.getAll();
  return commands.find((command) => command.name === "toggle-side-panel")?.shortcut || "Not assigned";
}

async function render(): Promise<void> {
  const sequence = ++renderSequence;
  const restoreListFocus = Boolean(
    (document.activeElement as HTMLElement | null)?.closest?.("[data-sidebar-row]")
  );
  const [response, panelSide, shortcutLabel, currentTabId] = await Promise.all([
    send({ type: "GET_DASHBOARD_STATE" }),
    currentPanelSide(),
    currentShortcut(),
    activeTabId()
  ]);
  if (sequence !== renderSequence) return;
  if (!response.ok || !response.state) {
    root.innerHTML = '<main class="sidepanel-shell"><p class="sidepanel-empty">PromptDeck is unavailable.</p></main>';
    return;
  }

  applyTheme(response.state.settings.theme);
  const allItems = buildSidePanelItems(response.state.conversations, currentTabId, new Set());
  const visibleItems = buildSidePanelItems(response.state.conversations, currentTabId, quickFilters);
  if (!visibleItems.some((item) => item.record.key === selectedConversationKey)) {
    selectedConversationKey = visibleItems.find((item) => item.isCurrent)?.record.key ?? visibleItems[0]?.record.key ?? null;
  }
  const statusCount = (status: SidePanelQuickFilter): number =>
    allItems.filter((item) => item.status === status).length;

  root.innerHTML = `<main class="sidepanel-shell">
    <header class="sidepanel-header">
      <div class="sidepanel-brand">
        <img src="/icons/icon-48.png" alt="" width="32" height="32" />
        <span><strong>PromptDeck</strong><small>${allItems.length} conversation${allItems.length === 1 ? "" : "s"} · ${allItems.reduce((sum, item) => sum + item.duplicateCount, 0)} tabs</small></span>
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
    <section class="sidepanel-tools" aria-label="Conversation list controls">
      <div class="sidepanel-filters" aria-label="Status filters">
        <button class="sidepanel-filter${quickFilters.size === 0 ? " active" : ""}" data-sidepanel-filter="all" aria-pressed="${quickFilters.size === 0}">All<strong>${allItems.length}</strong></button>
        ${filterButton("error", "Error", statusCount("error"))}
        ${filterButton("waiting", "Waiting", statusCount("waiting"))}
        ${filterButton("generating", "Generating", statusCount("generating"))}
      </div>
      <label class="sidepanel-group-control"><span>Group</span><select id="sidepanel-group-mode">
        <option value="none" ${groupMode === "none" ? "selected" : ""}>None</option>
        <option value="provider" ${groupMode === "provider" ? "selected" : ""}>Provider</option>
        <option value="status" ${groupMode === "status" ? "selected" : ""}>Status</option>
      </select></label>
    </section>
    <nav class="sidepanel-list" aria-label="Open AI tabs">
      ${visibleItems.length
        ? renderGroups(visibleItems)
        : allItems.length
          ? '<div class="sidepanel-empty"><strong>No conversations match</strong><span>Choose All or change the status filters.</span></div>'
          : '<div class="sidepanel-empty"><strong>No open AI chats</strong><span>Open ChatGPT, Claude, or Gemini, then rescan.</span></div>'}
    </nav>
    <button class="sidepanel-shortcut" id="sidepanel-shortcuts" title="Customize keyboard shortcut">
      <span>Toggle panel</span><kbd>${shortcutLabel}</kbd>
    </button>
    <p class="sidepanel-status" aria-live="polite"></p>
  </main>`;
  if (restoreListFocus) {
    root.querySelector<HTMLButtonElement>('[data-sidebar-row][tabindex="0"]')
      ?.focus({ preventScroll: true });
  }
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;
  const tabId = Number(button.dataset.tabId);
  if (Number.isInteger(tabId)) {
    selectedConversationKey = button.dataset.conversationKey ?? null;
    void send({ type: "FOCUS_TAB", tabId }).then((response) => {
      if (!response.ok) {
        const status = root.querySelector<HTMLElement>(".sidepanel-status");
        if (status) status.textContent = response.error;
      }
    });
    return;
  }
  const filter = button.dataset.sidepanelFilter as SidePanelQuickFilter | "all" | undefined;
  if (filter) {
    if (filter === "all") quickFilters.clear();
    else if (quickFilters.has(filter)) quickFilters.delete(filter);
    else quickFilters.add(filter);
    void render();
  } else if (button.id === "sidepanel-rescan") {
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
  } else if (button.id === "sidepanel-shortcuts") {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch(() => {
      const status = root.querySelector<HTMLElement>(".sidepanel-status");
      if (status) status.textContent = "Open chrome://extensions/shortcuts to customize it.";
    });
  } else if (button.id === "sidepanel-settings") {
    void chrome.runtime.openOptionsPage();
  }
});

root.addEventListener("change", (event) => {
  const select = event.target as HTMLSelectElement;
  if (select.id !== "sidepanel-group-mode") return;
  const value = select.value;
  if (value !== "none" && value !== "provider" && value !== "status") return;
  groupMode = value;
  void chrome.storage.local.set({ [GROUP_MODE_KEY]: value });
  void render();
});

document.addEventListener("keydown", (event) => {
  const rows = [...root.querySelectorAll<HTMLButtonElement>("[data-sidebar-row]")];
  if (!rows.length) return;
  const focusedRow = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sidebar-row]");
  if (event.key === "Enter" && focusedRow) {
    event.preventDefault();
    focusedRow.click();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  if (!focusedRow && (event.target as HTMLElement).closest("button, select")) return;
  event.preventDefault();
  const currentIndex = focusedRow ? rows.indexOf(focusedRow) : rows.findIndex((row) => row.tabIndex === 0);
  const offset = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + offset + rows.length) % rows.length;
  const nextRow = rows[nextIndex]!;
  for (const row of rows) row.tabIndex = -1;
  nextRow.tabIndex = 0;
  selectedConversationKey = nextRow.dataset.conversationKey ?? null;
  nextRow.focus();
});

chrome.storage.onChanged.addListener((changes) => {
  const storedMode = changes[GROUP_MODE_KEY]?.newValue;
  if (storedMode === "none" || storedMode === "provider" || storedMode === "status") groupMode = storedMode;
  void render();
});
chrome.tabs.onActivated.addListener(() => void render());
chrome.windows.onFocusChanged.addListener(() => void render());

void chrome.storage.local.get(GROUP_MODE_KEY).then((stored) => {
  const value = stored[GROUP_MODE_KEY];
  if (value === "provider" || value === "status") groupMode = value;
  void render();
});
