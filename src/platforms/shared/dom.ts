import { responseFingerprint } from "../../shared/fingerprint";
import { sanitizePlainText, sanitizeTitle } from "../../shared/text";
import type { MessageSnapshot, Platform } from "../../shared/types";

export function firstElement(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) return element;
    } catch {
      // A single stale selector must not disable the adapter.
    }
  }
  return null;
}

export function allElements(selectors: readonly string[]): HTMLElement[] {
  for (const selector of selectors) {
    try {
      const elements = [...document.querySelectorAll<HTMLElement>(selector)];
      if (elements.length) return elements;
    } catch {
      // Continue through layered fallbacks.
    }
  }
  return [];
}

export function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function visibleElement(selectors: readonly string[]): HTMLElement | null {
  return allElements(selectors).find(isVisible) ?? null;
}

export function titleFromFallbacks(
  platform: Platform,
  selectors: readonly string[],
  userSelectors: readonly string[]
): string {
  const platformName = platform === "chatgpt" ? "ChatGPT" : platform === "claude" ? "Claude" : "Gemini";
  const visibleTitle = firstElement(selectors)?.textContent ?? "";
  const activeSidebar =
    document.querySelector<HTMLElement>('[aria-current="page"]')?.textContent ?? "";
  const firstUser = allElements(userSelectors)[0]?.textContent?.slice(0, 120) ?? "";
  return sanitizeTitle(
    visibleTitle || document.title || activeSidebar || firstUser,
    `Untitled ${platformName} Conversation`
  );
}

export function latestMessage(
  platform: Platform,
  identity: string,
  selectors: readonly string[]
): MessageSnapshot | null {
  const elements = allElements(selectors);
  const element = elements.at(-1);
  const raw = element?.innerText || element?.textContent || "";
  const text = sanitizePlainText(raw, 1200);
  if (!element || !text) return null;
  const order = elements.length - 1;
  const stableId = element.getAttribute("data-message-id") || element.id;
  return {
    text,
    order,
    fingerprint: stableId
      ? `${platform}:${stableId}`
      : responseFingerprint(platform, identity, text, order)
  };
}
