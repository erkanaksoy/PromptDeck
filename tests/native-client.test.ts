import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeMessagingClient } from "../src/background/native-client";
import type { DashboardState } from "../src/shared/types";
import type { ConversationRecord } from "../src/shared/types";

function conversation(): ConversationRecord {
  const now = Date.now();
  return {
    key: "claude:new",
    platform: "claude",
    canonicalUrl: "https://claude.ai/new",
    title: "New chat",
    openTabIds: [7],
    primaryTabId: 7,
    windowIds: [1],
    automaticStatus: "idle",
    isUnread: false,
    labelIds: [],
    previewStored: false,
    lastActivityAt: now,
    lastObservedAt: now,
    lastNotifiedEvents: [],
    detectionAvailable: true,
    schemaVersion: 1
  };
}

function fakePort(posted: unknown[]): chrome.runtime.Port {
  return {
    name: "com.promptdeck.desktop",
    postMessage(message: unknown) {
      posted.push(message);
    },
    disconnect() {},
    onMessage: { addListener() {} },
    onDisconnect: { addListener() {} }
  } as unknown as chrome.runtime.Port;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("native messaging client", () => {
  it("replays a full snapshot when an update occurs before the native port is ready", async () => {
    const posted: Array<{ type?: string; payload?: { conversations?: ConversationRecord[] } }> = [];
    const state: DashboardState = {
      conversations: [],
      settings: {} as DashboardState["settings"],
      windowLabels: {}
    };
    const client = new NativeMessagingClient(async () => state, async () => undefined);

    expect(client.send("CONVERSATION_UPSERT", { conversation: conversation() })).toBe(false);
    state.conversations = [conversation()];

    vi.stubGlobal("chrome", {
      runtime: {
        connectNative: () => fakePort(posted),
        getManifest: () => ({ version: "1.0.0" })
      }
    });

    client.start(true);
    await vi.waitFor(() => {
      expect(posted.some((message) =>
        message.type === "FULL_STATE_SNAPSHOT" &&
        message.payload?.conversations?.some((item) => item.key === "claude:new")
      )).toBe(true);
    });
  });

  it("sends a reconciliation snapshot with the 25-second heartbeat", async () => {
    vi.useFakeTimers();
    const posted: Array<{ type?: string; payload?: { conversations?: ConversationRecord[] } }> = [];
    const state: DashboardState = {
      conversations: [],
      settings: {} as DashboardState["settings"],
      windowLabels: {}
    };
    vi.stubGlobal("chrome", {
      runtime: {
        connectNative: () => fakePort(posted),
        getManifest: () => ({ version: "1.0.2" })
      }
    });
    const client = new NativeMessagingClient(async () => state, async () => undefined);
    client.start(true);
    await vi.advanceTimersByTimeAsync(0);

    state.conversations = [conversation()];
    await vi.advanceTimersByTimeAsync(25_000);

    expect(posted.some((message) =>
      message.type === "FULL_STATE_SNAPSHOT" &&
      message.payload?.conversations?.some((item) => item.key === "claude:new")
    )).toBe(true);
    client.setEnabled(false);
  });
});
