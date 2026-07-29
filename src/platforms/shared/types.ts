import type {
  DetectedError,
  MessageSnapshot,
  Platform,
  TabObservation,
  WaitingDetection
} from "../../shared/types";

export interface PlatformAdapter {
  readonly platform: Platform;
  matchesLocation(url: URL): boolean;
  getConversationId(): string | null;
  getConversationUrl(): string | null;
  getConversationTitle(): string;
  getLatestAssistantMessage(): MessageSnapshot | null;
  getLatestUserMessage(): MessageSnapshot | null;
  isGenerating(): boolean;
  detectError(): DetectedError | null;
  detectWaitingForUser(): WaitingDetection;
  hasRenderedChoices(): boolean;
  detectionAvailable(): boolean;
  collectObservation(): TabObservation | null;
}
