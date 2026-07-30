import { DEFAULT_SETTINGS, SCHEMA_VERSION } from "../shared/constants";
import type { ConversationRecord, StoredState } from "../shared/types";

export function createDefaultState(): StoredState {
  return {
    schemaVersion: SCHEMA_VERSION,
    conversations: {},
    settings: { ...DEFAULT_SETTINGS },
    windowLabels: {},
    nextWindowLabel: 1
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConversation(value: unknown): value is ConversationRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    ["chatgpt", "claude", "gemini"].includes(String(value.platform)) &&
    typeof value.canonicalUrl === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.openTabIds) &&
    Array.isArray(value.windowIds) &&
    Array.isArray(value.labelIds) &&
    typeof value.lastActivityAt === "number"
  );
}

export function migrateStoredState(raw: unknown): StoredState {
  if (!isRecord(raw)) return createDefaultState();
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return { ...createDefaultState(), migrationError: "Unsupported storage schema was reset safely." };
  }

  const state = createDefaultState();
  const rawConversations = isRecord(raw.conversations) ? raw.conversations : {};
  for (const [key, value] of Object.entries(rawConversations)) {
    if (!isConversation(value)) continue;
    state.conversations[key] = {
      ...value,
      key,
      schemaVersion: SCHEMA_VERSION,
      openTabIds: [...new Set(value.openTabIds.filter(Number.isInteger))],
      windowIds: [...new Set(value.windowIds.filter(Number.isInteger))],
      labelIds: [...new Set(value.labelIds)],
      lastNotifiedEvents: Array.isArray(value.lastNotifiedEvents)
        ? value.lastNotifiedEvents.filter((entry): entry is string => typeof entry === "string").slice(-30)
        : [],
      previewStored: Boolean(value.previewStored),
      detectionAvailable: value.detectionAvailable !== false
    };
  }
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>) {
    if (rawSettings[key] !== undefined) {
      (settings as Record<string, unknown>)[key] = rawSettings[key];
    }
  }
  state.settings = settings;
  state.windowLabels = isRecord(raw.windowLabels)
    ? Object.fromEntries(
        Object.entries(raw.windowLabels).filter(
          (entry): entry is [string, number] => typeof entry[1] === "number"
        )
      )
    : {};
  state.nextWindowLabel =
    typeof raw.nextWindowLabel === "number" ? Math.max(1, raw.nextWindowLabel) : 1;
  return state;
}
