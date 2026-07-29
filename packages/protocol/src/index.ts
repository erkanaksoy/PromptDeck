import type {
  ConversationRecord,
  LabelId,
  ManualStatusOverride,
  SharedFieldMetadata,
  Settings
} from "@promptdeck/shared-types";

export const PROTOCOL_VERSION = 1 as const;
export const NATIVE_HOST_NAME = "com.promptdeck.desktop" as const;
export const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;
export type ProtocolSource = "extension" | "desktop" | "native-host";
export type ConnectionState =
  | "connected"
  | "connecting"
  | "extension_not_connected"
  | "bridge_not_installed"
  | "protocol_mismatch"
  | "error"
  | "reconnecting";

export type ProtocolPayloads = {
  HELLO_EXTENSION: { extensionVersion: string; capabilities: string[] };
  HELLO_DESKTOP: { desktopVersion: string; capabilities: string[] };
  FULL_STATE_SNAPSHOT: { conversations: ConversationRecord[]; settings: Partial<Settings>; snapshotAt: number };
  CONVERSATION_UPSERT: { conversation: ConversationRecord };
  CONVERSATION_REMOVE: { conversationKey: string; removedAt: number };
  TAB_STATE_UPDATE: { conversationKey: string; openTabIds: number[]; windowIds: number[]; updatedAt: number };
  SETTINGS_UPDATE: { patch: Partial<Settings>; mutationId?: string };
  LABELS_UPDATE: { conversationKey: string; labelIds: LabelId[]; updatedAt: number; mutationId: string };
  READ_STATE_UPDATE: { conversationKey: string; isUnread: boolean; updatedAt: number; mutationId: string };
  RECENT_CLEANUP: { before: number };
  HEARTBEAT: { uptimeMs?: number };
  RESCAN_COMPLETE: { count: number };
  REQUEST_FULL_STATE: Record<string, never>;
  FOCUS_CONVERSATION: { conversationKey: string };
  OPEN_RECENT_CONVERSATION: { conversationKey: string };
  MARK_READ: { conversationKey: string; updatedAt: number; mutationId: string };
  MARK_UNREAD: { conversationKey: string; updatedAt: number; mutationId: string };
  SET_LABELS: { conversationKey: string; labelIds: LabelId[]; updatedAt: number; mutationId: string };
  SET_MANUAL_OVERRIDE: { conversationKey: string; override: ManualStatusOverride; updatedAt: number; mutationId: string };
  CLEAR_MANUAL_OVERRIDE: { conversationKey: string; updatedAt: number; mutationId: string };
  RESCAN_TABS: Record<string, never>;
  UPDATE_SHARED_SETTINGS: { patch: Partial<Settings>; updatedAt: number; mutationId: string };
  PING: { nonce: string };
  ACK: { acknowledgedMessageId: string };
  ERROR_RESPONSE: { code: string; message: string; relatedMessageId?: string };
  FOCUS_RESULT: { conversationKey: string; success: boolean; reason?: string };
  RESCAN_RESULT: { count: number; success: boolean };
  STATE_APPLIED: { appliedMessageId: string; mutationId?: string };
  PROTOCOL_MISMATCH: { expected: number; received: number };
};

export type ProtocolMessageType = keyof ProtocolPayloads;
export type ProtocolEnvelope<K extends ProtocolMessageType = ProtocolMessageType> = {
  [T in K]: {
    protocolVersion: typeof PROTOCOL_VERSION;
    messageId: string;
    sentAt: number;
    source: ProtocolSource;
    type: T;
    payload: ProtocolPayloads[T];
  }
}[K];
export type AnyProtocolEnvelope = ProtocolEnvelope<ProtocolMessageType>;

const MESSAGE_TYPES = new Set<ProtocolMessageType>([
  "HELLO_EXTENSION", "HELLO_DESKTOP", "FULL_STATE_SNAPSHOT", "CONVERSATION_UPSERT",
  "CONVERSATION_REMOVE", "TAB_STATE_UPDATE", "SETTINGS_UPDATE", "LABELS_UPDATE",
  "READ_STATE_UPDATE", "RECENT_CLEANUP", "HEARTBEAT", "RESCAN_COMPLETE",
  "REQUEST_FULL_STATE", "FOCUS_CONVERSATION", "OPEN_RECENT_CONVERSATION", "MARK_READ",
  "MARK_UNREAD", "SET_LABELS", "SET_MANUAL_OVERRIDE", "CLEAR_MANUAL_OVERRIDE",
  "RESCAN_TABS", "UPDATE_SHARED_SETTINGS", "PING", "ACK", "ERROR_RESPONSE",
  "FOCUS_RESULT", "RESCAN_RESULT", "STATE_APPLIED", "PROTOCOL_MISMATCH"
]);
const SOURCES = new Set<ProtocolSource>(["extension", "desktop", "native-host"]);
const EXTENSION_ID = /^[a-p]{32}$/;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidExtensionId(value: string): boolean {
  return EXTENSION_ID.test(value);
}

