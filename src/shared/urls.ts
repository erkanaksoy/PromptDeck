import type { Platform } from "./types";

const SUPPORTED_HOSTS: Record<Platform, string> = {
  chatgpt: "chatgpt.com",
  claude: "claude.ai",
  gemini: "gemini.google.com"
};

export function platformForUrl(raw: string): Platform | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const entry = Object.entries(SUPPORTED_HOSTS).find(([, host]) => url.hostname === host);
    return (entry?.[0] as Platform | undefined) ?? null;
  } catch {
    return null;
  }
}

function retainGeminiParams(url: URL): void {
  const allowed = new Set(["hl"]);
  for (const key of [...url.searchParams.keys()]) {
    if (!allowed.has(key)) url.searchParams.delete(key);
  }
}

export function normalizeConversationUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const platform = platformForUrl(raw);
    if (!platform) return null;
    url.hash = "";
    url.hostname = SUPPORTED_HOSTS[platform];
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    if (platform === "gemini") retainGeminiParams(url);
    else url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function getConversationId(platform: Platform, raw: string): string | null {
  const normalized = normalizeConversationUrl(raw);
  if (!normalized) return null;
  const { pathname } = new URL(normalized);
  const patterns: Record<Platform, RegExp[]> = {
    chatgpt: [/\/c\/([a-zA-Z0-9-]+)/, /\/g\/[^/]+\/c\/([a-zA-Z0-9-]+)/],
    claude: [/\/chat\/([a-zA-Z0-9-]+)/],
    gemini: [/\/app\/([a-zA-Z0-9_-]+)/]
  };
  for (const pattern of patterns[platform]) {
    const match = pathname.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function conversationKey(platform: Platform, raw: string, id?: string | null): string {
  const normalized = normalizeConversationUrl(raw);
  if (!normalized) throw new Error("Unsupported conversation URL");
  return `${platform}:${id || normalized}`;
}

export function conversationKeyForTab(
  platform: Platform,
  raw: string,
  id: string | null | undefined,
  tabId: number
): string {
  return id ? conversationKey(platform, raw, id) : `tab:${platform}:${tabId}`;
}

export function isTabScopedConversationKey(key: string): boolean {
  return key.startsWith("tab:");
}

export function isSafeConversationUrl(raw: string): boolean {
  return normalizeConversationUrl(raw) !== null;
}
