import { describe, expect, it } from "vitest";
import {
  notificationEventKey,
  recordNotification,
  shouldNotify
} from "../src/background/notification-manager";
import { migrateStoredState } from "../src/storage/migrations";
import { record } from "./helpers";

describe("notification deduplication", () => {
  it("records and rejects a repeated event fingerprint", () => {
    const conversation = record({ latestAssistantFingerprint: "answer-1" });
    const key = notificationEventKey(conversation, "finished");
    expect(shouldNotify(conversation, key)).toBe(true);
    expect(shouldNotify(recordNotification(conversation, key), key)).toBe(false);
  });

  it("allows a genuinely new error fingerprint", () => {
    const old = record({
      error: {
        category: "network",
        displayMessage: "Network error",
        detectedAt: 1,
        fingerprint: "e1"
      }
    });
    const oldKey = notificationEventKey(old, "error");
    const notified = recordNotification(old, oldKey);
    const newer = {
      ...notified,
      error: { ...old.error!, fingerprint: "e2" }
    };
    expect(shouldNotify(newer, notificationEventKey(newer, "error"))).toBe(true);
  });
});

describe("storage migrations", () => {
  it("uses safe defaults for corrupted data", () => {
    const state = migrateStoredState({ schemaVersion: 1, conversations: "bad", settings: null });
    expect(state.conversations).toEqual({});
    expect(state.settings.theme).toBe("system");
  });

  it("drops corrupted records but keeps valid records", () => {
    const state = migrateStoredState({
      schemaVersion: 1,
      conversations: { good: record(), bad: { key: 3 } },
      settings: {}
    });
    expect(Object.keys(state.conversations)).toEqual(["good"]);
  });

  it("removes obsolete preview and label data", () => {
    const legacyRecord = {
      ...record(),
      labelIds: ["urgent"],
      latestAssistantPreview: "Stored response text",
      previewStored: true
    };
    const state = migrateStoredState({
      schemaVersion: 1,
      conversations: { legacy: legacyRecord },
      settings: {
        showMessagePreviews: true,
        persistMessagePreviews: true
      }
    });
    const migrated = state.conversations.legacy as unknown as Record<string, unknown>;
    expect(migrated.labelIds).toBeUndefined();
    expect(migrated.latestAssistantPreview).toBeUndefined();
    expect(migrated.previewStored).toBeUndefined();
    expect(state.settings).not.toHaveProperty("showMessagePreviews");
    expect(state.settings).not.toHaveProperty("persistMessagePreviews");
  });

  it("falls back on an unsupported schema", () => {
    const state = migrateStoredState({ schemaVersion: 99 });
    expect(state.schemaVersion).toBe(1);
    expect(state.migrationError).toMatch(/reset safely/i);
  });
});
