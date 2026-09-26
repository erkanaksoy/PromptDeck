import {
  RECENT_CLEANUP_ALARM,
  SCHEMA_VERSION
} from "../shared/constants";
import { lightweightHash } from "../shared/fingerprint";
import { PLATFORM_NAMES } from "../shared/constants";
import {
  conversationKeyForTab,
  getConversationId,
  isPromptDeckSidePanelUrl,
  isSafeConversationUrl,
  normalizeConversationUrl,
  platformForUrl
} from "../shared/urls";
import type {
  ConversationRecord,
  DashboardState,
  Settings,
  StoredState
} from "../shared/types";
import type { ExtensionRequest, ExtensionResponse } from "../messaging/messages";
import { isExtensionRequest } from "../messaging/validators";
import {
  clearAllData,
  clearRecent,
  loadState,
  saveState,
  updateSettings
} from "../storage/repository";
import {
  cleanupRecent,
  detachTab,
  findConversationByTab,
  reconcileOpenTabs,
  type OpenConversationTab
} from "./tab-registry";
import {
  effectiveStatus,
  markRead,
  reduceObservation,
  setManualOverride
} from "./transitions";
import {
  notificationEventKey,
  recordNotification,
  shouldNotify
} from "./notification-manager";
import { toggleSidePanelForTab } from "./side-panel-shortcut";

let stateQueue: Promise<unknown> = Promise.resolve();
let sidePanelStateQueue: Promise<void> = Promise.resolve();
const OPEN_SIDE_PANEL_WINDOWS_KEY = "promptdeck-open-side-panel-windows";
const openSidePanelWindowIds = new Set<number>();
let sidePanelStateRevision = 0;
const queue = <T>(work: () => Promise<T>): Promise<T> => {
  const next = stateQueue.then(work, work);
  stateQueue = next.catch(() => undefined);
  return next;
};

async function configureActionForTab(tabId: number, url: string | undefined): Promise<void> {
  if (isPromptDeckSidePanelUrl(url)) await chrome.action.enable(tabId);
  else await chrome.action.disable(tabId);
}

async function hideSidePanelForUnsupportedTab(tab: chrome.tabs.Tab): Promise<void> {
  if (isPromptDeckSidePanelUrl(tab.url ?? tab.pendingUrl)) return;
  setSidePanelWindowOpen(tab.windowId, false);
  await chrome.sidePanel.close({ windowId: tab.windowId }).catch(() => undefined);
}

async function configureSidePanel(): Promise<void> {
  await chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map((tab) => tab.id === undefined
    ? Promise.resolve()
    : configureActionForTab(tab.id, tab.url ?? tab.pendingUrl)));
}

function setSidePanelWindowOpen(windowId: number, open: boolean): void {
  sidePanelStateRevision += 1;
  if (open) openSidePanelWindowIds.add(windowId);
  else openSidePanelWindowIds.delete(windowId);
  const snapshot = [...openSidePanelWindowIds];
  const update = (): Promise<void> => chrome.storage.session.set({ [OPEN_SIDE_PANEL_WINDOWS_KEY]: snapshot });
  const next = sidePanelStateQueue.then(update, update);
  sidePanelStateQueue = next.catch(() => undefined);
}

void chrome.storage.session.get(OPEN_SIDE_PANEL_WINDOWS_KEY).then((stored) => {
  if (sidePanelStateRevision !== 0) return;
  const value = stored[OPEN_SIDE_PANEL_WINDOWS_KEY];
  if (!Array.isArray(value)) return;
  for (const windowId of value) {
    if (Number.isInteger(windowId)) openSidePanelWindowIds.add(windowId);
  }
}).catch(() => undefined);

function dashboardState(state: StoredState): DashboardState {
  return {
    conversations: Object.values(state.conversations),
    settings: state.settings,
    windowLabels: state.windowLabels,
    ...(state.migrationError ? { storageError: state.migrationError } : {})
  };
}

async function ensureWindowLabel(state: StoredState, windowId: number): Promise<number> {
  const key = String(windowId);
  const existing = state.windowLabels[key];
  if (existing) return existing;
  const label = state.nextWindowLabel;
  state.windowLabels[key] = label;
  state.nextWindowLabel += 1;
  return label;
}

