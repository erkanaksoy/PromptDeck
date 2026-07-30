import { RECENT_RETENTION_MS } from "../shared/constants";
import type { ConversationRecord, StoredState } from "../shared/types";

export interface OpenConversationTab {
  conversationKey: string;
  tabId: number;
  windowId: number;
}

export function reconcileOpenTabs(
  state: StoredState,
  openTabs: OpenConversationTab[],
  now = Date.now()
): StoredState {
  const tabsByConversation = new Map<string, { tabIds: Set<number>; windowIds: Set<number> }>();
  for (const tab of openTabs) {
    const group = tabsByConversation.get(tab.conversationKey) ?? {
      tabIds: new Set<number>(),
      windowIds: new Set<number>()
    };
    group.tabIds.add(tab.tabId);
    group.windowIds.add(tab.windowId);
    tabsByConversation.set(tab.conversationKey, group);
  }

  const conversations = { ...state.conversations };
  for (const [key, record] of Object.entries(state.conversations)) {
    const group = tabsByConversation.get(key);
    if (!group && !record.conversationId) {
      delete conversations[key];
      continue;
    }
    const openTabIds = group ? [...group.tabIds].sort((a, b) => a - b) : [];
    const windowIds = group ? [...group.windowIds].sort((a, b) => a - b) : [];
    const primaryTabId = openTabIds[0];
    const wasOpen = record.openTabIds.length > 0;
    const updated: ConversationRecord = openTabIds.length
      ? {
          ...record,
          openTabIds,
          primaryTabId,
          windowIds,
          closedAt: undefined,
          recentExpiresAt: undefined
        }
      : {
          ...record,
          openTabIds: [],
          primaryTabId: undefined,
          windowIds: [],
          ...(wasOpen
            ? { closedAt: now, recentExpiresAt: now + RECENT_RETENTION_MS }
            : {})
        };

    conversations[key] = updated;
  }

  return { ...state, conversations };
}

export function attachTab(
  record: ConversationRecord,
  tabId: number,
  windowId: number
): ConversationRecord {
  const openTabIds = [...new Set([...record.openTabIds, tabId])].sort((a, b) => a - b);
  return {
    ...record,
    openTabIds,
    primaryTabId: openTabIds[0],
    windowIds: [...new Set([...record.windowIds, windowId])].sort((a, b) => a - b),
    closedAt: undefined,
    recentExpiresAt: undefined
  };
}

export function detachTab(
  record: ConversationRecord,
  tabId: number,
  remainingTabWindows: Map<number, number>,
  now = Date.now()
): ConversationRecord {
  const openTabIds = record.openTabIds.filter(
    (id) => id !== tabId && remainingTabWindows.has(id)
  );
  const windowIds = [...new Set(openTabIds.map((id) => remainingTabWindows.get(id)).filter(Number.isInteger))] as number[];
  return {
    ...record,
    openTabIds,
    ...(openTabIds.length ? { primaryTabId: openTabIds[0] } : { primaryTabId: undefined }),
    windowIds,
    ...(openTabIds.length
      ? { closedAt: undefined, recentExpiresAt: undefined }
      : { closedAt: now, recentExpiresAt: now + RECENT_RETENTION_MS })
  };
}

export function cleanupRecent(state: StoredState, now = Date.now()): StoredState {
  return {
    ...state,
    conversations: Object.fromEntries(
      Object.entries(state.conversations).filter(
        ([, record]) => !record.recentExpiresAt || record.recentExpiresAt > now
      )
    )
  };
}

export function findConversationByTab(
  conversations: Record<string, ConversationRecord>,
  tabId: number
): ConversationRecord | undefined {
  return Object.values(conversations).find((record) => record.openTabIds.includes(tabId));
}
