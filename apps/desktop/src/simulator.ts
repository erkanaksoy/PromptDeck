import type { ConversationRecord, Platform, AutomaticStatus } from "@promptdeck/shared-types";
import type { DesktopSnapshot } from "./desktop-types";
import { DEFAULT_DESKTOP_PREFERENCES } from "./desktop-types";

const rows: Array<[Platform, AutomaticStatus, string, boolean]> = [
  ["chatgpt", "error", "Windows packaging investigation", true],
  ["claude", "waiting", "Review the migration strategy", true],
  ["gemini", "finished_unread", "Secondary monitor layout options", true],
  ["chatgpt", "generating", "Native messaging reliability tests", false],
  ["claude", "idle", "Accessibility checklist", false],
  ["gemini", "idle", "Release notes draft", false]
];

function record(
  [platform, status, title, unread]: (typeof rows)[number],
  index: number,
  now: number
): ConversationRecord {
  const active = index < 5;
  return {
    key: `${platform}:simulated-${index}`,
    platform,
    conversationId: `simulated-${index}`,
    canonicalUrl:
      platform === "chatgpt"
        ? `https://chatgpt.com/c/simulated-${index}`
        : platform === "claude"
          ? `https://claude.ai/chat/simulated-${index}`
          : `https://gemini.google.com/app/simulated-${index}`,
    title,
    openTabIds: active ? [100 + index] : [],
    primaryTabId: active ? 100 + index : undefined,
    windowIds: active ? [2] : [],
    automaticStatus: status,
    isUnread: unread,
    labelIds: index === 0 ? ["urgent", "coding"] : index === 1 ? ["review"] : ["work"],
    previewStored: false,
    lastActivityAt: now - index * 180_000,
    lastObservedAt: now - index * 30_000,
    closedAt: active ? undefined : now - 300_000,
    recentExpiresAt: active ? undefined : now + 6 * 86_400_000,
    lastNotifiedEvents: [],
    detectionAvailable: true,
    error:
      status === "error"
        ? {
            category: "network",
            displayMessage: "The platform reported a temporary network failure.",
            detectedAt: now,
            fingerprint: "simulated-error"
          }
        : undefined,
    schemaVersion: 1
  };
}

export function simulatedSnapshot(now = Date.now()): DesktopSnapshot {
  return {
    conversations: rows.map((row, index) => record(row, index, now)),
    connectionState: "connected",
    lastSyncAt: now,
    stale: false,
    preferences: DEFAULT_DESKTOP_PREFERENCES
  };
}
