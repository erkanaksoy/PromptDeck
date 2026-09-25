import { describe, expect, it } from "vitest";
import { isExtensionRequest } from "../src/messaging/validators";

describe("extension request validation", () => {
  it("accepts a valid tab focus request", () => {
    expect(isExtensionRequest({ type: "FOCUS_TAB", tabId: 42 })).toBe(true);
  });

  it("rejects invalid tab identifiers", () => {
    expect(isExtensionRequest({ type: "FOCUS_TAB", tabId: -1 })).toBe(false);
    expect(isExtensionRequest({ type: "FOCUS_TAB", tabId: 4.2 })).toBe(false);
    expect(isExtensionRequest({ type: "FOCUS_TAB", tabId: "42" })).toBe(false);
  });
});
