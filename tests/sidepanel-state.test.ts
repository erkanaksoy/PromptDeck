import { describe, expect, it } from "vitest";
import { buildSidePanelItems, groupSidePanelItems } from "../src/sidepanel/state";
import { record } from "./helpers";

describe("side panel list state", () => {
  it("collapses duplicate tabs and targets the active copy", () => {
    const items = buildSidePanelItems([
      record({ openTabIds: [1, 2, 3], primaryTabId: 1 })
    ], 2, new Set());

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ targetTabId: 2, duplicateCount: 3, isCurrent: true });
  });

  it("uses the primary tab when a different browser tab is active", () => {
    const [item] = buildSidePanelItems([
      record({ openTabIds: [4, 5], primaryTabId: 5 })
    ], 99, new Set());

    expect(item).toMatchObject({ targetTabId: 5, duplicateCount: 2, isCurrent: false });
  });

  it("combines quick filters and groups the remaining conversations", () => {
    const items = buildSidePanelItems([
      record({ key: "chatgpt:error", automaticStatus: "error" }),
      record({ key: "chatgpt:waiting", automaticStatus: "waiting", openTabIds: [2] }),
      record({
        key: "claude:generating",
        platform: "claude",
        automaticStatus: "generating",
        openTabIds: [3]
      }),
      record({ key: "gemini:idle", platform: "gemini", openTabIds: [4] })
    ], undefined, new Set(["error", "generating"]));

    expect(items.map((item) => item.record.key)).toEqual(["chatgpt:error", "claude:generating"]);
    expect(groupSidePanelItems(items, "provider").map((group) => group.key)).toEqual([
      "chatgpt",
      "claude"
    ]);
    expect(groupSidePanelItems(items, "status").map((group) => group.key)).toEqual([
      "error",
      "generating"
    ]);
  });

  it("combines provider and status filters", () => {
    const items = buildSidePanelItems([
      record({ key: "chatgpt:error", automaticStatus: "error" }),
      record({ key: "claude:error", platform: "claude", automaticStatus: "error", openTabIds: [2] }),
      record({ key: "claude:waiting", platform: "claude", automaticStatus: "waiting", openTabIds: [3] })
    ], undefined, new Set(["error"]), new Set(["claude"]));

    expect(items.map((item) => item.record.key)).toEqual(["claude:error"]);
  });
});
