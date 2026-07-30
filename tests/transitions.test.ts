import { describe, expect, it } from "vitest";
import {
  markRead,
  reduceObservation,
  setManualOverride
} from "../src/background/transitions";
import {
  notificationEventKey,
  recordNotification,
  shouldNotify
} from "../src/background/notification-manager";
import { observation, record } from "./helpers";

const context = {
  tabId: 1,
  windowId: 10,
  isActive: false,
  now: 2000
};

describe("status transition reducer", () => {
  it("moves idle to generating", () => {
    const result = reduceObservation(
      record(),
      observation({ automaticStatus: "generating", isGenerating: true }),
      context
    );
    expect(result.record.automaticStatus).toBe("generating");
    expect(result.record.generationStartedAt).toBe(2000);
  });

  it("moves generating to finished unread off-tab", () => {
    const result = reduceObservation(
      record({ automaticStatus: "generating", latestAssistantFingerprint: "old" }),
      observation(),
      context
    );
    expect(result.record.automaticStatus).toBe("finished_unread");
    expect(result.record.isUnread).toBe(true);
    expect(result.events).toContain("finished");
  });

  it("moves generating to error", () => {
    const result = reduceObservation(
      record({ automaticStatus: "generating" }),
      observation({
        automaticStatus: "error",
        error: {
          category: "network",
          displayMessage: "Network error",
          detectedAt: 2000,
          fingerprint: "error-1"
        }
      }),
      context
    );
    expect(result.record.automaticStatus).toBe("error");
    expect(result.events).toContain("error");
  });

  it("marks unread as read", () => {
    const result = markRead(record({ automaticStatus: "finished_unread", isUnread: true }), 3000);
    expect(result.isUnread).toBe(false);
    expect(result.automaticStatus).toBe("idle");
    expect(result.lastViewedAt).toBe(3000);
  });

  it("sets a response-bound waiting override", () => {
    const result = setManualOverride(record({ latestAssistantFingerprint: "r1" }), "waiting", 3000);
    expect(result.manualStatusOverride).toEqual({
      value: "waiting",
      responseFingerprint: "r1",
      setAt: 3000
    });
  });

  it("clears a response-specific override for a new response", () => {
    const result = reduceObservation(
      record({
        latestAssistantFingerprint: "r1",
        manualStatusOverride: { value: "waiting", responseFingerprint: "r1", setAt: 1000 }
      }),
      observation({ latestAssistantFingerprint: "r2" }),
      context
    );
    expect(result.record.manualStatusOverride).toBeUndefined();
  });

  it("does not duplicate notifications after service-worker restore", () => {
    const current = record({ latestAssistantFingerprint: "r1" });
    const key = notificationEventKey(current, "finished");
    const notified = recordNotification(current, key);
    expect(shouldNotify(notified, key)).toBe(false);
  });
});
