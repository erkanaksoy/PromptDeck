import type { ConversationRecord, TabObservation } from "../src/shared/types";

export function record(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    key: "chatgpt:one",
    platform: "chatgpt",
    conversationId: "one",
    canonicalUrl: "https://chatgpt.com/c/one",
    title: "Alpha",
    openTabIds: [1],
    primaryTabId: 1,
    windowIds: [10],
    automaticStatus: "idle",
    isUnread: false,
    labelIds: [],
    previewStored: false,
    lastActivityAt: 1000,
    lastObservedAt: 1000,
    lastNotifiedEvents: [],
    detectionAvailable: true,
    schemaVersion: 1,
    ...overrides
  };
}

export function observation(overrides: Partial<TabObservation> = {}): TabObservation {
  return {
    platform: "chatgpt",
    conversationId: "one",
    canonicalUrl: "https://chatgpt.com/c/one",
    title: "Alpha",
    automaticStatus: "idle",
    isGenerating: false,
    isVisible: false,
    latestAssistantFingerprint: "response:new",
    waiting: { waiting: false, confidence: "low", reasons: [] },
    observedAt: 2000,
    detectionAvailable: true,
    ...overrides
  };
}
