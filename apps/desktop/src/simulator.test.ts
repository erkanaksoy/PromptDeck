import { describe, expect, it } from "vitest";
import { displayStatus, sortConversations } from "@promptdeck/status-engine";
import { simulatedSnapshot } from "./simulator";

describe("desktop simulator", () => {
  it("provides every attention state and a Recent fixture", () => {
    const snapshot = simulatedSnapshot(1_000_000);
    const statuses = new Set(snapshot.conversations.map(displayStatus));
    expect(statuses).toEqual(new Set([
      "error", "waiting", "finished_unread", "generating", "idle", "recent"
    ]));
    expect(snapshot.connectionState).toBe("connected");
  });

  it("uses the shared compact priority order", () => {
    const sorted = sortConversations(simulatedSnapshot().conversations, "priority");
    expect(sorted.map(displayStatus)).toEqual([
      "error", "waiting", "finished_unread", "generating", "idle", "recent"
    ]);
  });
});