async function openDashboard(): Promise<void> {
  const url = chrome.runtime.getURL("dashboard.html");
  const tabs = await chrome.tabs.query({ url: `${url}*` });
  const existing = tabs.find((tab) => typeof tab.id === "number");
  if (existing?.id !== undefined) {
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }
  await chrome.tabs.create({ url });
}

async function focusTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function focusConversation(record: ConversationRecord): Promise<void> {
  if (record.primaryTabId !== undefined) {
    try {
      await focusTab(record.primaryTabId);
      return;
    } catch {
      // Fall through to a safe reopen.
    }
  }
  if (isSafeConversationUrl(record.canonicalUrl)) {
    await chrome.tabs.create({ url: record.canonicalUrl });
  }
}

async function sendNotification(
  record: ConversationRecord,
  event: "finished" | "waiting" | "error",
  eventKey: string
): Promise<void> {
  const label =
    event === "finished"
      ? "Response finished"
      : event === "waiting"
        ? "Waiting for your input"
        : "Conversation error";
  const id = `pd:${event}:${lightweightHash(record.key)}:${lightweightHash(eventKey)}`;
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: "PromptDeck",
    message: `${PLATFORM_NAMES[record.platform]} · ${record.title}\n${label}`,
    priority: event === "error" ? 2 : 1
  });
}

async function processObservation(
  request: Extract<ExtensionRequest, { type: "TAB_OBSERVATION" }>,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId === undefined || windowId === undefined || sender.tab?.incognito) return;

  await queue(async () => {
    const state = await loadState();
    await ensureWindowLabel(state, windowId);
    const key = conversationKeyForTab(
      request.payload.platform,
      request.payload.canonicalUrl,
      request.payload.conversationId,
      tabId
    );
    const priorForTab = findConversationByTab(state.conversations, tabId);
    if (priorForTab && priorForTab.key !== key) {
      if (!priorForTab.conversationId) {
        delete state.conversations[priorForTab.key];
      } else {
        const windows = new Map<number, number>();
        for (const otherTab of await chrome.tabs.query({})) {
          if (otherTab.id !== undefined) windows.set(otherTab.id, otherTab.windowId);
        }
        const detached = detachTab(priorForTab, tabId, windows);
        state.conversations[priorForTab.key] = detached;
      }
    }

    const tab = await chrome.tabs.get(tabId).catch(() => sender.tab);
    const result = reduceObservation(state.conversations[key], request.payload, {
      tabId,
      windowId,
      isActive: Boolean(tab?.active),
      now: Date.now()
    });
    result.record.key = key;
    state.conversations[key] = result.record;

    for (const event of result.events) {
      const enabled =
        event === "finished"
          ? state.settings.notifyFinished
          : event === "waiting"
            ? state.settings.notifyWaiting
            : state.settings.notifyError;
      const suppressed =
        event === "finished" &&
        state.settings.suppressFinishedWhenVisible &&
        Boolean(tab?.active) &&
        request.payload.isVisible;
      const eventKey = notificationEventKey(result.record, event);
      if (
        enabled &&
        !suppressed &&
        shouldNotify(result.record, eventKey)
      ) {
        result.record = recordNotification(result.record, eventKey);
        state.conversations[key] = result.record;
        await sendNotification(result.record, event, eventKey).catch(() => undefined);
      }
    }
    await saveState(state);
  });
}

async function rescanTabs(): Promise<number> {
  const patterns = ["https://chatgpt.com/*", "https://claude.ai/*", "https://gemini.google.com/*"];
  const tabs = await chrome.tabs.query({ url: patterns });
  const openTabs: OpenConversationTab[] = [];
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url || tab.incognito) continue;
    const platform = platformForUrl(tab.url);
    const canonicalUrl = normalizeConversationUrl(tab.url);
    if (!platform || !canonicalUrl) continue;
    openTabs.push({
      conversationKey: conversationKeyForTab(
        platform,
        canonicalUrl,
        getConversationId(platform, canonicalUrl),
        tab.id
      ),
      tabId: tab.id,
      windowId: tab.windowId
    });
  }
  await queue(async () => {
    const state = reconcileOpenTabs(await loadState(), openTabs);
    await saveState(state);
  });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined || tab.incognito) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "PROMPTDECK_RESCAN" });
      } catch {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["assets/content-script.js"]
          });
        } catch {
          await registerUnavailableTab(tab);
        }
      }
    })
  );
  return tabs.length;
}

