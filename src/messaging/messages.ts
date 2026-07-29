import type {
  DashboardState,
  LabelId,
  Settings,
  TabObservation
} from "../shared/types";

export type ExtensionRequest =
  | { type: "TAB_OBSERVATION"; payload: TabObservation }
  | { type: "GET_DASHBOARD_STATE" }
  | { type: "GET_VIEW_DELAY" }
  | { type: "GET_DESKTOP_STATUS" }
  | { type: "OPEN_DASHBOARD" }
  | { type: "RESCAN_TABS" }
  | { type: "FOCUS_CONVERSATION"; conversationKey: string }
  | { type: "MARK_READ"; conversationKey: string }
  | { type: "MARK_UNREAD"; conversationKey: string }
  | { type: "SET_LABELS"; conversationKey: string; labelIds: LabelId[] }
  | {
      type: "SET_MANUAL_OVERRIDE";
      conversationKey: string;
      value: "waiting" | "idle";
    }
  | { type: "CLEAR_MANUAL_OVERRIDE"; conversationKey: string }
  | { type: "REMOVE_RECENT"; conversationKey: string }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "CLEAR_PREVIEWS" }
  | { type: "CLEAR_RECENT" }
  | { type: "CLEAR_ALL_DATA" }
  | { type: "PROMPTDECK_RESCAN" };

export type ExtensionResponse =
  | {
      ok: true;
      state?: DashboardState;
      count?: number;
      delayMs?: number;
      desktopStatus?: {
        state: string;
        lastConnectedAt?: number;
        lastError?: string;
        retryAt?: number;
      };
    }
  | { ok: false; error: string };
