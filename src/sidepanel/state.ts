import { sortConversations, displayStatus } from "../dashboard/state";
import type { ConversationRecord, DisplayStatus, Platform } from "../shared/types";

export type SidePanelQuickFilter = "error" | "waiting" | "generating";
export type SidePanelGroupMode = "none" | "provider" | "status";

export interface SidePanelItem {
  record: ConversationRecord;
  status: DisplayStatus;
  targetTabId: number;
  duplicateCount: number;
  isCurrent: boolean;
}

export interface SidePanelGroup {
  key: string;
  platform?: Platform;
  status?: DisplayStatus;
  items: SidePanelItem[];
}

export function buildSidePanelItems(
  records: ConversationRecord[],
  activeTabId: number | undefined,
  filters: ReadonlySet<SidePanelQuickFilter>
): SidePanelItem[] {
  return sortConversations(
    records.filter((record) => record.openTabIds.length > 0),
    "priority"
  )
    .map((record): SidePanelItem => {
      const isCurrent = activeTabId !== undefined && record.openTabIds.includes(activeTabId);
      const targetTabId = isCurrent
        ? activeTabId
        : record.primaryTabId !== undefined && record.openTabIds.includes(record.primaryTabId)
          ? record.primaryTabId
          : record.openTabIds[0]!;
      return {
        record,
        status: displayStatus(record),
        targetTabId,
        duplicateCount: record.openTabIds.length,
        isCurrent
      };
    })
    .filter((item) => filters.size === 0 || filters.has(item.status as SidePanelQuickFilter));
}

export function groupSidePanelItems(
  items: SidePanelItem[],
  mode: SidePanelGroupMode
): SidePanelGroup[] {
  if (mode === "none") return items.length ? [{ key: "all", items }] : [];

  const groups = new Map<string, SidePanelGroup>();
  for (const item of items) {
    const key = mode === "provider" ? item.record.platform : item.status;
    const group = groups.get(key) ?? {
      key,
      ...(mode === "provider" ? { platform: item.record.platform } : { status: item.status }),
      items: []
    };
    group.items.push(item);
    groups.set(key, group);
  }
  const platformOrder: Platform[] = ["chatgpt", "claude", "gemini"];
  const statusOrder: DisplayStatus[] = [
    "error",
    "waiting",
    "finished_unread",
    "generating",
    "idle",
    "unknown",
    "recent"
  ];
  return [...groups.values()].sort((left, right) => mode === "provider"
    ? platformOrder.indexOf(left.platform!) - platformOrder.indexOf(right.platform!)
    : statusOrder.indexOf(left.status!) - statusOrder.indexOf(right.status!));
}