async function registerUnavailableTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined || !tab.url || tab.incognito) return;
  const tabId = tab.id;
  const platform = platformForUrl(tab.url);
  const canonicalUrl = normalizeConversationUrl(tab.url);
  if (!platform || !canonicalUrl) return;
  const conversationId = getConversationId(platform, canonicalUrl);
  const key = conversationKeyForTab(platform, canonicalUrl, conversationId, tabId);
  await queue(async () => {
    const state = await loadState();
    await ensureWindowLabel(state, tab.windowId);
    const current = state.conversations[key];
    const now = Date.now();
    state.conversations[key] = {
      ...(current ?? {
        key,
        platform,
        ...(conversationId ? { conversationId } : {}),
        canonicalUrl,
        title: tab.title?.slice(0, 160) || `Untitled ${PLATFORM_NAMES[platform]} Conversation`,
        openTabIds: [],
        windowIds: [],
        automaticStatus: "unknown",
        isUnread: false,
        lastActivityAt: now,
        lastObservedAt: now,
        lastNotifiedEvents: [],
        detectionAvailable: false,
        schemaVersion: SCHEMA_VERSION
      }),
      openTabIds: [...new Set([...(current?.openTabIds ?? []), tabId])].sort((a, b) => a - b),
      primaryTabId: Math.min(...new Set([...(current?.openTabIds ?? []), tabId])),
      windowIds: [...new Set([...(current?.windowIds ?? []), tab.windowId])].sort((a, b) => a - b),
      closedAt: undefined,
      recentExpiresAt: undefined,
      detectionAvailable: false,
      detectionMessage: "Tab is inaccessible or its content script is unavailable.",
      lastObservedAt: now
    };
    await saveState(state);
  });
}

async function patchConversation(
  key: string,
  updater: (record: ConversationRecord) => ConversationRecord | undefined
): Promise<void> {
  await queue(async () => {
    const state = await loadState();
    const record = state.conversations[key];
    if (!record) throw new Error("Conversation not found");
    const updated = updater(record);
    if (updated) {
      state.conversations[key] = updated;
    } else {
      delete state.conversations[key];
    }
    await saveState(state);
  });
}

