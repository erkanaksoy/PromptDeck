import { createEnvelope, validateEnvelope, type AnyProtocolEnvelope, type ProtocolMessageType, type ProtocolPayloads } from "@promptdeck/protocol";
import type { DesktopSnapshot } from "./desktop-types";
import type { DesktopPreferences } from "./desktop-types";
import { simulatedSnapshot } from "./simulator";

type Unlisten = () => void;

export interface DesktopBridge {
  getSnapshot(): Promise<DesktopSnapshot>;
  send<K extends ProtocolMessageType>(type: K, payload: ProtocolPayloads[K]): Promise<void>;
  listen(handler: (message: AnyProtocolEnvelope) => void): Promise<Unlisten>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  setMode(mode: "full" | "compact"): Promise<void>;
  resetWindowPosition(): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  savePreferences(preferences: DesktopPreferences): Promise<void>;
}

function hasTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function createDesktopBridge(): DesktopBridge {
  if (!hasTauri()) {
    return {
      async getSnapshot() {
        return simulatedSnapshot();
      },
      async send() {},
      async listen() {
        return () => undefined;
      },
      async setAlwaysOnTop() {},
      async setMode() {},
      async resetWindowPosition() {},
      async setAutostart() {},
      async savePreferences() {}
    };
  }
  return {
    async getSnapshot() {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<DesktopSnapshot>("get_cached_state");
    },
    async send(type, payload) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("desktop_command", {
        message: createEnvelope(type, "desktop", payload)
      });
    },
    async listen(handler) {
      const { listen } = await import("@tauri-apps/api/event");
      const protocol = await listen<unknown>("protocol-message", ({ payload }) => {
        const result = validateEnvelope(payload);
        if (result.ok) handler(result.message);
      });
      const disconnected = await listen("bridge-disconnected", () => {
        handler(createEnvelope("ERROR_RESPONSE", "native-host", {
          code: "DISCONNECTED",
          message: "Chrome extension disconnected"
        }));
      });
      return () => {
        protocol();
        disconnected();
      };
    },
    async setAlwaysOnTop(enabled) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_always_on_top", { enabled });
    },
    async setMode(mode) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_window_mode", { mode });
    },
    async resetWindowPosition() {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reset_window_position");
    },
    async setAutostart(enabled) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_autostart", { enabled });
    },
    async savePreferences(preferences) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_desktop_preferences", { preferences });
    }
  };
}
