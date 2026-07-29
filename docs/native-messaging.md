# Native Messaging and local bridge

Host name: `com.promptdeck.desktop`

Chrome sends UTF-8 JSON with a four-byte little-endian length prefix. The host handles partial
headers and bodies, rejects zero, malformed, invalid-JSON, or over-1 MiB messages, and writes only
protocol frames to stdout. Diagnostics use stderr and local logs.

The host forwards the same frames through `\\.\pipe\PromptDeckDesktop-v1`. The pipe is local to
Windows and is created by the desktop backend; there is no network endpoint. Chrome disconnect
closes the host. The extension reconnects with jittered exponential backoff from 1 second to 60
seconds and requests/replays a full snapshot after reconnection. Incremental changes are sent
immediately. As a recovery path independent of Manifest V3 service-worker timers, the always-running
desktop backend also requests an authoritative full snapshot every 15 seconds.

## Development registration

Build the host and retrieve the unpacked extension ID from `chrome://extensions`:

```powershell
pnpm native-host:build
.\scripts\Register-PromptDeckNativeHost.ps1 `
  -ExtensionId "abcdefghijklmnopabcdefghijklmnop"
```

Validate or remove the current-user registration:

```powershell
.\scripts\Register-PromptDeckNativeHost.ps1 -Validate
.\scripts\Register-PromptDeckNativeHost.ps1 -Unregister
```

Registration is written only under:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.promptdeck.desktop
```

The default registry value is the absolute manifest path. The manifest has one exact
`chrome-extension://<id>/` origin and an absolute executable path. Wildcards are rejected.

For an installed MSI, pass `-HostExecutable` with the installed sidecar path if it differs from the
development `target\release` path. Re-run registration after changing the extension ID. The
installer cannot safely guess an unpacked extension ID, so exact-origin configuration is an
explicit post-install step rather than an insecure default.

## Protocol

Every message contains `protocolVersion`, `messageId`, `sentAt`, `source`, `type`, and `payload`.
Protocol version 1 supports hello, snapshot, upsert/remove, tab/settings/labels/read updates,
heartbeat, rescan, focus/open, read/unread, labels, manual override, ACK, errors, results,
state-applied, ping, and protocol-mismatch messages. Both TypeScript and Rust validate before use.
