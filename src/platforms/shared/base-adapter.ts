import { lightweightHash } from "../../shared/fingerprint";
import { detectWaitingForUser } from "../../shared/waiting-detector";
import {
  getConversationId,
  normalizeConversationUrl
} from "../../shared/urls";
import type {
  DetectedError,
  MessageSnapshot,
  Platform,
  TabObservation,
  WaitingDetection
} from "../../shared/types";
import { allElements, latestMessage, titleFromFallbacks, visibleElement } from "./dom";
import type { PlatformAdapter } from "./types";

export interface AdapterSelectors {
  assistantMessages: readonly string[];
  userMessages: readonly string[];
  generating: readonly string[];
  errors: readonly string[];
  title: readonly string[];
  choices: readonly string[];
  composer: readonly string[];
}

export abstract class BaseAdapter implements PlatformAdapter {
  abstract readonly platform: Platform;
  protected abstract readonly host: string;
  protected abstract readonly selectors: AdapterSelectors;

  matchesLocation(url: URL): boolean {
    return url.protocol === "https:" && url.hostname === this.host;
  }

  getConversationId(): string | null {
    return getConversationId(this.platform, location.href);
  }

  getConversationUrl(): string | null {
    return normalizeConversationUrl(location.href);
  }

  getConversationTitle(): string {
    return titleFromFallbacks(this.platform, this.selectors.title, this.selectors.userMessages);
  }

  getLatestAssistantMessage(): MessageSnapshot | null {
    return latestMessage(
      this.platform,
      this.getConversationId() || location.pathname,
      this.selectors.assistantMessages
    );
  }

  getLatestUserMessage(): MessageSnapshot | null {
    return latestMessage(
      this.platform,
      this.getConversationId() || location.pathname,
      this.selectors.userMessages
    );
  }

  isGenerating(): boolean {
    return visibleElement(this.selectors.generating) !== null;
  }

  detectError(): DetectedError | null {
    const element = visibleElement(this.selectors.errors);
    if (!element) return null;
    const raw = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    const errorLike =
      /something went wrong|network error|failed|rate limit|try again|server error|disconnected|interrupted|unable to load/i;
    if (!errorLike.test(raw)) return null;
    const lower = raw.toLowerCase();
    const category: DetectedError["category"] = lower.includes("rate")
      ? "rate_limit"
      : lower.includes("network") || lower.includes("disconnect")
        ? "network"
        : lower.includes("server")
          ? "server"
          : lower.includes("interrupt")
            ? "interrupted"
            : lower.includes("load")
              ? "load"
              : "unknown";
    return {
      category,
      displayMessage: raw.slice(0, 140) || "The platform reported an error.",
      detectedAt: Date.now(),
      fingerprint: `${this.platform}:error:${lightweightHash(raw)}`
    };
  }

  hasRenderedChoices(): boolean {
    return allElements(this.selectors.choices).some((element) => {
      const text = (element.textContent || "").trim();
      return text.length > 0 && text.length < 100;
    });
  }

  detectWaitingForUser(): WaitingDetection {
    const message = this.getLatestAssistantMessage();
    return message
      ? detectWaitingForUser(message.text, this.hasRenderedChoices())
      : { waiting: false, confidence: "low", reasons: [] };
  }

  detectionAvailable(): boolean {
    return (
      allElements(this.selectors.assistantMessages).length > 0 ||
      visibleElement(this.selectors.composer) !== null ||
      this.isGenerating()
    );
  }

  collectObservation(): TabObservation | null {
    const canonicalUrl = this.getConversationUrl();
    if (!canonicalUrl) return null;
    const assistant = this.getLatestAssistantMessage();
    const error = this.detectError();
    const isGenerating = this.isGenerating();
    const waiting = isGenerating ? { waiting: false, confidence: "low" as const, reasons: [] } : this.detectWaitingForUser();
    const available = this.detectionAvailable();
    return {
      platform: this.platform,
      ...(this.getConversationId() ? { conversationId: this.getConversationId()! } : {}),
      canonicalUrl,
      title: this.getConversationTitle(),
      automaticStatus: error
        ? "error"
        : isGenerating
          ? "generating"
          : waiting.waiting
            ? "waiting"
            : available
              ? "idle"
              : "unknown",
      isGenerating,
      isVisible: document.visibilityState === "visible" && document.hasFocus(),
      ...(assistant
        ? {
            latestAssistantFingerprint: assistant.fingerprint
          }
        : {}),
      waiting,
      ...(error ? { error } : {}),
      observedAt: Date.now(),
      detectionAvailable: available,
      ...(!available ? { detectionMessage: "Detection unavailable for this page state." } : {})
    };
  }
}
