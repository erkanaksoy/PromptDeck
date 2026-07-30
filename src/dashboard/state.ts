import type {
  ConversationRecord,
  DisplayStatus,
  Filters,
  SortMode
} from "../shared/types";
import { LABELS } from "../shared/constants";

export const EMPTY_FILTERS: Filters = {
  query: "",
  platforms: [],
  statuses: [],
  labels: [],
  windows: [],
  unreadOnly: false,
  activeOnly: false,
  recentOnly: false
};

export function displayStatus(record: ConversationRecord): DisplayStatus {
  if (!record.openTabIds.length) return "recent";
  return record.manualStatusOverride?.value ?? record.automaticStatus;
}

export const STATUS_PRIORITY: Record<DisplayStatus, number> = {
  error: 0,
  waiting: 1,
  finished_unread: 2,
  generating: 3,
  idle: 4,
  unknown: 5,
  recent: 6
};

export function sortConversations(
  records: ConversationRecord[],
  mode: SortMode
): ConversationRecord[] {
  const result = [...records];
  const byActivity = (a: ConversationRecord, b: ConversationRecord) =>
    b.lastActivityAt - a.lastActivityAt || a.key.localeCompare(b.key);
  result.sort((a, b) => {
    switch (mode) {
      case "priority":
      case "status":
        return STATUS_PRIORITY[displayStatus(a)] - STATUS_PRIORITY[displayStatus(b)] || byActivity(a, b);
      case "unread":
        return Number(b.isUnread) - Number(a.isUnread) || byActivity(a, b);
      case "recent":
        return byActivity(a, b);
      case "oldest":
        return a.lastActivityAt - b.lastActivityAt || a.key.localeCompare(b.key);
      case "title-asc":
        return a.title.localeCompare(b.title) || byActivity(a, b);
      case "title-desc":
        return b.title.localeCompare(a.title) || byActivity(a, b);
      case "platform":
        return a.platform.localeCompare(b.platform) || byActivity(a, b);
      case "window":
        return (a.windowIds[0] ?? Infinity) - (b.windowIds[0] ?? Infinity) || byActivity(a, b);
      case "label":
        return (a.labelIds[0] ?? "zzz").localeCompare(b.labelIds[0] ?? "zzz") || byActivity(a, b);
      case "recently-closed":
        return (b.closedAt ?? 0) - (a.closedAt ?? 0) || byActivity(a, b);
    }
  });
  return result;
}

export function filterConversations(
  records: ConversationRecord[],
  filters: Filters,
  previewsEnabled = false
): ConversationRecord[] {
  const query = filters.query.trim().toLowerCase();
  return records.filter((record) => {
    const status = displayStatus(record);
    if (filters.platforms.length && !filters.platforms.includes(record.platform)) return false;
    if (filters.statuses.length && !filters.statuses.includes(status)) return false;
    if (filters.labels.length && !filters.labels.every((id) => record.labelIds.includes(id))) return false;
    if (filters.windows.length && !filters.windows.some((id) => record.windowIds.includes(id))) return false;
    if (filters.unreadOnly && !record.isUnread) return false;
    if (filters.activeOnly && !record.openTabIds.length) return false;
    if (filters.recentOnly && record.openTabIds.length > 0) return false;
    if (!query) return true;
    const labelNames = LABELS
      .filter((label) => record.labelIds.includes(label.id))
      .map((label) => label.name)
      .join(" ");
    return [
      record.title,
      record.platform,
      labelNames,
      ...(previewsEnabled && record.latestAssistantPreview ? [record.latestAssistantPreview] : [])
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}
