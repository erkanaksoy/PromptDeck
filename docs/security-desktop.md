# Desktop security

## Trust boundaries

Extension and native-host messages are untrusted. Protocol code limits messages to 1 MiB, validates
version, IDs, source, type, timestamps, payload objects, supported HTTPS hosts, extension IDs,
conversation keys, snapshots, and shared fields. Rust revalidates the outer envelope before SQLite
or UI delivery. Duplicate message IDs are ignored.

Only `https://chatgpt.com`, `https://claude.ai`, and `https://gemini.google.com` conversation URLs
are supported. Desktop commands refer to normalized conversation keys; only the extension can
activate Chrome windows/tabs. Protocol data cannot select executables, shell commands, arbitrary
files, or URL schemes.

## Tauri hardening

- All web assets are packaged locally; no remote page is loaded.
- CSP denies objects, frames, remote defaults, and broad network connections.
- Explicit Tauri commands validate arguments.
- No shell plugin or broad filesystem capability is enabled.
- Native host access uses one exact Chrome extension origin and HKCU registration.
- The pipe is local and no TCP/HTTP/WebSocket server exists.

## Logging and privacy

Production logs record component state and protocol message types, never previews, payload bodies,
credentials, cookies, Chrome profile paths, or sensitive URL queries. Tauri log files rotate at a
2 MB size. The native host keeps stdout protocol-only and uses stderr for bounded diagnostics.

PromptDeck has no telemetry, analytics, crash upload, authentication, cloud synchronization,
dynamic code download, external API, or database service. Preview display and persistence are off
by default; complete conversation histories are never stored.
