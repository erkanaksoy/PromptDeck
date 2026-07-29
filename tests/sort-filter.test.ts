import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  filterConversations,
  sortConversations
} from "../src/dashboard/state";
import { record } from "./helpers";

const records = [
  record({ key: "idle", title: "Zulu", automaticStatus: "idle", lastActivityAt: 10 }),
  record({
    key: "error",
    title: "Alpha",
    platform: "claude",
    automaticStatus: "error",
    isUnread: true,
    labelIds: ["urgent"],
    windowIds: [11],
    lastActivityAt: 30
  }),
  record({
    key: "waiting",
    title: "Beta",
    platform: "gemini",
    automaticStatus: "waiting",
    labelIds: ["work", "review"],
    lastActivityAt: 20
  })
];

describe("sorting", () => {
  it("uses requested priority order", () => {
    expect(sortConversations(records, "priority").map((item) => item.key)).toEqual([
      "error",
      "waiting",
      "idle"
    ]);
  });

  it("orders activity both directions", () => {
    expect(sortConversations(records, "recent").map((item) => item.key)).toEqual([
      "error",
      "waiting",
      "idle"
    ]);
    expect(sortConversations(records, "oldest")[0]?.key).toBe("idle");
  });

  it("orders titles deterministically", () => {
    expect(sortConversations(records, "title-asc").map((item) => item.title)).toEqual([
      "Alpha",
      "Beta",
      "Zulu"
    ]);
  });

  it("puts unread first", () => {
    expect(sortConversations(records, "unread")[0]?.key).toBe("error");
  });
});

describe("combined filtering", () => {
  it("combines platform, status, window, label, and unread", () => {
    const result = filterConversations(records, {
      ...EMPTY_FILTERS,
      platforms: ["claude"],
      statuses: ["error"],
      labels: ["urgent"],
      windows: [11],
      unreadOnly: true
    });
    expect(result.map((item) => item.key)).toEqual(["error"]);
  });

  it("requires all selected labels", () => {
    expect(
      filterConversations(records, {
        ...EMPTY_FILTERS,
        labels: ["work", "review"]
      }).map((item) => item.key)
    ).toEqual(["waiting"]);
  });

  it("searches title, platform, and labels", () => {
    expect(filterConversations(records, { ...EMPTY_FILTERS, query: "urgent" })[0]?.key).toBe(
      "error"
    );
  });
});
