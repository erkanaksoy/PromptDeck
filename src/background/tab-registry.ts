import { RECENT_RETENTION_MS } from "../shared/constants";
import type { ConversationRecord, StoredState } from "../shared/types";

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
  const openTabIds = record.openTabIds.filter((id) => id !== tabId);
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
