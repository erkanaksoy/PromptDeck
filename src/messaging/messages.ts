import type {
  DashboardState,
  Settings,
  TabObservation
} from "../shared/types";

export type ExtensionRequest =
  | { type: "TAB_OBSERVATION"; payload: TabObservation }
  | { type: "GET_DASHBOARD_STATE" }
  | { type: "GET_VIEW_DELAY" }
  | { type: "OPEN_DASHBOARD" }
  | { type: "RESCAN_TABS" }
  | { type: "FOCUS_TAB"; tabId: number }
  | { type: "FOCUS_CONVERSATION"; conversationKey: string }
  | { type: "MARK_READ"; conversationKey: string }
  | { type: "MARK_UNREAD"; conversationKey: string }
  | {
      type: "SET_MANUAL_OVERRIDE";
      conversationKey: string;
      value: "waiting" | "idle";
    }
  | { type: "CLEAR_MANUAL_OVERRIDE"; conversationKey: string }
  | { type: "REMOVE_RECENT"; conversationKey: string }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "CLEAR_RECENT" }
  | { type: "CLEAR_ALL_DATA" }
  | { type: "PROMPTDECK_RESCAN" };

export type ExtensionResponse =
  | {
      ok: true;
      state?: DashboardState;
      count?: number;
      delayMs?: number;
    }
  | { ok: false; error: string };
