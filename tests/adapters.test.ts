import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ChatGptAdapter } from "../src/platforms/chatgpt/adapter";
import { ClaudeAdapter } from "../src/platforms/claude/adapter";
import { GeminiAdapter } from "../src/platforms/gemini/adapter";

function fixture(path: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures", path), "utf8");
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("platform adapters with sanitized fixtures", () => {
  it("detects ChatGPT generation and visible messages", () => {
    document.body.innerHTML = fixture("chatgpt/generating.html");
    const adapter = new ChatGptAdapter();
    expect(adapter.matchesLocation(new URL("https://chatgpt.com/c/abc"))).toBe(true);
    expect(adapter.isGenerating()).toBe(true);
    expect(adapter.getLatestAssistantMessage()?.text).toContain("preparing");
    expect(adapter.getConversationTitle()).toBe("Release planning");
  });

  it("detects a Claude explicit waiting request", () => {
    document.body.innerHTML = fixture("claude/waiting.html");
    const adapter = new ClaudeAdapter();
    expect(adapter.matchesLocation(new URL("https://claude.ai/chat/abc"))).toBe(true);
    expect(adapter.detectWaitingForUser().waiting).toBe(true);
    expect(adapter.isGenerating()).toBe(false);
  });

  it("detects a Gemini platform error", () => {
    document.body.innerHTML = fixture("gemini/error.html");
    const adapter = new GeminiAdapter();
    expect(adapter.matchesLocation(new URL("https://gemini.google.com/app/abc"))).toBe(true);
    expect(adapter.detectError()?.category).toBe("network");
    expect(adapter.getLatestAssistantMessage()?.text).toContain("summary");
  });
});
