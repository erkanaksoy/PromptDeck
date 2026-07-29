import type { ConversationRecord } from "../shared/types";

export function notificationEventKey(
  record: ConversationRecord,
  event: "finished" | "waiting" | "error"
): string {
  const fingerprint =
    event === "error"
      ? record.error?.fingerprint
      : record.latestAssistantFingerprint || record.generationFinishedAt;
  return `${event}:${fingerprint || record.lastActivityAt}`;
}

export function shouldNotify(record: ConversationRecord, eventKey: string): boolean {
  return !record.lastNotifiedEvents.includes(eventKey);
}

export function recordNotification(
  record: ConversationRecord,
  eventKey: string
): ConversationRecord {
  return {
    ...record,
    lastNotifiedEvents: [...record.lastNotifiedEvents, eventKey].slice(-30)
  };
}
