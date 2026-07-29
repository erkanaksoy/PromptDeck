import { describe, expect, it } from "vitest";
import {
  MAX_NATIVE_MESSAGE_BYTES,
  MessageLedger,
  NativeFrameDecoder,
  ReconnectBackoff,
  applyUpsert,
  createEnvelope,
  createNativeHostManifest,
  frameNativeMessage,
  isSupportedConversationUrl,
  isValidExtensionId,
  parseEnvelopeJson,
  reconcileSnapshot,
  validateEnvelope
} from "../packages/protocol/src/index";
import { recoverWindowPlacement } from "../packages/utilities/src/index";
import type { ConversationRecord } from "../src/shared/types";

function conversation(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
  const now = Date.now();
  return {
    key: "chatgpt:one",
    platform: "chatgpt",
    canonicalUrl: "https://chatgpt.com/c/one",
    title: "Test",
    openTabIds: [1],
    primaryTabId: 1,
    windowIds: [1],
    automaticStatus: "idle",
    isUnread: false,
    labelIds: [],
    previewStored: false,
    lastActivityAt: now,
    lastObservedAt: now,
    lastNotifiedEvents: [],
    detectionAvailable: true,
    schemaVersion: 1,
    ...overrides
  };
}

describe("desktop protocol", () => {
  it("serializes, parses, and validates a protocol envelope", () => {
    const message = createEnvelope("FOCUS_CONVERSATION", "desktop", { conversationKey: "chatgpt:one" });
    const result = parseEnvelopeJson(JSON.stringify(message));
    expect(result.ok && result.message.type).toBe("FOCUS_CONVERSATION");
  });

  it("rejects unknown types and protocol mismatches", () => {
    const message = createEnvelope("PING", "desktop", { nonce: "x" });
    expect(validateEnvelope({ ...message, type: "EXECUTE" }).ok).toBe(false);
    const mismatch = validateEnvelope({ ...message, protocolVersion: 2 });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("PROTOCOL_MISMATCH");
  });

  it("rejects invalid JSON and oversized JSON", () => {
    expect(parseEnvelopeJson("{").ok).toBe(false);
    expect(parseEnvelopeJson(`"${"x".repeat(MAX_NATIVE_MESSAGE_BYTES)}"`).ok).toBe(false);
  });

  it("validates supported URLs and extension IDs", () => {
    expect(isSupportedConversationUrl("https://chatgpt.com/c/one")).toBe(true);
    expect(isSupportedConversationUrl("http://chatgpt.com/c/one")).toBe(false);
    expect(isSupportedConversationUrl("https://evil.example/c/one")).toBe(false);
    expect(isValidExtensionId("abcdefghijklmnopabcdefghijklmnop")).toBe(true);
    expect(isValidExtensionId("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
  });

  it("decodes partial and multiple native message frames", () => {
    const first = frameNativeMessage({ type: "one" });
    const second = frameNativeMessage({ type: "two" });
    const decoder = new NativeFrameDecoder();
    expect(decoder.push(first.slice(0, 3))).toEqual([]);
    expect(decoder.push(first.slice(3))).toEqual([{ type: "one" }]);
    const joined = new Uint8Array(first.length + second.length);
    joined.set(first); joined.set(second, first.length);
    expect(new NativeFrameDecoder().push(joined)).toEqual([{ type: "one" }, { type: "two" }]);
  });

  it("rejects malformed and oversized frame lengths", () => {
    const malformed = new Uint8Array(4);
    new DataView(malformed.buffer).setUint32(0, MAX_NATIVE_MESSAGE_BYTES + 1, true);
    expect(() => new NativeFrameDecoder().push(malformed)).toThrow("Invalid message length");
  });

  it("reconciles snapshots and applies incremental updates", () => {
    const existing = conversation({ labelIds: ["work"] });
    const incoming = conversation({ title: "Updated", automaticStatus: "waiting" });
    const snapshot = reconcileSnapshot(new Map([[existing.key, existing]]), [incoming]);
    expect(snapshot.get(existing.key)?.title).toBe("Updated");
    const incremental = applyUpsert(snapshot, conversation({ title: "Incremental" }));
    expect(incremental.get(existing.key)?.title).toBe("Incremental");
    expect(incremental.size).toBe(1);
  });

  it("uses deterministic last-write-wins metadata for shared fields", () => {
    const existing = conversation({
      labelIds: ["work"],
      sharedFields: { labels: { updatedAt: 20, source: "desktop", mutationId: "b" } }
    });
    const stale = conversation({
      labelIds: ["urgent"],
      sharedFields: { labels: { updatedAt: 10, source: "extension", mutationId: "a" } }
    });
    expect(applyUpsert(new Map([[existing.key, existing]]), stale).get(existing.key)?.labelIds).toEqual(["work"]);
  });

  it("deduplicates message IDs and bounds reconnect backoff", () => {
    const ledger = new MessageLedger(2);
    expect(ledger.accept("one")).toBe(true);
    expect(ledger.accept("one")).toBe(false);
    ledger.accept("two"); ledger.accept("three");
    expect(ledger.accept("one")).toBe(true);
    const backoff = new ReconnectBackoff(1000, 4000, () => 0.5);
    expect([backoff.nextDelay(), backoff.nextDelay(), backoff.nextDelay(), backoff.nextDelay()])
      .toEqual([1000, 2000, 4000, 4000]);
  });

  it("generates a restricted native host manifest", () => {
    const manifest = createNativeHostManifest(
      "C:\\Program Files\\PromptDeck\\promptdeck-native-host.exe",
      "abcdefghijklmnopabcdefghijklmnop"
    );
    expect(manifest.allowed_origins).toEqual([
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop/"
    ]);
    expect(() => createNativeHostManifest("relative.exe", "abcdefghijklmnopabcdefghijklmnop")).toThrow();
  });
});

describe("window recovery", () => {
  const primary = {
    name: "Primary",
    scaleFactor: 1.25,
    primary: true,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }
  };

  it("keeps a reachable secondary-monitor placement", () => {
    const result = recoverWindowPlacement(
      { x: 2000, y: 50, width: 500, height: 700, monitorName: "Side", maximized: false },
      [primary, { name: "Side", scaleFactor: 1.5, primary: false, bounds: { x: 1920, y: 0, width: 1440, height: 900 } }]
    );
    expect(result.x).toBe(2000);
    expect(result.monitorName).toBe("Side");
  });

  it("recovers safely when the saved monitor is disconnected", () => {
    const result = recoverWindowPlacement(
      { x: 4000, y: 80, width: 500, height: 700, monitorName: "Missing", maximized: false },
      [primary]
    );
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x + result.width).toBeLessThanOrEqual(1920);
  });
});
