import { describe, expect, it } from "vitest";
import { RECENT_RETENTION_MS } from "../src/shared/constants";
import {
  attachTab,
  cleanupRecent,
  detachTab
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
