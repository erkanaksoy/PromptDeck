import type { LabelDefinition, Settings } from "./types";

export const SCHEMA_VERSION = 1 as const;
export const RECENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const RECENT_CLEANUP_ALARM = "promptdeck-recent-cleanup";
export const PREVIEW_MAX_LENGTH = 360;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  showMessagePreviews: false,
  persistMessagePreviews: false,
  notifyFinished: true,
  notifyWaiting: true,
  notifyError: true,
  suppressFinishedWhenVisible: true,
  notificationSource: "automatic",
  markViewedDelayMs: 900,
  defaultView: "grid",
  viewMode: "grid",
  sortMode: "priority",
  firstRunComplete: false,
  desktopIntegrationEnabled: true
};

export const LABELS: LabelDefinition[] = [
  { id: "work", name: "Work", color: "#dbeafe", darkColor: "#1e3a5f" },
  { id: "research", name: "Research", color: "#ede9fe", darkColor: "#3b2f67" },
  { id: "coding", name: "Coding", color: "#cffafe", darkColor: "#164e63" },
  { id: "personal", name: "Personal", color: "#fce7f3", darkColor: "#6b2146" },
  { id: "urgent", name: "Urgent", color: "#fee2e2", darkColor: "#6f1d1d" },
  { id: "review", name: "Review", color: "#fef3c7", darkColor: "#634b10" },
  { id: "parked", name: "Parked", color: "#e2e8f0", darkColor: "#334155" },
  { id: "done", name: "Done", color: "#dcfce7", darkColor: "#175c34" }
];

export const PLATFORM_NAMES = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini"
} as const;
