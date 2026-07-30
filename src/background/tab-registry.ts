import { RECENT_RETENTION_MS } from "../shared/constants";
import type { ConversationRecord, StoredState } from "../shared/types";

export interface OpenConversationTab {
  conversationKey: string;
  tabId: number;
  windowId: number;
}

export interface ReconciledOpenTabs {
  state: StoredState;
  changed: ConversationRecord[];
}

function sameNumbers(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function reconcileOpenTabs(
  state: StoredState,
  openTabs: OpenConversationTab[],
  now = Date.now()
): ReconciledOpenTabs {
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
  const changed: ConversationRecord[] = [];
  for (const [key, record] of Object.entries(state.conversations)) {
    const group = tabsByConversation.get(key);
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

    if (
      !sameNumbers(record.openTabIds, updated.openTabIds) ||
      !sameNumbers(record.windowIds, updated.windowIds) ||
      record.primaryTabId !== updated.primaryTabId ||
      record.closedAt !== updated.closedAt ||
      record.recentExpiresAt !== updated.recentExpiresAt
    ) {
      conversations[key] = updated;
      changed.push(updated);
    }
  }

  return {
    state: { ...state, conversations },
    changed
  };
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
