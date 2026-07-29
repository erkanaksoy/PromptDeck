# PromptDeck Desktop

PromptDeck Desktop is a local-only Windows 11 dashboard for PromptDeck conversations detected by
the existing Chrome extension. It provides full dashboard and narrow compact-panel layouts,
light/dark/system themes, always-on-top, tray operation, cached disconnected state, safe window
restoration, autostart, and local synchronization.

## Requirements

- Windows 11 x64 and WebView2 (included with current Windows 11)
- Node.js 20 or newer and pnpm
- Rust stable with the `x86_64-pc-windows-msvc` target
- Visual Studio 2022 Build Tools with **Desktop development with C++**
- WiX Toolset support used by Tauri for MSI packaging

Install Rust with `winget install Rustlang.Rustup`, restart the terminal, then run
`rustup default stable-msvc`. Install Visual Studio Build Tools from Microsoft and select the
Windows SDK plus MSVC x64 build tools. These are system-wide prerequisites and are not installed
by repository scripts.

## Development

```powershell
pnpm install
pnpm desktop:typecheck
pnpm desktop:test
pnpm desktop:dev
```

The Vite development UI automatically uses a local simulator when it is opened without Tauri.
It includes Error, Waiting, Finished/Unread, Generating, Idle, Recent, and connected state fixtures.

Build the native components and MSI:

```powershell
pnpm native-host:build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
pnpm desktop:package
```

Release outputs are copied to `artifacts\windows`: the MSI, unpackaged
`promptdeck-desktop.exe`, and `promptdeck-native-host.exe`. Intermediate Cargo output is kept under
`C:\tmp\promptdeck-desktop-release` by default so Windows Application Control can execute generated
Tauri build scripts.

## Local data

- Database: `%APPDATA%\com.promptdeck.desktop\promptdeck.db` (Tauri app-data directory)
- Logs: Tauri's per-user application log directory
- Native manifest: `%LOCALAPPDATA%\PromptDeck\NativeHost\com.promptdeck.desktop.json`
- Registry: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.promptdeck.desktop`

The database stores normalized conversation metadata, shared labels/read state/manual overrides,
desktop settings, processed message IDs, notification IDs, and connection history. It never stores
complete conversation history. Preview persistence remains off by default.

## Privacy

PromptDeck Desktop has no network listener, cloud API, login, analytics, telemetry, crash service,
or external database. It does not read cookies, credentials, Chrome profiles, or unrelated tabs.
All communication uses Chrome Native Messaging and a per-machine Windows named pipe. Deleting the
database and log directory performs a full local reset; unregister the host with the script
documented in `docs/native-messaging.md`.
