import { ChatGptAdapter } from "./chatgpt/adapter";
import { ClaudeAdapter } from "./claude/adapter";
import { GeminiAdapter } from "./gemini/adapter";
import type { PlatformAdapter } from "./shared/types";

export function adapterForLocation(url = new URL(location.href)): PlatformAdapter | null {
  const adapters: PlatformAdapter[] = [
    new ChatGptAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter()
  ];
  return adapters.find((adapter) => adapter.matchesLocation(url)) ?? null;
}
