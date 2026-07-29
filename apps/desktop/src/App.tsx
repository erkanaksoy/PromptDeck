import { useEffect, useMemo, useState } from "react";
import {
  applyUpsert,
  reconcileSnapshot,
  type ConnectionState
} from "@promptdeck/protocol";
import { displayStatus, filterConversations, sortConversations } from "@promptdeck/status-engine";
import type {
  ConversationRecord,
  DisplayStatus,
  Filters,
  LabelId,
  Platform,
  Theme
} from "@promptdeck/shared-types";
import { createDesktopBridge } from "./bridge";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  type CompactFilter,
  type DesktopMode,
  type DesktopPreferences
} from "./desktop-types";
import { simulatedSnapshot } from "./simulator";

const bridge = createDesktopBridge();
const LABELS: Array<{ id: LabelId; name: string }> = [
  { id: "work", name: "Work" }, { id: "research", name: "Research" },
  { id: "coding", name: "Coding" }, { id: "personal", name: "Personal" },
  { id: "urgent", name: "Urgent" }, { id: "review", name: "Review" },
  { id: "parked", name: "Parked" }, { id: "done", name: "Done" }
];
const PLATFORM_NAMES: Record<Platform, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini"
};
const STATUS: Record<DisplayStatus, { name: string; icon: string }> = {
  error: { name: "Error", icon: "!" },
  waiting: { name: "Waiting", icon: "?" },
  finished_unread: { name: "Finished / Unread", icon: "✓" },
  generating: { name: "Generating", icon: "↻" },
  idle: { name: "Idle", icon: "•" },
  unknown: { name: "Unknown", icon: "…" },
  recent: { name: "Recent", icon: "◷" }
};
const EMPTY_FILTERS: Filters = {
  query: "", platforms: [], statuses: [], labels: [], windows: [],
  unreadOnly: false, activeOnly: false, recentOnly: false
};

