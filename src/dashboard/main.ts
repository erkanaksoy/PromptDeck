import "../styles/app.css";
import { send } from "../shared/api";
import { PLATFORM_NAMES } from "../shared/constants";
import { applyTheme } from "../shared/theme";
import { relativeTime } from "../shared/text";
import type {
  ConversationRecord,
  DashboardState,
  DisplayStatus,
  Filters,
  Platform,
  SortMode
} from "../shared/types";
import {
  displayStatus,
  EMPTY_FILTERS,
  filterConversations,
  sortConversations
} from "./state";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("Dashboard root missing");
const root: HTMLDivElement = rootElement;

let state: DashboardState | null = null;
let filters: Filters = structuredClone(EMPTY_FILTERS);
let announce = "";

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

function option(value: string, label: string, selected = false): string {
  return `<option value="${escapeText(value)}"${selected ? " selected" : ""}>${escapeText(label)}</option>`;
}

function windowName(windowId: number): string {
  return `Window ${state?.windowLabels[String(windowId)] ?? "?"}`;
}

function statusBadge(record: ConversationRecord): string {
  const status = displayStatus(record);
  const meta = STATUS_META[status];
  const manual = Boolean(record.manualStatusOverride);
  return `<span class="status-badge status-${status}" aria-label="${escapeText(meta.name)}">
    <span aria-hidden="true">${meta.icon}</span> ${escapeText(meta.name)}
    ${manual ? '<span class="manual-indicator" title="Manually set">Manual</span>' : ""}
  </span>`;
}

function card(record: ConversationRecord): string {
  const status = displayStatus(record);
  const unread = record.isUnread ? '<span class="attention-dot">Unread</span>' : "";
  const duplicate = record.openTabIds.length > 1 ? ` · ${record.openTabIds.length} tabs` : "";

  return `<article class="conversation-card card-${status}" data-key="${escapeText(record.key)}">
    <div class="card-stripe" aria-hidden="true"></div>
    <header class="card-header">
      <button class="card-focus" data-action="open" data-key="${escapeText(record.key)}" aria-label="${record.openTabIds.length ? "Focus" : "Reopen"} ${escapeText(record.title)}">
        <span class="platform-mark platform-${record.platform}" aria-hidden="true">${record.platform === "chatgpt" ? "C" : record.platform === "claude" ? "A" : "G"}</span>
        <span class="card-heading">
          <span class="eyebrow">${escapeText(PLATFORM_NAMES[record.platform])}${duplicate}</span>
          <span class="card-title">${escapeText(record.title)}</span>
        </span>
      </button>
      <details class="card-menu">
        <summary aria-label="Conversation actions">•••</summary>
        <div class="menu-panel">
          <button data-action="open" data-key="${escapeText(record.key)}">Open conversation</button>
          <button data-action="${record.isUnread ? "read" : "unread"}" data-key="${escapeText(record.key)}">${record.isUnread ? "Mark as read" : "Mark as unread"}</button>
          <button data-action="waiting" data-key="${escapeText(record.key)}">Mark as Waiting for Me</button>
          <button data-action="idle" data-key="${escapeText(record.key)}">Mark as Idle</button>
          ${record.manualStatusOverride ? `<button data-action="clear-override" data-key="${escapeText(record.key)}">Clear status override</button>` : ""}
          <button data-action="copy" data-url="${escapeText(record.canonicalUrl)}">Copy conversation URL</button>
          ${!record.openTabIds.length ? `<button class="danger-text" data-action="remove-recent" data-key="${escapeText(record.key)}">Remove from Recent</button>` : ""}
        </div>
      </details>
    </header>
    <div class="status-row">${statusBadge(record)} ${unread}</div>
    <p class="card-activity" title="${new Date(record.lastActivityAt).toLocaleString()}"><span>Activity</span> ${relativeTime(record.lastActivityAt)}</p>
    ${!record.detectionAvailable ? `<p class="detection-note">Detection unavailable. The page may be loading or its structure may have changed.</p>` : ""}
  </article>`;
}

function statusCount(status: DisplayStatus): number {
  return state?.conversations.filter((record) => displayStatus(record) === status).length ?? 0;
}

