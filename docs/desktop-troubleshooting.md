# Desktop troubleshooting

## Rust or Cargo is not recognized

Install Rustup with `winget install Rustlang.Rustup`, restart PowerShell, and run
`rustup default stable-msvc`. Confirm `rustc --version` and `cargo --version`.

## `link.exe` or Windows SDK is missing

Install Visual Studio 2022 Build Tools and select **Desktop development with C++**, MSVC x64 tools,
and a current Windows 11 SDK. Restart the terminal.

## Extension says bridge not installed

Build the host, register the exact ID shown by `chrome://extensions`, then validate:

```powershell
pnpm native-host:build
.\scripts\Register-PromptDeckNativeHost.ps1 -ExtensionId "<extension-id>"
.\scripts\Register-PromptDeckNativeHost.ps1 -Validate
```

Restart Chrome after changing the manifest. Verify that its path and executable exist.

## Desktop shows cached/stale state

Start Chrome, ensure desktop integration is enabled in extension settings, choose **Sync now**, and
wait for bounded reconnection. Cached state remains visible by design.

## Window is unreachable

Use **Reset window position** from desktop settings. If the window is hidden, choose **Show
PromptDeck** from the tray first.

## Full reset

Exit PromptDeck Desktop, unregister the host, then delete the PromptDeck Tauri app-data directory
containing `promptdeck.db` and logs. This is destructive and intentionally not automatic during
upgrade/uninstall.

## Logs and diagnostics

The settings diagnostics panel shows protocol version, connection state, host name, and last sync.
Logs are stored in Tauri's per-user app log directory and omit message contents.
