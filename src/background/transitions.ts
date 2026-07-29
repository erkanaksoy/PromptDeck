import { SCHEMA_VERSION } from "../shared/constants";
import type {
  AutomaticStatus,
  ConversationRecord,
  TabObservation
} from "../shared/types";

export interface TransitionContext {
  tabId: number;
  windowId: number;
  isActive: boolean;
  now: number;
  persistPreview: boolean;
}

export interface TransitionResult {
  record: ConversationRecord;
  events: Array<"finished" | "waiting" | "error">;
}

function baseRecord(observation: TabObservation, context: TransitionContext): ConversationRecord {
  return {
    key: "",
    platform: observation.platform,
    ...(observation.conversationId ? { conversationId: observation.conversationId } : {}),
    canonicalUrl: observation.canonicalUrl,
    title: observation.title,
    openTabIds: [context.tabId],
    primaryTabId: context.tabId,
    windowIds: [context.windowId],
    automaticStatus: observation.automaticStatus,
    isUnread: false,
    labelIds: [],
    previewStored: false,
    lastActivityAt: observation.observedAt,
    lastObservedAt: observation.observedAt,
    lastNotifiedEvents: [],
    detectionAvailable: observation.detectionAvailable,
    ...(observation.detectionMessage ? { detectionMessage: observation.detectionMessage } : {}),
    schemaVersion: SCHEMA_VERSION
  };
}

export function reduceObservation(
  current: ConversationRecord | undefined,
  observation: TabObservation,
  context: TransitionContext
): TransitionResult {
  const previous = current ?? baseRecord(observation, context);
  const events: TransitionResult["events"] = [];
  const hasNewResponse =
    Boolean(observation.latestAssistantFingerprint) &&
    observation.latestAssistantFingerprint !== previous.latestAssistantFingerprint;
  const generationFinished = previous.automaticStatus === "generating" && !observation.isGenerating;
  const shouldUnread = (generationFinished || hasNewResponse) && !(context.isActive && observation.isVisible);

  let automaticStatus: AutomaticStatus = observation.automaticStatus;
  let isUnread = previous.isUnread;
  if (observation.error) {
    automaticStatus = "error";
    if (
      previous.automaticStatus !== "error" ||
      previous.error?.fingerprint !== observation.error.fingerprint
    ) {
      events.push("error");
    }
  } else if (observation.isGenerating) {
    automaticStatus = "generating";
    isUnread = false;
  } else if (observation.waiting.waiting && observation.waiting.confidence !== "low") {
    automaticStatus = "waiting";
    if (
      previous.automaticStatus !== "waiting" ||
      (hasNewResponse && observation.latestAssistantFingerprint)
    ) {
      events.push("waiting");
    }
  } else if (shouldUnread) {
    automaticStatus = "finished_unread";
  } else if (!isUnread) {
    automaticStatus = observation.detectionAvailable ? "idle" : "unknown";
  }

  if (shouldUnread) {
    isUnread = true;
    if (generationFinished || hasNewResponse) events.push("finished");
    if (automaticStatus === "idle") automaticStatus = "finished_unread";
  }
  if (context.isActive && observation.isVisible && !observation.isGenerating && !shouldUnread) {
    isUnread = false;
    if (automaticStatus === "finished_unread") automaticStatus = "idle";
  }

  const manualStatusOverride =
    hasNewResponse &&
    previous.manualStatusOverride?.responseFingerprint &&
    previous.manualStatusOverride.responseFingerprint !== observation.latestAssistantFingerprint
      ? undefined
      : previous.manualStatusOverride;

  const record: ConversationRecord = {
    ...previous,
    platform: observation.platform,
    ...(observation.conversationId ? { conversationId: observation.conversationId } : {}),
    canonicalUrl: observation.canonicalUrl,
    title: observation.title,
    openTabIds: [...new Set([...previous.openTabIds, context.tabId])].sort((a, b) => a - b),
    primaryTabId: Math.min(...new Set([...previous.openTabIds, context.tabId])),
    windowIds: [...new Set([...previous.windowIds, context.windowId])].sort((a, b) => a - b),
    automaticStatus,
    isUnread,
    waitingConfidence: observation.waiting.confidence,
    waitingReasons: observation.waiting.reasons,
    ...(manualStatusOverride ? { manualStatusOverride } : { manualStatusOverride: undefined }),
    ...(observation.latestAssistantFingerprint
      ? { latestAssistantFingerprint: observation.latestAssistantFingerprint }
      : {}),
    ...(context.persistPreview && observation.latestAssistantPreview
      ? { latestAssistantPreview: observation.latestAssistantPreview, previewStored: true }
      : { previewStored: false, latestAssistantPreview: undefined }),
    lastActivityAt:
      observation.isGenerating || hasNewResponse || observation.error
        ? observation.observedAt
        : previous.lastActivityAt,
    lastObservedAt: observation.observedAt,
    ...(observation.isGenerating && !previous.generationStartedAt
      ? { generationStartedAt: observation.observedAt }
      : {}),
    ...(generationFinished ? { generationFinishedAt: observation.observedAt } : {}),
    ...(observation.error ? { error: observation.error } : { error: undefined }),
    detectionAvailable: observation.detectionAvailable,
    ...(observation.detectionMessage
      ? { detectionMessage: observation.detectionMessage }
      : { detectionMessage: undefined }),
    closedAt: undefined,
    recentExpiresAt: undefined
  };

  return { record, events: [...new Set(events)] };
}

export function markRead(record: ConversationRecord, now = Date.now()): ConversationRecord {
  return {
    ...record,
    isUnread: false,
    automaticStatus:
      record.automaticStatus === "finished_unread" ? "idle" : record.automaticStatus,
    lastViewedAt: now
  };
}

export function setManualOverride(
  record: ConversationRecord,
  value: "waiting" | "idle",
  now = Date.now()
): ConversationRecord {
  return {
    ...record,
    manualStatusOverride: {
      value,
      ...(record.latestAssistantFingerprint
        ? { responseFingerprint: record.latestAssistantFingerprint }
        : {}),
      setAt: now
    }
  };
}

export function effectiveStatus(record: ConversationRecord): ConversationRecord["automaticStatus"] {
  return record.manualStatusOverride?.value ?? record.automaticStatus;
}