function filterChip(
  kind: "platform" | "status",
  value: Platform | DisplayStatus,
  label: string,
  active: boolean
): string {
  return `<button class="filter-chip${active ? " active" : ""}" data-filter-kind="${kind}" data-filter-value="${value}" aria-pressed="${active}">${escapeText(label)}</button>`;
}

function renderToolbar(records: ConversationRecord[]): string {
  const allWindows = [...new Set(state?.conversations.flatMap((record) => record.windowIds) ?? [])];
  return `<section class="control-panel" aria-label="Filters and sorting">
    <div class="search-sort-row">
      <label class="search-field"><span class="sr-only">Search conversations</span>
        <input id="search" type="search" placeholder="Search title or platform…" value="${escapeText(filters.query)}" />
      </label>
      <label>Sort
        <select id="sort">
          ${[
            ["priority", "Attention priority"],
            ["status", "Automatic status"],
            ["unread", "Unread first"],
            ["recent", "Most recent"],
            ["oldest", "Oldest activity"],
            ["title-asc", "Title A–Z"],
            ["title-desc", "Title Z–A"],
            ["platform", "Platform"],
            ["window", "Browser window"],
            ["recently-closed", "Recently closed"]
          ]
            .map(([value, label]) => option(value!, label!, state?.settings.sortMode === value))
            .join("")}
        </select>
      </label>
      <label>Window
        <select id="window-filter">
          ${option("", "All windows", filters.windows.length === 0)}
          ${allWindows.map((id) => option(String(id), windowName(id), filters.windows.includes(id))).join("")}
        </select>
      </label>
    </div>
    <div class="filter-row">
      <div class="chip-group" aria-label="Platform filters">
        ${(["chatgpt", "claude", "gemini"] as Platform[])
          .map((platform) =>
            filterChip("platform", platform, PLATFORM_NAMES[platform], filters.platforms.includes(platform))
          )
          .join("")}
      </div>
      <div class="chip-group" aria-label="Status filters">
        ${(["generating", "finished_unread", "waiting", "error", "idle", "recent"] as DisplayStatus[])
          .map((status) =>
            filterChip("status", status, STATUS_META[status].name, filters.statuses.includes(status))
          )
          .join("")}
      </div>
      <label class="check-pill"><input id="unread-only" type="checkbox" ${filters.unreadOnly ? "checked" : ""}/> Unread only</label>
      <label class="check-pill"><input id="active-only" type="checkbox" ${filters.activeOnly ? "checked" : ""}/> Active only</label>
      <label class="check-pill"><input id="recent-only" type="checkbox" ${filters.recentOnly ? "checked" : ""}/> Recent only</label>
      <button class="text-button" id="clear-filters">Reset filters</button>
      <span class="result-count" aria-live="polite">${records.length} result${records.length === 1 ? "" : "s"}</span>
    </div>
  </section>`;
}

function renderGrid(records: ConversationRecord[]): string {
  return `<section class="card-grid" aria-label="Conversation grid">${records.map(card).join("")}</section>`;
}

function renderKanban(records: ConversationRecord[]): string {
  const columns: DisplayStatus[] = [
    "generating",
    "finished_unread",
    "waiting",
    "error",
    "idle",
    "recent"
  ];
  return `<section class="kanban" aria-label="Conversation Kanban board">
    ${columns
      .map((status) => {
        const items = records.filter((record) => displayStatus(record) === status);
        return `<section class="kanban-column column-${status}">
          <header><span>${STATUS_META[status].icon} ${escapeText(STATUS_META[status].name)}</span><strong>${items.length}</strong></header>
          <div class="kanban-stack">${items.length ? items.map(card).join("") : '<p class="column-empty">Nothing here</p>'}</div>
        </section>`;
      })
      .join("")}
  </section>`;
}

