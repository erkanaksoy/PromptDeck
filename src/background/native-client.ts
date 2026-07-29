import {
  createEnvelope,
  MessageLedger,
  NATIVE_HOST_NAME,
  PROTOCOL_VERSION,
  ReconnectBackoff,
  validateEnvelope,
  type AnyProtocolEnvelope,
  type ConnectionState,
  type ProtocolEnvelope,
  type ProtocolMessageType,
  type ProtocolPayloads
} from "../../packages/protocol/src/index";
import type { DashboardState } from "../shared/types";

export interface NativeClientStatus {
  state: ConnectionState;
  lastConnectedAt?: number;
  lastError?: string;
  retryAt?: number;
}

type DesktopCommandHandler = (message: AnyProtocolEnvelope) => Promise<void>;

export class NativeMessagingClient {
  private port?: chrome.runtime.Port;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private enabled = true;
  private intentionalDisconnect = false;
  private readonly backoff = new ReconnectBackoff();
  private readonly received = new MessageLedger();
  private status: NativeClientStatus = { state: "extension_not_connected" };

  public constructor(
    private readonly getSnapshot: () => Promise<DashboardState>,
    private readonly handleDesktopCommand: DesktopCommandHandler
  ) {}

  public start(enabled: boolean): void {
    this.enabled = enabled;
    this.intentionalDisconnect = false;
    if (enabled) this.connect();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.connect();
    else this.disconnect();
  }

  public getStatus(): NativeClientStatus {
    return { ...this.status };
  }

  public send<K extends ProtocolMessageType>(type: K, payload: ProtocolPayloads[K]): boolean {
    if (!this.port) return false;
    try {
      this.port.postMessage(createEnvelope(type, "extension", payload));
      return true;
    } catch {
      this.handleDisconnect("Native host send failed");
      return false;
    }
  }

  public async sendSnapshot(): Promise<void> {
    if (!this.port) return;
    const snapshot = await this.getSnapshot();
    this.send("FULL_STATE_SNAPSHOT", {
      conversations: snapshot.conversations,
      settings: snapshot.settings,
      snapshotAt: Date.now()
    });
  }

  private connect(): void {
    if (!this.enabled || this.port) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.status = { ...this.status, state: this.status.lastConnectedAt ? "reconnecting" : "connecting" };
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      this.port = port;
      port.onMessage.addListener((message: unknown) => void this.onMessage(message));
      port.onDisconnect.addListener(() => {
        const message = chrome.runtime.lastError?.message || "Native host disconnected";
        this.handleDisconnect(message);
      });
      this.backoff.reset();
      this.status = { state: "connected", lastConnectedAt: Date.now() };
      this.send("HELLO_EXTENSION", {
        extensionVersion: chrome.runtime.getManifest().version,
        capabilities: ["snapshot", "incremental", "focus", "labels", "read-state", "manual-override"]
      });
      void this.sendSnapshot();
      this.heartbeatTimer = setInterval(() => this.send("HEARTBEAT", {}), 25_000);
    } catch (error) {
      this.handleDisconnect(error instanceof Error ? error.message : "Native host unavailable");
    }
  }

  private disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.port?.disconnect();
    this.port = undefined;
    this.status = { state: "extension_not_connected" };
  }

  private handleDisconnect(error: string): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.port = undefined;
    if (!this.enabled || this.intentionalDisconnect) return;
    const delay = this.backoff.nextDelay();
    this.status = {
      ...this.status,
      state: error.toLowerCase().includes("host not found") ? "bridge_not_installed" : "reconnecting",
      lastError: error.slice(0, 300),
      retryAt: Date.now() + delay
    };
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private async onMessage(value: unknown): Promise<void> {
    const result = validateEnvelope(value);
    if (!result.ok) {
      if (result.code === "PROTOCOL_MISMATCH") {
        this.status = { ...this.status, state: "protocol_mismatch", lastError: result.error };
        this.send("PROTOCOL_MISMATCH", {
          expected: PROTOCOL_VERSION,
          received: typeof (value as { protocolVersion?: unknown })?.protocolVersion === "number"
            ? (value as { protocolVersion: number }).protocolVersion
            : -1
        });
      }
      return;
    }
    if (!this.received.accept(result.message.messageId)) {
      this.send("ACK", { acknowledgedMessageId: result.message.messageId });
      return;
    }
    if (result.message.type === "REQUEST_FULL_STATE") await this.sendSnapshot();
    else if (result.message.type === "PING") {
      this.send("ACK", { acknowledgedMessageId: result.message.messageId });
    } else {
      await this.handleDesktopCommand(result.message);
    }
  }
}

export function isDesktopCommand(
  message: AnyProtocolEnvelope
): message is ProtocolEnvelope<
  | "FOCUS_CONVERSATION"
  | "OPEN_RECENT_CONVERSATION"
  | "MARK_READ"
  | "MARK_UNREAD"
  | "SET_LABELS"
  | "SET_MANUAL_OVERRIDE"
  | "CLEAR_MANUAL_OVERRIDE"
  | "RESCAN_TABS"
  | "UPDATE_SHARED_SETTINGS"
> {
  return [
    "FOCUS_CONVERSATION",
    "OPEN_RECENT_CONVERSATION",
    "MARK_READ",
    "MARK_UNREAD",
    "SET_LABELS",
    "SET_MANUAL_OVERRIDE",
    "CLEAR_MANUAL_OVERRIDE",
    "RESCAN_TABS",
    "UPDATE_SHARED_SETTINGS"
  ].includes(message.type);
}
