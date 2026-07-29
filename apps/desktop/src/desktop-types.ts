import type { ConnectionState } from "@promptdeck/protocol";
import type { ConversationRecord, Platform, Theme, ViewMode } from "@promptdeck/shared-types";

export type DesktopMode = "full" | "compact";
export type CompactFilter = "attention" | "active" | "all";
export type CompactDensity = "comfortable" | "dense";

export interface DesktopPreferences {
  theme: Theme;
  mode: DesktopMode;
  viewMode: ViewMode;
  alwaysOnTop: boolean;
  compactDensity: CompactDensity;
  compactFilter: CompactFilter;
  platformFilter?: Platform;
  showIdle: boolean;
  showRecent: boolean;
  showLabels: boolean;
  showTimestamps: boolean;
  closeToTray: boolean;
  launchMinimized: boolean;
  launchMode: DesktopMode;
  startWithWindows: boolean;
}

export interface DesktopSnapshot {
  conversations: ConversationRecord[];
  connectionState: ConnectionState;
  lastSyncAt?: number;
  stale: boolean;
  preferences: DesktopPreferences;
}

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  theme: "system",
  mode: "full",
  viewMode: "grid",
  alwaysOnTop: false,
  compactDensity: "comfortable",
  compactFilter: "attention",
  showIdle: true,
  showRecent: true,
  showLabels: true,
  showTimestamps: true,
  closeToTray: true,
  launchMinimized: false,
  launchMode: "full",
  startWithWindows: false
};
