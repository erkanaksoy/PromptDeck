import { LABELS } from "../shared/constants";
import { normalizeConversationUrl } from "../shared/urls";
import type { LabelId, Platform, TabObservation } from "../shared/types";
import type { ExtensionRequest } from "./messages";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PLATFORMS: Platform[] = ["chatgpt", "claude", "gemini"];
const LABEL_IDS = new Set<LabelId>(LABELS.map((label) => label.id));

export function isTabObservation(value: unknown): value is TabObservation {
  if (!isRecord(value)) return false;
  return (
    PLATFORMS.includes(value.platform as Platform) &&
    typeof value.canonicalUrl === "string" &&
    normalizeConversationUrl(value.canonicalUrl) !== null &&
    typeof value.title === "string" &&
    value.title.length <= 300 &&
    typeof value.isGenerating === "boolean" &&
    typeof value.isVisible === "boolean" &&
    typeof value.observedAt === "number" &&
    isRecord(value.waiting) &&
    typeof value.waiting.waiting === "boolean" &&
    Array.isArray(value.waiting.reasons)
  );
}

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "TAB_OBSERVATION") return isTabObservation(value.payload);
  if (
    [
      "GET_DASHBOARD_STATE",
      "GET_VIEW_DELAY",
      "OPEN_DASHBOARD",
      "RESCAN_TABS",
      "CLEAR_PREVIEWS",
      "CLEAR_RECENT",
      "CLEAR_ALL_DATA",
      "PROMPTDECK_RESCAN"
    ].includes(value.type)
  ) {
    return true;
  }
  if (
    [
      "FOCUS_CONVERSATION",
      "MARK_READ",
      "MARK_UNREAD",
      "CLEAR_MANUAL_OVERRIDE",
      "REMOVE_RECENT"
    ].includes(value.type)
  ) {
    return typeof value.conversationKey === "string";
  }
  if (value.type === "SET_LABELS") {
    return (
      typeof value.conversationKey === "string" &&
      Array.isArray(value.labelIds) &&
      value.labelIds.every((id) => LABEL_IDS.has(id as LabelId))
    );
  }
  if (value.type === "SET_MANUAL_OVERRIDE") {
    return (
      typeof value.conversationKey === "string" &&
      (value.value === "waiting" || value.value === "idle")
    );
  }
  if (value.type === "UPDATE_SETTINGS") return isRecord(value.patch);
  return false;
}