async function handleRequest(
  request: ExtensionRequest,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  try {
    switch (request.type) {
      case "TAB_OBSERVATION":
        await processObservation(request, sender);
        return { ok: true };
      case "GET_DASHBOARD_STATE": {
        const state = cleanupRecent(await loadState());
        await saveState(state);
        return { ok: true, state: dashboardState(state) };
      }
      case "GET_VIEW_DELAY":
        return { ok: true, delayMs: (await loadState()).settings.markViewedDelayMs };
      case "OPEN_DASHBOARD":
        await openDashboard();
        return { ok: true };
      case "RESCAN_TABS":
        return { ok: true, count: await rescanTabs() };
      case "FOCUS_TAB": {
        const state = await loadState();
        const isTracked = Object.values(state.conversations).some((record) =>
          record.openTabIds.includes(request.tabId)
        );
        if (!isTracked) throw new Error("Tab is no longer open");
        await focusTab(request.tabId);
        return { ok: true };
      }
      case "FOCUS_CONVERSATION": {
        const record = (await loadState()).conversations[request.conversationKey];
        if (!record) throw new Error("Conversation not found");
        await focusConversation(record);
        return { ok: true };
      }
      case "MARK_READ":
        await patchConversation(request.conversationKey, (record) => markRead(record));
        return { ok: true };
      case "MARK_UNREAD":
        await patchConversation(request.conversationKey, (record) => ({
          ...record,
          isUnread: true,
          automaticStatus:
            effectiveStatus(record) === "idle" ? "finished_unread" : record.automaticStatus
        }));
        return { ok: true };
      case "SET_MANUAL_OVERRIDE":
        await patchConversation(request.conversationKey, (record) =>
          setManualOverride(record, request.value)
        );
        return { ok: true };
      case "CLEAR_MANUAL_OVERRIDE":
        await patchConversation(request.conversationKey, (record) => ({
          ...record,
          manualStatusOverride: undefined
        }));
        return { ok: true };
      case "REMOVE_RECENT":
        await patchConversation(request.conversationKey, (record) =>
          record.openTabIds.length ? record : undefined
        );
        return { ok: true };
      case "UPDATE_SETTINGS":
        await updateSettings(request.patch as Partial<Settings>);
        return { ok: true };
      case "CLEAR_RECENT":
        await clearRecent();
        return { ok: true };
      case "CLEAR_ALL_DATA":
        await clearAllData();
        return { ok: true };
      case "PROMPTDECK_RESCAN":
        return { ok: true };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unexpected error" };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (!isExtensionRequest(message)) {
    respond({ ok: false, error: "Invalid request" } satisfies ExtensionResponse);
    return false;
  }
  void handleRequest(message, sender).then(respond);
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void queue(async () => {
    const state = await loadState();
    const record = findConversationByTab(state.conversations, tabId);
    if (!record) return;
    const remainingTabs = await chrome.tabs.query({});
    const windows = new Map<number, number>();
    for (const tab of remainingTabs) {
      if (tab.id !== undefined) windows.set(tab.id, tab.windowId);
    }
    const detached = detachTab(record, tabId, windows);
    state.conversations[record.key] = detached;
    await saveState(state);
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) {
    void configureActionForTab(tab.id, tab.url ?? tab.pendingUrl).catch(() => undefined);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  const url = changeInfo.url ?? tab.url ?? tab.pendingUrl;
  void configureActionForTab(tabId, url).catch(() => undefined);
  if (tab.active && !isPromptDeckSidePanelUrl(url)) {
    void hideSidePanelForUnsupportedTab(tab);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then(async (tab) => {
    await configureActionForTab(tabId, tab.url ?? tab.pendingUrl);
    await hideSidePanelForUnsupportedTab(tab);
  }).catch(() => undefined);
  void chrome.tabs.sendMessage(tabId, { type: "PROMPTDECK_RESCAN" }).catch(() => undefined);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const parts = notificationId.split(":");
  if (parts[0] !== "pd" || !parts[2]) return;
  void loadState().then(async (state) => {
    const record = Object.values(state.conversations).find(
      (candidate) => lightweightHash(candidate.key) === parts[2]
    );
    if (record) await focusConversation(record);
    await chrome.notifications.clear(notificationId);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== RECENT_CLEANUP_ALARM) return;
  void queue(async () => {
    const state = cleanupRecent(await loadState());
    await saveState(state);
  });
});

chrome.sidePanel.onOpened.addListener((info) => {
  setSidePanelWindowOpen(info.windowId, true);
});

chrome.sidePanel.onClosed.addListener((info) => {
  setSidePanelWindowOpen(info.windowId, false);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-side-panel") {
    toggleSidePanelForTab(tab, openSidePanelWindowIds, setSidePanelWindowOpen, chrome.sidePanel);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  setSidePanelWindowOpen(windowId, false);
});

chrome.runtime.onInstalled.addListener((details) => {
  void configureSidePanel();
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  void chrome.alarms.create(RECENT_CLEANUP_ALARM, { periodInMinutes: 360 });
  void rescanTabs();
  if (details.reason === "install") void openDashboard();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  void chrome.alarms.create(RECENT_CLEANUP_ALARM, { periodInMinutes: 360 });
  void rescanTabs();
  void queue(async () => saveState(cleanupRecent(await loadState())));
});

void chrome.alarms.create(RECENT_CLEANUP_ALARM, { periodInMinutes: 360 });
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void configureSidePanel();
void rescanTabs();
