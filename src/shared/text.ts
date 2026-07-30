const DEFAULT_TEXT_LIMIT = 360;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizePlainText(value: string, maxLength = DEFAULT_TEXT_LIMIT): string {
  const withoutCode = value
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/`[^`\n]+`/g, " [code] ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return normalizeWhitespace(withoutCode).slice(0, maxLength);
}

export function sanitizeTitle(value: string, fallback: string): string {
  const title = normalizeWhitespace(value)
    .replace(/\s*[|–—-]\s*(ChatGPT|Claude|Gemini)\s*$/i, "")
    .slice(0, 160);
  return title || fallback;
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