function render(): void {
  if (!state) {
    root.innerHTML = '<main class="loading-state"><span class="logo-mark">P</span><p>Loading PromptDeck…</p></main>';
    return;
  }
  applyTheme(state.settings.theme);
  const filtered = filterConversations(
    state.conversations,
    filters
  );
  const records = sortConversations(filtered, state.settings.sortMode);
  const noSupported = state.conversations.length === 0;
  const firstRun = !state.settings.firstRunComplete;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const activeConversationCount = state.conversations.filter(
    (record) => record.openTabIds.length
  ).length;
  const openTabCount = state.conversations.reduce(
    (count, record) => count + record.openTabIds.length,
    0
  );

  root.innerHTML = `<div class="app-shell">
    <header class="topbar">
      <a class="brand" href="dashboard.html" aria-label="PromptDeck dashboard">
        <img src="/icons/icon-48.png" alt="" width="38" height="38" />
        <span><strong>PromptDeck</strong><small>AI attention, organized.</small></span>
      </a>
      <nav class="top-actions" aria-label="Dashboard actions">
        <button id="rescan" class="secondary">↻ Rescan tabs</button>
        <a class="secondary button-link" href="options.html">Settings</a>
        <div class="view-toggle" role="group" aria-label="View mode">
          <button data-view="grid" aria-pressed="${state.settings.viewMode === "grid"}">▦ Grid</button>
          <button data-view="kanban" aria-pressed="${state.settings.viewMode === "kanban"}">▤ Kanban</button>
        </div>
      </nav>
    </header>

    <main>
      ${state.storageError ? `<div class="banner error-banner" role="alert">${escapeText(state.storageError)}</div>` : ""}
      ${firstRun ? `<section class="welcome-panel">
        <div><span class="eyebrow">Welcome to PromptDeck</span><h1>All your AI conversations, one calm view.</h1>
        <p>PromptDeck only watches open ChatGPT, Claude, and Gemini tabs. Everything stays on this device.</p></div>
        <div class="welcome-actions"><button class="primary" id="welcome-scan">Scan open tabs</button><a href="options.html">Review privacy settings</a><button class="text-button" id="hide-welcome">Hide</button></div>
      </section>` : ""}
      <section class="summary" aria-label="Conversation summary">
        <div class="summary-intro"><span class="eyebrow">Attention overview</span><h1>${activeConversationCount} active conversation${activeConversationCount === 1 ? "" : "s"}</h1><p>${openTabCount} open AI tab${openTabCount === 1 ? "" : "s"} across ChatGPT, Claude, and Gemini</p></div>
        ${(["error", "waiting", "finished_unread", "generating", "idle", "recent"] as DisplayStatus[])
          .map((status) => `<button class="summary-stat stat-${status}" data-filter-summary="${status}">
            <span class="stat-icon" aria-hidden="true">${STATUS_META[status].icon}</span>
            <span><strong>${statusCount(status)}</strong><small>${escapeText(STATUS_META[status].name)}</small></span>
          </button>`)
          .join("")}
      </section>
      ${renderToolbar(records)}
      ${noSupported ? `<section class="empty-state"><span class="empty-illustration" aria-hidden="true">▦</span><h2>No supported AI chats are open</h2><p>Open ChatGPT, Claude, or Gemini and PromptDeck will detect them automatically.</p><button class="primary" id="empty-scan">Scan open tabs</button></section>` : records.length === 0 ? `<section class="empty-state"><h2>No conversations match these filters</h2><p>Try clearing one or more filters.</p>${filtersActive ? '<button class="secondary" id="empty-clear">Reset filters</button>' : ""}</section>` : state.settings.viewMode === "grid" ? renderGrid(records) : renderKanban(records)}
    </main>
    <footer><span>Local only · No analytics · No external APIs</span><a href="diagnostics.html">Diagnostics</a></footer>
    <div class="sr-only" aria-live="polite">${escapeText(announce)}</div>
  </div>`;
}

async function load(): Promise<void> {
  const response = await send({ type: "GET_DASHBOARD_STATE" });
  if (!response.ok || !response.state) {
    root.innerHTML = `<main class="empty-state"><h1>PromptDeck could not load</h1><p>${escapeText(response.ok ? "No state was returned." : response.error)}</p><button onclick="location.reload()">Try again</button></main>`;
    return;
  }
  state = response.state;
  render();
}