function relativeTime(value: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusText(state: ConnectionState): string {
  return {
    connected: "Connected", connecting: "Connecting",
    extension_not_connected: "Extension not connected",
    bridge_not_installed: "Desktop bridge not installed",
    protocol_mismatch: "Protocol mismatch", error: "Connection error",
    reconnecting: "Reconnecting"
  }[state];
}

function ConversationCard({
  conversation,
  preferences,
  compact,
  canFocus,
  onCommand
}: {
  conversation: ConversationRecord;
  preferences: DesktopPreferences;
  compact: boolean;
  canFocus: boolean;
  onCommand: (type: string, conversation: ConversationRecord) => void;
}) {
  const status = displayStatus(conversation);
  return (
    <article className={`conversation-card card-${status} ${compact ? "compact-card" : ""}`}>
      <div className="card-topline">
        <span className={`platform platform-${conversation.platform}`}>
          {PLATFORM_NAMES[conversation.platform]}
        </span>
        <span className={`status status-${status}`}>
          <span aria-hidden="true">{STATUS[status].icon}</span> {STATUS[status].name}
        </span>
      </div>
      <h3>{conversation.title}</h3>
      {!compact && conversation.error ? <p className="error-detail">{conversation.error.displayMessage}</p> : null}
      <div className="card-meta">
        {conversation.isUnread ? <span className="unread">Unread</span> : null}
        {preferences.showTimestamps ? <time>{relativeTime(conversation.lastActivityAt)}</time> : null}
        {conversation.windowIds[0] ? <span>Window {conversation.windowIds[0]}</span> : null}
      </div>
      {preferences.showLabels && conversation.labelIds.length ? (
        <div className="label-row">
          {conversation.labelIds.map((id) => <span className={`label label-${id}`} key={id}>{LABELS.find((label) => label.id === id)?.name}</span>)}
        </div>
      ) : null}
      <div className="card-actions">
        <button className="primary" disabled={!canFocus && conversation.openTabIds.length > 0} onClick={() => onCommand("focus", conversation)}>
          {conversation.openTabIds.length ? "Focus" : "Open"}
        </button>
        {!compact ? (
          <>
            <button onClick={() => onCommand(conversation.isUnread ? "read" : "unread", conversation)}>
              Mark {conversation.isUnread ? "read" : "unread"}
            </button>
            <button onClick={() => onCommand("labels", conversation)}>Labels</button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function SettingsDialog({
  preferences,
  connection,
  lastSyncAt,
  onChange,
  onClose,
  onResetPosition
}: {
  preferences: DesktopPreferences;
  connection: ConnectionState;
  lastSyncAt?: number;
  onChange: (patch: Partial<DesktopPreferences>) => void;
  onClose: () => void;
  onResetPosition: () => void;
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  const toggle = (key: keyof DesktopPreferences, label: string) => (
    <label className="setting-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={Boolean(preferences[key])}
        onChange={(event) => onChange({ [key]: event.target.checked })}
      />
    </label>
  );
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><span className="eyebrow">Preferences</span><h2 id="settings-title">Desktop settings</h2></div><button aria-label="Close settings" onClick={onClose}>×</button></header>
        <div className="settings-grid">
          <fieldset><legend>Appearance</legend>
            <label>Theme<select value={preferences.theme} onChange={(event) => onChange({ theme: event.target.value as Theme })}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
            <label>Compact density<select value={preferences.compactDensity} onChange={(event) => onChange({ compactDensity: event.target.value as "comfortable" | "dense" })}><option value="comfortable">Comfortable</option><option value="dense">Dense</option></select></label>
            {toggle("showLabels", "Show labels")}{toggle("showTimestamps", "Show timestamps")}
            {toggle("showIdle", "Show Idle")}{toggle("showRecent", "Show Recent")}
          </fieldset>
          <fieldset><legend>Window</legend>
            {toggle("alwaysOnTop", "Always on top")}{toggle("closeToTray", "Close to tray")}
            <label>Launch mode<select value={preferences.launchMode} onChange={(event) => onChange({ launchMode: event.target.value as DesktopMode })}><option value="full">Full dashboard</option><option value="compact">Compact panel</option></select></label>
            <button onClick={onResetPosition}>Reset window position</button>
          </fieldset>
          <fieldset><legend>Startup</legend>
            {toggle("startWithWindows", "Start with Windows")}
            {toggle("launchMinimized", "Launch minimized to tray")}
          </fieldset>
          <fieldset><legend>Connection diagnostics</legend>
            <dl><div><dt>Status</dt><dd>{statusText(connection)}</dd></div><div><dt>Protocol</dt><dd>1</dd></div><div><dt>Native host</dt><dd>com.promptdeck.desktop</dd></div><div><dt>Last sync</dt><dd>{lastSyncAt ? relativeTime(lastSyncAt) : "Never"}</dd></div></dl>
            <button onClick={() => void bridge.send("REQUEST_FULL_STATE", {})}>Resync now</button>
          </fieldset>
          <fieldset><legend>Privacy</legend><p>All data remains on this Windows user account. Previews are off by default. No telemetry, login, cloud API, cookies, or browser profile databases are used.</p></fieldset>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [conversations, setConversations] = useState<Map<string, ConversationRecord>>(new Map());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number>();
  const [stale, setStale] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_DESKTOP_PREFERENCES);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelTarget, setLabelTarget] = useState<ConversationRecord>();

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const handleMessage = (message: Parameters<Parameters<typeof bridge.listen>[0]>[0]) => {
      if (disposed) return;
      if (message.type === "FULL_STATE_SNAPSHOT") {
        setConversations((current) => reconcileSnapshot(current, message.payload.conversations));
        setConnection("connected"); setStale(false); setLastSyncAt(Date.now());
      } else if (message.type === "CONVERSATION_UPSERT") {
        setConversations((current) => applyUpsert(current, message.payload.conversation));
        setLastSyncAt(Date.now());
      } else if (message.type === "CONVERSATION_REMOVE") {
        setConversations((current) => { const next = new Map(current); next.delete(message.payload.conversationKey); return next; });
      } else if (message.type === "HELLO_EXTENSION" || message.type === "HEARTBEAT") {
        setConnection("connected"); setStale(false);
      } else if (message.type === "PROTOCOL_MISMATCH") setConnection("protocol_mismatch");
      else if (message.type === "ERROR_RESPONSE" && message.payload.code === "DISCONNECTED") {
        setConnection("extension_not_connected"); setStale(true);
      }
    };
    void (async () => {
      unlisten = await bridge.listen(handleMessage);
      const snapshot = await bridge.getSnapshot();
      if (disposed) {
        unlisten();
        return;
      }
      setConversations((current) => reconcileSnapshot(current, snapshot.conversations));
      setConnection(snapshot.connectionState);
      setLastSyncAt(snapshot.lastSyncAt);
      setStale(snapshot.stale);
      setPreferences({ ...DEFAULT_DESKTOP_PREFERENCES, ...snapshot.preferences });
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    const setMode = (event: Event) => {
      const mode = (event as CustomEvent<DesktopMode>).detail;
      if (mode === "full" || mode === "compact") updatePreferences({ mode });
    };
    window.addEventListener("promptdeck-open-settings", open);
    window.addEventListener("promptdeck-set-mode", setMode);
    return () => {
      window.removeEventListener("promptdeck-open-settings", open);
      window.removeEventListener("promptdeck-set-mode", setMode);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    localStorage.setItem("promptdeck-desktop-preferences", JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (patch: Partial<DesktopPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      if (patch.alwaysOnTop !== undefined) void bridge.setAlwaysOnTop(patch.alwaysOnTop);
      if (patch.mode) void bridge.setMode(patch.mode);
      if (patch.startWithWindows !== undefined) void bridge.setAutostart(patch.startWithWindows);
      void bridge.savePreferences(next);
      return next;
    });
  };

  const visible = useMemo(() => {
    let records = sortConversations([...conversations.values()], "priority");
    if (preferences.mode === "compact") {
      if (preferences.compactFilter === "attention") records = records.filter((item) => ["error", "waiting", "finished_unread"].includes(displayStatus(item)));
      if (preferences.compactFilter === "active") records = records.filter((item) => item.openTabIds.length);
      if (preferences.platformFilter) records = records.filter((item) => item.platform === preferences.platformFilter);
      if (!preferences.showIdle) records = records.filter((item) => displayStatus(item) !== "idle");
      if (!preferences.showRecent) records = records.filter((item) => displayStatus(item) !== "recent");
      return records;
    }
    return filterConversations(records, filters, LABELS);
  }, [conversations, filters, preferences]);

  const command = (action: string, conversation: ConversationRecord) => {
    const mutationId = crypto.randomUUID();
    const updatedAt = Date.now();
    if (action === "focus") void bridge.send(conversation.openTabIds.length ? "FOCUS_CONVERSATION" : "OPEN_RECENT_CONVERSATION", { conversationKey: conversation.key });
    if (action === "read") void bridge.send("MARK_READ", { conversationKey: conversation.key, mutationId, updatedAt });
    if (action === "unread") void bridge.send("MARK_UNREAD", { conversationKey: conversation.key, mutationId, updatedAt });
    if (action === "labels") setLabelTarget(conversation);
  };

  const simulate = (action: string) => {
    if (action === "disconnect") {
      setConnection("extension_not_connected");
      setStale(true);
      return;
    }
    if (action === "reconnect") {
      setConnection("connected");
      setStale(false);
      setLastSyncAt(Date.now());
      return;
    }
    if (action === "snapshot") {
      const snapshot = simulatedSnapshot();
      setConversations(new Map(snapshot.conversations.map((item) => [item.key, item])));
      setConnection("connected");
      setStale(false);
      return;
    }
    const statuses: ConversationRecord["automaticStatus"][] = action === "rapid"
      ? ["generating", "waiting", "finished_unread", "idle"]
      : [action as ConversationRecord["automaticStatus"]];
    statuses.forEach((status, index) => {
      window.setTimeout(() => setConversations((current) => {
        const first = current.values().next().value as ConversationRecord | undefined;
        return first
          ? applyUpsert(current, { ...first, automaticStatus: status, lastActivityAt: Date.now() })
          : current;
      }), index * 180);
    });
  };

  const counts = (["error", "waiting", "finished_unread", "generating", "idle", "recent"] as DisplayStatus[])
    .map((status) => ({ status, count: [...conversations.values()].filter((item) => displayStatus(item) === status).length }));
  const active = [...conversations.values()].filter((item) => item.openTabIds.length).length;
  const compact = preferences.mode === "compact";

  return (
    <div className={`app-shell ${compact ? `compact density-${preferences.compactDensity}` : "full"}`}>
      <header className="app-header">
        <div className="brand"><img src="/promptdeck.svg" alt="" /><div><strong>PromptDeck</strong><span>{compact ? "Compact Panel" : "Desktop"}</span></div></div>
        <div className="header-actions">
          <span className={`connection connection-${connection}`}><span aria-hidden="true">●</span>{statusText(connection)}</span>
          <button aria-pressed={preferences.alwaysOnTop} title="Always on top" onClick={() => updatePreferences({ alwaysOnTop: !preferences.alwaysOnTop })}>Pin</button>
          <button onClick={() => updatePreferences({ mode: compact ? "full" : "compact" })}>{compact ? "Full" : "Compact"}</button>
          <button aria-label="Settings" onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </header>
      {stale || connection !== "connected" ? <div className="stale-banner" role="status">Chrome is disconnected. Showing cached state{lastSyncAt ? ` from ${relativeTime(lastSyncAt)}` : ""}; focus actions may be unavailable.</div> : null}
      {compact ? (
        <main className="compact-main">
          <section className="compact-counts" aria-label="Status summary">{counts.slice(0, 5).map(({ status, count }) => <span className={`compact-count count-${status}`} key={status}><strong>{count}</strong>{STATUS[status].name.replace(" / Unread", "")}</span>)}</section>
          <div className="compact-controls">
            {(["attention", "active", "all"] as CompactFilter[]).map((filter) => <button aria-pressed={preferences.compactFilter === filter} key={filter} onClick={() => updatePreferences({ compactFilter: filter })}>{filter === "attention" ? "Needs Attention" : filter[0]?.toUpperCase() + filter.slice(1)}</button>)}
            <select aria-label="Platform filter" value={preferences.platformFilter ?? ""} onChange={(event) => updatePreferences({ platformFilter: (event.target.value || undefined) as Platform | undefined })}><option value="">All platforms</option><option value="chatgpt">ChatGPT</option><option value="claude">Claude</option><option value="gemini">Gemini</option></select>
          </div>
          <section className="compact-list">{visible.length ? visible.map((item) => <ConversationCard key={item.key} conversation={item} preferences={preferences} compact canFocus={connection === "connected"} onCommand={command} />) : <div className="empty"><h2>Nothing needs attention</h2><p>PromptDeck will keep watching locally.</p></div>}</section>
        </main>
      ) : (
        <main className="dashboard-main">
          <section className="hero"><div><span className="eyebrow">Attention overview</span><h1>{active} active conversation{active === 1 ? "" : "s"}</h1><p>Across ChatGPT, Claude, and Gemini</p></div><button className="primary" onClick={() => void bridge.send("RESCAN_TABS", {})}>Sync now</button></section>
          <section className="summary-grid" aria-label="Conversation status summary">{counts.map(({ status, count }) => <button className={`summary-card summary-${status}`} key={status} onClick={() => setFilters((current) => ({ ...current, statuses: [status] }))}><span className="summary-icon">{STATUS[status].icon}</span><strong>{count}</strong><span>{STATUS[status].name}</span></button>)}</section>
          <section className="toolbar"><input type="search" aria-label="Search conversations" placeholder="Search conversations…" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}/><div className="filter-chips">{(["chatgpt", "claude", "gemini"] as Platform[]).map((platform) => <button aria-pressed={filters.platforms.includes(platform)} key={platform} onClick={() => setFilters((current) => ({ ...current, platforms: current.platforms.includes(platform) ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform] }))}>{PLATFORM_NAMES[platform]}</button>)}</div><div className="view-switch"><button aria-pressed={preferences.viewMode === "grid"} onClick={() => updatePreferences({ viewMode: "grid" })}>Grid</button><button aria-pressed={preferences.viewMode === "kanban"} onClick={() => updatePreferences({ viewMode: "kanban" })}>Kanban</button></div></section>
          {preferences.viewMode === "grid" ? <section className="conversation-grid">{visible.map((item) => <ConversationCard key={item.key} conversation={item} preferences={preferences} compact={false} canFocus={connection === "connected"} onCommand={command} />)}</section> : <section className="kanban">{(["error", "waiting", "finished_unread", "generating", "idle", "recent"] as DisplayStatus[]).map((status) => <section className={`kanban-column column-${status}`} key={status}><header><span>{STATUS[status].icon} {STATUS[status].name}</span><strong>{visible.filter((item) => displayStatus(item) === status).length}</strong></header>{visible.filter((item) => displayStatus(item) === status).map((item) => <ConversationCard key={item.key} conversation={item} preferences={preferences} compact={false} canFocus={connection === "connected"} onCommand={command} />)}</section>)}</section>}
        </main>
      )}
      {import.meta.env.DEV ? <aside className="simulator" aria-label="Development simulator"><strong>Simulator</strong>{["error", "waiting", "finished_unread", "generating", "idle", "disconnect", "reconnect", "snapshot", "rapid"].map((action) => <button key={action} onClick={() => simulate(action)}>{action.replaceAll("_", " ")}</button>)}</aside> : null}
      {settingsOpen ? <SettingsDialog preferences={preferences} connection={connection} lastSyncAt={lastSyncAt} onChange={updatePreferences} onClose={() => setSettingsOpen(false)} onResetPosition={() => void bridge.resetWindowPosition()} /> : null}
      {labelTarget ? <div className="dialog-backdrop"><section className="label-dialog" role="dialog" aria-modal="true"><header><h2>Labels</h2><button aria-label="Close" onClick={() => setLabelTarget(undefined)}>×</button></header>{LABELS.map((label) => <label key={label.id}><input type="checkbox" checked={labelTarget.labelIds.includes(label.id)} onChange={(event) => { const ids = event.target.checked ? [...labelTarget.labelIds, label.id] : labelTarget.labelIds.filter((id) => id !== label.id); const updatedAt = Date.now(); const mutationId = crypto.randomUUID(); setLabelTarget({ ...labelTarget, labelIds: ids }); setConversations((current) => applyUpsert(current, { ...labelTarget, labelIds: ids })); void bridge.send("SET_LABELS", { conversationKey: labelTarget.key, labelIds: ids, updatedAt, mutationId }); }}/>{label.name}</label>)}</section></div> : null}
    </div>
  );
}