export function isSupportedConversationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["chatgpt.com", "claude.ai", "gemini.google.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function createEnvelope<K extends ProtocolMessageType>(
  type: K,
  source: ProtocolSource,
  payload: ProtocolPayloads[K],
  now = Date.now(),
  messageId = crypto.randomUUID()
): ProtocolEnvelope<K> {
  return { protocolVersion: PROTOCOL_VERSION, messageId, sentAt: now, source, type, payload } as ProtocolEnvelope<K>;
}

export type ValidationResult =
  | { ok: true; message: AnyProtocolEnvelope }
  | { ok: false; code: "INVALID_SHAPE" | "PROTOCOL_MISMATCH" | "UNKNOWN_TYPE" | "INVALID_PAYLOAD"; error: string };

export function validateEnvelope(value: unknown, now = Date.now()): ValidationResult {
  if (!isRecord(value)) return { ok: false, code: "INVALID_SHAPE", error: "Envelope must be an object" };
  if (value.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, code: "PROTOCOL_MISMATCH", error: `Expected protocol ${PROTOCOL_VERSION}` };
  }
  if (
    typeof value.messageId !== "string" ||
    value.messageId.length < 1 ||
    value.messageId.length > 128 ||
    typeof value.sentAt !== "number" ||
    Math.abs(now - value.sentAt) > MAX_CLOCK_SKEW_MS ||
    !SOURCES.has(value.source as ProtocolSource) ||
    typeof value.type !== "string"
  ) {
    return { ok: false, code: "INVALID_SHAPE", error: "Invalid envelope metadata" };
  }
  if (!MESSAGE_TYPES.has(value.type as ProtocolMessageType)) {
    return { ok: false, code: "UNKNOWN_TYPE", error: "Unknown message type" };
  }
  if (!isRecord(value.payload)) return { ok: false, code: "INVALID_PAYLOAD", error: "Payload must be an object" };
  const payload = value.payload;
  if (
    ["FOCUS_CONVERSATION", "OPEN_RECENT_CONVERSATION", "MARK_READ", "MARK_UNREAD", "SET_LABELS",
      "SET_MANUAL_OVERRIDE", "CLEAR_MANUAL_OVERRIDE", "CONVERSATION_REMOVE", "TAB_STATE_UPDATE",
      "LABELS_UPDATE", "READ_STATE_UPDATE"].includes(value.type) &&
    (typeof payload.conversationKey !== "string" || payload.conversationKey.length > 512)
  ) {
    return { ok: false, code: "INVALID_PAYLOAD", error: "Invalid conversation key" };
  }
  if (value.type === "CONVERSATION_UPSERT") {
    if (!isRecord(payload.conversation) || typeof payload.conversation.canonicalUrl !== "string" ||
        !isSupportedConversationUrl(payload.conversation.canonicalUrl)) {
      return { ok: false, code: "INVALID_PAYLOAD", error: "Invalid conversation" };
    }
  }
  if (value.type === "FULL_STATE_SNAPSHOT") {
    if (!Array.isArray(payload.conversations) || payload.conversations.length > 10000 ||
        payload.conversations.some((item) => !isRecord(item) || typeof item.canonicalUrl !== "string" ||
          !isSupportedConversationUrl(item.canonicalUrl))) {
      return { ok: false, code: "INVALID_PAYLOAD", error: "Invalid snapshot" };
    }
  }
  return { ok: true, message: value as AnyProtocolEnvelope };
}

export function parseEnvelopeJson(json: string): ValidationResult {
  if (new TextEncoder().encode(json).byteLength > MAX_NATIVE_MESSAGE_BYTES) {
    return { ok: false, code: "INVALID_PAYLOAD", error: "Message is too large" };
  }
  try {
    return validateEnvelope(JSON.parse(json));
  } catch {
    return { ok: false, code: "INVALID_SHAPE", error: "Invalid JSON" };
  }
}

export function reconcileSnapshot(
  current: ReadonlyMap<string, ConversationRecord>,
  incoming: readonly ConversationRecord[]
): Map<string, ConversationRecord> {
  const next = new Map<string, ConversationRecord>();
  for (const conversation of incoming) {
    const existing = current.get(conversation.key);
    if (!existing) {
      next.set(conversation.key, conversation);
      continue;
    }
    next.set(conversation.key, mergeConversation(existing, conversation));
  }
  for (const [key, existing] of current) {
    if (!next.has(key) && existing.closedAt) next.set(key, existing);
  }
  return next;
}

