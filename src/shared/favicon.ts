import type { Platform } from "./types";

const PLATFORM_HOME: Record<Platform, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/"
};

export function providerFaviconUrl(platform: Platform, size = 32): string {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", PLATFORM_HOME[platform]);
  url.searchParams.set("size", String(size));
  return url.toString();
}
