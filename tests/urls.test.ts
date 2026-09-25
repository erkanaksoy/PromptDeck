import { describe, expect, it } from "vitest";
import {
  conversationKeyForTab,
  getConversationId,
  isPromptDeckSidePanelUrl,
  isTabScopedConversationKey,
  normalizeConversationUrl,
  platformForUrl
} from "../src/shared/urls";

describe("URL normalization", () => {
  it("normalizes a ChatGPT conversation", () => {
    expect(normalizeConversationUrl("https://chatgpt.com/c/abc-123?utm_source=test#bottom")).toBe(
      "https://chatgpt.com/c/abc-123"
    );
    expect(getConversationId("chatgpt", "https://chatgpt.com/c/abc-123")).toBe("abc-123");
  });

  it("normalizes a Claude conversation", () => {
    expect(normalizeConversationUrl("https://claude.ai/chat/abc-123?foo=1")).toBe(
      "https://claude.ai/chat/abc-123"
    );
    expect(getConversationId("claude", "https://claude.ai/chat/abc-123")).toBe("abc-123");
  });

  it("normalizes a Gemini conversation and keeps locale only", () => {
    expect(
      normalizeConversationUrl("https://gemini.google.com/app/xyz_1?utm=bad&hl=en#answer")
    ).toBe("https://gemini.google.com/app/xyz_1?hl=en");
    expect(getConversationId("gemini", "https://gemini.google.com/app/xyz_1")).toBe("xyz_1");
  });

  it("rejects unsupported protocols and lookalike hosts", () => {
    expect(normalizeConversationUrl("http://chatgpt.com/c/a")).toBeNull();
    expect(platformForUrl("https://chatgpt.com.evil.example/c/a")).toBeNull();
    expect(normalizeConversationUrl("javascript:alert(1)")).toBeNull();
  });

  it("uses tab-scoped keys until a conversation ID exists", () => {
    const temporary = conversationKeyForTab(
      "gemini",
      "https://gemini.google.com/app",
      null,
      42
    );
    const stable = conversationKeyForTab(
      "gemini",
      "https://gemini.google.com/app/abc",
      "abc",
      42
    );

    expect(temporary).toBe("tab:gemini:42");
    expect(isTabScopedConversationKey(temporary)).toBe(true);
    expect(stable).toBe("gemini:abc");
    expect(isTabScopedConversationKey(stable)).toBe(false);
  });

  it("limits the side panel to New Tab and supported LLM sites", () => {
    expect(isPromptDeckSidePanelUrl("chrome://newtab/")).toBe(true);
    expect(isPromptDeckSidePanelUrl("chrome://new-tab-page/")).toBe(true);
    expect(isPromptDeckSidePanelUrl("chrome-search://local-ntp/local-ntp.html")).toBe(true);
    expect(isPromptDeckSidePanelUrl("https://chatgpt.com/")).toBe(true);
    expect(isPromptDeckSidePanelUrl("https://claude.ai/new")).toBe(true);
    expect(isPromptDeckSidePanelUrl("https://gemini.google.com/app")).toBe(true);
    expect(isPromptDeckSidePanelUrl("https://example.com/")).toBe(false);
    expect(isPromptDeckSidePanelUrl("chrome://settings/")).toBe(false);
    expect(isPromptDeckSidePanelUrl(undefined)).toBe(false);
  });
});