export function applyUpsert(
  current: ReadonlyMap<string, ConversationRecord>,
  conversation: ConversationRecord
): Map<string, ConversationRecord> {
  const next = new Map(current);
  const existing = next.get(conversation.key);
  next.set(conversation.key, existing ? mergeConversation(existing, conversation) : conversation);
  return next;
}

function metadataWins(
  existing: SharedFieldMetadata | undefined,
  incoming: SharedFieldMetadata | undefined
): boolean {
  if (!existing) return true;
  if (!incoming) return false;
  if (incoming.updatedAt !== existing.updatedAt) return incoming.updatedAt > existing.updatedAt;
  if (incoming.source !== existing.source) return incoming.source > existing.source;
  return incoming.mutationId >= existing.mutationId;
}

export function mergeConversation(
  existing: ConversationRecord,
  incoming: ConversationRecord
): ConversationRecord {
  const merged: ConversationRecord = {
    ...existing,
    ...incoming,
    sharedFields: { ...existing.sharedFields, ...incoming.sharedFields }
  };
  if (!metadataWins(existing.sharedFields?.labels, incoming.sharedFields?.labels)) {
    merged.labelIds = existing.labelIds;
    if (merged.sharedFields) merged.sharedFields.labels = existing.sharedFields?.labels;
  }
  if (!metadataWins(existing.sharedFields?.readState, incoming.sharedFields?.readState)) {
    merged.isUnread = existing.isUnread;
    if (merged.sharedFields) merged.sharedFields.readState = existing.sharedFields?.readState;
  }
  if (!metadataWins(existing.sharedFields?.manualOverride, incoming.sharedFields?.manualOverride)) {
    merged.manualStatusOverride = existing.manualStatusOverride;
    if (merged.sharedFields) merged.sharedFields.manualOverride = existing.sharedFields?.manualOverride;
  }
  return merged;
}

export interface NativeHostManifest {
  name: typeof NATIVE_HOST_NAME;
  description: string;
  path: string;
  type: "stdio";
  allowed_origins: [string];
}

export function createNativeHostManifest(path: string, extensionId: string): NativeHostManifest {
  if (!/^(?:[A-Za-z]:\\|\\\\)/.test(path)) throw new Error("Native host path must be absolute");
  if (!isValidExtensionId(extensionId)) throw new Error("Invalid Chrome extension ID");
  return {
    name: NATIVE_HOST_NAME,
    description: "PromptDeck desktop communication bridge",
    path,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };
}

export const NATIVE_HOST_REGISTRY_PATH =
  `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}` as const;

export function frameNativeMessage(value: unknown): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(value));
  if (!body.length || body.length > MAX_NATIVE_MESSAGE_BYTES) throw new Error("Invalid message length");
  const framed = new Uint8Array(body.length + 4);
  new DataView(framed.buffer).setUint32(0, body.length, true);
  framed.set(body, 4);
  return framed;
}

export class NativeFrameDecoder {
  private buffered = new Uint8Array();
  public push(chunk: Uint8Array): unknown[] {
    const combined = new Uint8Array(this.buffered.length + chunk.length);
    combined.set(this.buffered);
    combined.set(chunk, this.buffered.length);
    this.buffered = combined;
    const output: unknown[] = [];
    while (this.buffered.length >= 4) {
      const length = new DataView(this.buffered.buffer, this.buffered.byteOffset, 4).getUint32(0, true);
      if (!length || length > MAX_NATIVE_MESSAGE_BYTES) throw new Error("Invalid message length");
      if (this.buffered.length < length + 4) break;
      const body = this.buffered.slice(4, length + 4);
      try {
        output.push(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
      } catch {
        throw new Error("Invalid native message JSON");
      }
      this.buffered = this.buffered.slice(length + 4);
    }
    return output;
  }
}

export class MessageLedger {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];
  public constructor(private readonly capacity = 1000) {}
  public accept(messageId: string): boolean {
    if (this.seen.has(messageId)) return false;
    this.seen.add(messageId);
    this.order.push(messageId);
    while (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }
}

export class ReconnectBackoff {
  private attempt = 0;
  public constructor(
    private readonly minimumMs = 1000,
    private readonly maximumMs = 60000,
    private readonly random = Math.random
  ) {}
  public nextDelay(): number {
    const base = Math.min(this.maximumMs, this.minimumMs * 2 ** this.attempt++);
    return Math.round(base * (0.8 + this.random() * 0.4));
  }
  public reset(): void {
    this.attempt = 0;
  }
}