async function action(request: Parameters<typeof send>[0], message: string): Promise<void> {
  const response = await send(request);
  announce = response.ok ? message : response.error;
  await load();
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionName = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  const actionable = target.closest<HTMLElement>("[data-action]");
  const key = actionable?.dataset.key;
  if (actionName && (key || actionName === "copy")) {
    if (actionName === "open" && key) void action({ type: "FOCUS_CONVERSATION", conversationKey: key }, "Conversation opened");
    if (actionName === "read" && key) void action({ type: "MARK_READ", conversationKey: key }, "Marked as read");
    if (actionName === "unread" && key) void action({ type: "MARK_UNREAD", conversationKey: key }, "Marked as unread");
    if (actionName === "waiting" && key) void action({ type: "SET_MANUAL_OVERRIDE", conversationKey: key, value: "waiting" }, "Waiting status set");
    if (actionName === "idle" && key) void action({ type: "SET_MANUAL_OVERRIDE", conversationKey: key, value: "idle" }, "Idle status set");
    if (actionName === "clear-override" && key) void action({ type: "CLEAR_MANUAL_OVERRIDE", conversationKey: key }, "Automatic status restored");
    if (actionName === "remove-recent" && key) void action({ type: "REMOVE_RECENT", conversationKey: key }, "Removed from Recent");
    if (actionName === "copy" && actionable?.dataset.url) {
      void navigator.clipboard.writeText(actionable.dataset.url).then(() => {
        announce = "Conversation URL copied";
        render();
      });
    }
    return;
  }

  const view = target.closest<HTMLElement>("[data-view]")?.dataset.view;
  if (view === "grid" || view === "kanban") {
    void action({ type: "UPDATE_SETTINGS", patch: { viewMode: view } }, `${view} view selected`);
    return;
  }
  const filterButton = target.closest<HTMLElement>("[data-filter-kind]");
  if (filterButton?.dataset.filterKind === "platform") {
    const value = filterButton.dataset.filterValue as Platform;
    filters.platforms = filters.platforms.includes(value)
      ? filters.platforms.filter((item) => item !== value)
      : [...filters.platforms, value];
    render();
    return;
  }
  if (filterButton?.dataset.filterKind === "status") {
    const value = filterButton.dataset.filterValue as DisplayStatus;
    filters.statuses = filters.statuses.includes(value)
      ? filters.statuses.filter((item) => item !== value)
      : [...filters.statuses, value];
    render();
    return;
  }
  const summary = target.closest<HTMLElement>("[data-filter-summary]")?.dataset
    .filterSummary as DisplayStatus | undefined;
  if (summary) {
    filters.statuses = [summary];
    render();
    return;
  }
  if (target.closest("#clear-filters, #empty-clear")) {
    filters = structuredClone(EMPTY_FILTERS);
    render();
    return;
  }
  if (target.closest("#hide-welcome")) {
    void action(
      { type: "UPDATE_SETTINGS", patch: { firstRunComplete: true } },
      "Welcome banner hidden"
    );
    return;
  }
  if (target.closest("#rescan, #empty-scan, #welcome-scan")) {
    void (async () => {
      await send({ type: "RESCAN_TABS" });
      await send({ type: "UPDATE_SETTINGS", patch: { firstRunComplete: true } });
      announce = "Open tabs rescanned";
      window.setTimeout(() => void load(), 600);
    })();
  }
});

root.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "search") {
    filters.query = target.value;
    render();
  }
});

root.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === "sort") {
    void action(
      { type: "UPDATE_SETTINGS", patch: { sortMode: target.value as SortMode } },
      "Sort updated"
    );
  } else if (target.id === "window-filter") {
    filters.windows = target.value ? [Number(target.value)] : [];
    render();
  } else if (target.id === "unread-only") {
    filters.unreadOnly = (target as HTMLInputElement).checked;
    render();
  } else if (target.id === "active-only") {
    filters.activeOnly = (target as HTMLInputElement).checked;
    if (filters.activeOnly) filters.recentOnly = false;
    render();
  } else if (target.id === "recent-only") {
    filters.recentOnly = (target as HTMLInputElement).checked;
    if (filters.recentOnly) filters.activeOnly = false;
    render();
  }
});

chrome.storage.onChanged.addListener(() => void load());
void load();
