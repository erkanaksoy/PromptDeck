import { describe, expect, it } from "vitest";
import { RECENT_RETENTION_MS } from "../src/shared/constants";
import {
  attachTab,
  cleanupRecent,
  detachTab,
  reconcileOpenTabs
} from "../src/background/tab-registry";
import { createDefaultState } from "../src/storage/migrations";
import { record } from "./helpers";

describe("conversation deduplication", () => {
  it("represents the same conversation in two tabs once", () => {
    const result = attachTab(record(), 2, 11);
    expect(result.openTabIds).toEqual([1, 2]);
    expect(result.windowIds).toEqual([10, 11]);
    expect(result.primaryTabId).toBe(1);
  });

  it("keeps active state when one duplicate closes", () => {
    const current = record({ openTabIds: [1, 2], windowIds: [10, 11] });
    const result = detachTab(current, 1, new Map([[2, 11]]), 5000);
    expect(result.openTabIds).toEqual([2]);
    expect(result.closedAt).toBeUndefined();
  });

  it("moves to Recent after the final tab closes", () => {
    const result = detachTab(record(), 1, new Map(), 5000);
    expect(result.openTabIds).toEqual([]);
    expect(result.closedAt).toBe(5000);
    expect(result.recentExpiresAt).toBe(5000 + RECENT_RETENTION_MS);
  });

  it("drops stale sibling tab IDs while processing a close", () => {
    const current = record({ openTabIds: [1, 2, 3], windowIds: [10, 11] });
    const result = detachTab(current, 1, new Map([[2, 11]]), 5000);

    expect(result.openTabIds).toEqual([2]);
    expect(result.windowIds).toEqual([11]);
    expect(result.primaryTabId).toBe(2);
  });

  it("reopens a Recent record", () => {
    const recent = record({
      openTabIds: [],
      primaryTabId: undefined,
      windowIds: [],
      closedAt: 5000,
      recentExpiresAt: 5000 + RECENT_RETENTION_MS
    });
    const result = attachTab(recent, 9, 22);
    expect(result.openTabIds).toEqual([9]);
    expect(result.closedAt).toBeUndefined();
  });
});

describe("Recent retention", () => {
  it("keeps an entry before seven-day expiry", () => {
    const state = createDefaultState();
    state.conversations.one = record({ recentExpiresAt: 1001, closedAt: 1 });
    expect(cleanupRecent(state, 1000).conversations.one).toBeDefined();
  });

  it("removes an entry after expiry", () => {
    const state = createDefaultState();
    state.conversations.one = record({ recentExpiresAt: 999, closedAt: 1 });
    expect(cleanupRecent(state, 1000).conversations.one).toBeUndefined();
  });

  it("is idempotent", () => {
    const state = createDefaultState();
    state.conversations.one = record({ recentExpiresAt: 999, closedAt: 1 });
    expect(cleanupRecent(cleanupRecent(state, 1000), 1000)).toEqual(cleanupRecent(state, 1000));
  });
});

describe("authoritative tab reconciliation", () => {
  it("replaces persisted tab IDs with Chrome's current tab snapshot", () => {
    const state = createDefaultState();
    state.conversations.one = record({
      key: "one",
      openTabIds: [1, 2],
      primaryTabId: 1,
      windowIds: [10, 11]
    });

    const result = reconcileOpenTabs(
      state,
      [{ conversationKey: "one", tabId: 7, windowId: 20 }],
      5000
    );
    const reconciled = result.state.conversations.one!;

    expect(reconciled.openTabIds).toEqual([7]);
    expect(reconciled.primaryTabId).toBe(7);
    expect(reconciled.windowIds).toEqual([20]);
    expect(reconciled.closedAt).toBeUndefined();
    expect(result.changed.map((item) => item.key)).toEqual(["one"]);
  });

  it("moves records with missing tabs to Recent", () => {
    const state = createDefaultState();
    state.conversations.one = record({
      key: "one",
      openTabIds: [99],
      primaryTabId: 99,
      windowIds: [10]
    });

    const result = reconcileOpenTabs(state, [], 5000);
    const reconciled = result.state.conversations.one!;

    expect(reconciled.openTabIds).toEqual([]);
    expect(reconciled.primaryTabId).toBeUndefined();
    expect(reconciled.windowIds).toEqual([]);
    expect(reconciled.closedAt).toBe(5000);
    expect(reconciled.recentExpiresAt).toBe(5000 + RECENT_RETENTION_MS);
  });

  it("moves a reused tab ID to the conversation matching its current URL", () => {
    const state = createDefaultState();
    state.conversations.one = record({ key: "one", openTabIds: [7], primaryTabId: 7 });
    state.conversations.two = record({
      key: "two",
      openTabIds: [],
      primaryTabId: undefined,
      windowIds: [],
      closedAt: 1000,
      recentExpiresAt: 1000 + RECENT_RETENTION_MS
    });

    const result = reconcileOpenTabs(
      state,
      [{ conversationKey: "two", tabId: 7, windowId: 30 }],
      5000
    );
    const first = result.state.conversations.one!;
    const second = result.state.conversations.two!;

    expect(first.openTabIds).toEqual([]);
    expect(second.openTabIds).toEqual([7]);
    expect(second.closedAt).toBeUndefined();
  });

  it("is idempotent for an unchanged browser snapshot", () => {
    const state = createDefaultState();
    state.conversations.one = record({ key: "one" });
    const openTabs = [{ conversationKey: "one", tabId: 1, windowId: 10 }];

    const first = reconcileOpenTabs(state, openTabs, 5000);
    const second = reconcileOpenTabs(first.state, openTabs, 6000);

    expect(first.changed).toEqual([]);
    expect(second.changed).toEqual([]);
  });
});
