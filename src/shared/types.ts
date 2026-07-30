export type Platform = "chatgpt" | "claude" | "gemini";
export type AutomaticStatus =
  | "generating"
  | "finished_unread"
  | "waiting"
  | "error"
  | "idle"
  | "unknown";
export type DisplayStatus = AutomaticStatus | "recent";
export type Confidence = "high" | "medium" | "low";
export type LabelId =
  | "work"
  | "research"
  | "coding"
  | "personal"
  | "urgent"
  | "review"
  | "parked"
  | "done";
export type Theme = "light" | "dark" | "system";
export type ViewMode = "grid" | "kanban";
export type SortMode =
  | "priority"
  | "status"
  | "unread"
  | "recent"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "platform"
  | "window"
  | "label"
  | "recently-closed";

export interface DetectedError {
  category: "network" | "rate_limit" | "server" | "interrupted" | "load" | "unknown";
  displayMessage: string;
  detectedAt: number;
  fingerprint: string;
}

export interface WaitingDetection {
  waiting: boolean;
  confidence: Confidence;
  reasons: string[];
}

export interface MessageSnapshot {
  text: string;
  order: number;
  fingerprint: string;
}

export interface ManualStatusOverride {
  value: "waiting" | "idle";
  responseFingerprint?: string;
  setAt: number;
}

export interface ConversationRecord {
  key: string;
  platform: Platform;
  conversationId?: string;
  canonicalUrl: string;
  title: string;
  openTabIds: number[];
  primaryTabId?: number;
  windowIds: number[];
  automaticStatus: AutomaticStatus;
  isUnread: boolean;
  waitingConfidence?: Confidence;
  waitingReasons?: string[];
  manualStatusOverride?: ManualStatusOverride;
  labelIds: LabelId[];
  latestAssistantFingerprint?: string;
  latestAssistantPreview?: string;
  previewStored: boolean;
  lastActivityAt: number;
  lastObservedAt: number;
  generationStartedAt?: number;
  generationFinishedAt?: number;
  lastViewedAt?: number;
  error?: DetectedError;
  closedAt?: number;
  recentExpiresAt?: number;
  lastNotifiedEvents: string[];
  detectionAvailable: boolean;
  detectionMessage?: string;
  schemaVersion: 1;
}

export interface TabObservation {
  platform: Platform;
  conversationId?: string;
  canonicalUrl: string;
  title: string;
  automaticStatus: Exclude<AutomaticStatus, "finished_unread">;
  isGenerating: boolean;
  isVisible: boolean;
  latestAssistantFingerprint?: string;
  latestAssistantPreview?: string;
  waiting: WaitingDetection;
  error?: DetectedError;
  observedAt: number;
  detectionAvailable: boolean;
  detectionMessage?: string;
}

export interface Settings {
  theme: Theme;
  showMessagePreviews: boolean;
  persistMessagePreviews: boolean;
  notifyFinished: boolean;
  notifyWaiting: boolean;
  notifyError: boolean;
  suppressFinishedWhenVisible: boolean;
  markViewedDelayMs: number;
  defaultView: ViewMode;
  viewMode: ViewMode;
  sortMode: SortMode;
  firstRunComplete: boolean;
}

export interface StoredState {
  schemaVersion: 1;
  conversations: Record<string, ConversationRecord>;
  settings: Settings;
  windowLabels: Record<string, number>;
  nextWindowLabel: number;
  migrationError?: string;
}

export interface DashboardState {
  conversations: ConversationRecord[];
  settings: Settings;
  windowLabels: Record<string, number>;
  storageError?: string;
}

export interface Filters {
  query: string;
  platforms: Platform[];
  statuses: DisplayStatus[];
  labels: LabelId[];
  windows: number[];
  unreadOnly: boolean;
  activeOnly: boolean;
  recentOnly: boolean;
}

export interface LabelDefinition {
  id: LabelId;
  name: string;
  color: string;
  darkColor: string;
}
