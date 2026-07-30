import type { Settings } from "./types";

export const SCHEMA_VERSION = 1 as const;
export const RECENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const RECENT_CLEANUP_ALARM = "promptdeck-recent-cleanup";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  notifyFinished: true,
  notifyWaiting: true,
  notifyError: true,
  suppressFinishedWhenVisible: true,
  markViewedDelayMs: 900,
  defaultView: "grid",
  viewMode: "grid",
  sortMode: "priority",
  firstRunComplete: false
};

export const PLATFORM_NAMES = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini"
} as const;
