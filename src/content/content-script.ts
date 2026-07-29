import { adapterForLocation } from "../platforms";
import type { ExtensionRequest } from "../messaging/messages";

declare global {
  interface Window {
    __PROMPTDECK_CONTENT_LOADED__?: boolean;
  }
}

if (!window.__PROMPTDECK_CONTENT_LOADED__) {
  window.__PROMPTDECK_CONTENT_LOADED__ = true;

  let timer: number | undefined;
  let lastSignature = "";
  let lastUrl = location.href;

  const emit = async (): Promise<void> => {
    const adapter = adapterForLocation();
    const observation = adapter?.collectObservation();
    if (!observation) return;
    const signature = JSON.stringify([
      observation.canonicalUrl,
      observation.title,
      observation.automaticStatus,
      observation.isVisible,
      observation.latestAssistantFingerprint,
      observation.error?.fingerprint,
      observation.waiting.waiting
    ]);
    if (signature === lastSignature && location.href === lastUrl) return;
    lastSignature = signature;
    lastUrl = location.href;
    try {
      const request: ExtensionRequest = { type: "TAB_OBSERVATION", payload: observation };
      await chrome.runtime.sendMessage(request);
    } catch {
      // Service workers can suspend between observations; the next event will retry.
    }
  };

  const schedule = (delay = 450): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void emit(), delay);
  };

  const observer = new MutationObserver(() => schedule());
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-busy", "aria-label", "data-is-streaming", "data-testid", "hidden"]
  });

  const scheduleViewed = async (): Promise<void> => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
      schedule(50);
      return;
    }
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "GET_VIEW_DELAY"
      } satisfies ExtensionRequest)) as { ok?: boolean; delayMs?: number };
      schedule(response.ok ? response.delayMs ?? 900 : 900);
    } catch {
      schedule(900);
    }
  };
  document.addEventListener("visibilitychange", () => void scheduleViewed());
  window.addEventListener("focus", () => void scheduleViewed());
  window.addEventListener("blur", () => schedule(50));
  window.addEventListener("popstate", () => schedule(50));
  window.addEventListener("hashchange", () => schedule(50));

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      (message as { type?: string }).type === "PROMPTDECK_RESCAN"
    ) {
      lastSignature = "";
      schedule(10);
    }
  });

  const heartbeat = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastSignature = "";
      schedule(50);
    }
  }, 2000);

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      window.clearInterval(heartbeat);
      window.clearTimeout(timer);
    },
    { once: true }
  );
  schedule(100);
}
