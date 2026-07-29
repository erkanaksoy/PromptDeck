# Desktop architecture

## Components

```text
supported AI page
  -> PromptDeck content script
  -> Manifest V3 service worker
  -> Chrome Native Messaging (length-prefixed JSON)
  -> promptdeck-native-host.exe
  -> \\.\pipe\PromptDeckDesktop-v1
  -> Tauri Rust backend
  -> SQLite + React webview
```

The dedicated native-host executable is deliberately separate from the Tauri process. Chrome owns
the host lifetime and stdio, while the desktop application can independently own window/tray state,
SQLite, and the named-pipe server. No TCP, HTTP, or WebSocket listener exists.

## Workspace structure

- `src/`: existing standalone extension; Chrome-specific adapters remain here.
- `packages/shared-types`: canonical conversation and settings types.
- `packages/status-engine`: shared display status, sorting, filtering, and priority.
- `packages/protocol`: protocol envelopes, runtime validation, framing, reconciliation, conflicts,
  message deduplication, backoff, and manifest validation.
- `packages/utilities`: monitor-aware off-screen window recovery logic.
- `apps/desktop`: React/Vite UI and isolated Tauri backend.
- `native-host`: minimal Rust Chrome stdio/named-pipe bridge.
- `scripts`: build and current-user native-host registration tooling.

## Authority and conflict model

The extension is authoritative for tab/window IDs, automatic status, title, supported canonical URL,
platform, activity, open/closed state, and focus/open actions. Desktop is authoritative for its
window, theme, compact density, layout, startup, and tray preferences.

Labels, read state, and manual overrides include update time, source, and mutation ID. Reconciliation
uses deterministic last-write-wins: newest timestamp, then source, then mutation ID. Processed
message IDs are persisted to prevent duplicates and update loops. Snapshot synchronization does not
emit notifications.

## Persistence

SQLite uses WAL and schema migrations. Version 1 contains `schema_migrations`, `conversations`,
`settings`, `processed_messages`, `delivered_notifications`, and `connection_history`. The
extension's Chrome storage schema remains version 1 and compatible. Temporary disconnection never
deletes cached conversations; reconnect requests a full authoritative snapshot.

## Window and tray

Tauri's window-state plugin persists size, position, maximized state, and monitor placement. The
desktop exposes an explicit primary-monitor reset. Pure recovery logic selects monitor name first,
then intersection, clamps size, and centers unreachable windows. Tray close is the default; explicit
Exit terminates. Always-on-top changes z-order only and does not activate the window on state events.

## Implementation plan

The implementation follows baseline/shared packages, desktop UI, persistence, native host,
extension bridge, integration, installer tooling, tests, and documentation phases. Native
compilation and live Chrome integration require the Windows Rust/MSVC prerequisites and a real
unpacked extension ID.
