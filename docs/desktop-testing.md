# PromptDeck Desktop test plan

## Automated checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:lint
pnpm desktop:typecheck
pnpm desktop:test
pnpm desktop:build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
pnpm desktop:package
```

## Manual end-to-end test

1. Run `pnpm build`.
2. Load `dist` as an unpacked extension in `chrome://extensions`.
3. Copy its extension ID.
4. Run `pnpm native-host:build`.
5. Run `.\scripts\Register-PromptDeckNativeHost.ps1 -ExtensionId "<id>"`.
6. Start PromptDeck Desktop with `pnpm desktop:dev`.
7. Confirm the desktop indicator becomes **Connected**.
8. Open a ChatGPT conversation and confirm its card appears.
9. Generate a response and confirm **Generating**.
10. Switch tabs after completion and confirm **Finished / Unread**.
11. Trigger an explicit approval/input question and confirm **Waiting**.
12. Trigger an error or use the Vite simulator and confirm **Error**.
13. Click **Focus** and confirm Chrome focuses the correct window and tab.
14. Assign a label in desktop and confirm it appears in the extension.
15. Mark it read in desktop and confirm the extension updates.
16. Close an AI tab and confirm it becomes **Recent**.
17. Close Chrome and confirm cached state remains with a stale/disconnected banner.
18. Reopen Chrome and confirm a full snapshot reconciles without duplicates.
19. Restart desktop and confirm SQLite restores the cache without old notifications.
20. Enable start-with-Windows, sign out/in, and confirm the configured launch mode.
21. Verify tray Show, Hide, Full, Compact, Always on Top, Sync, Settings, and Exit.
22. Toggle always-on-top and verify it does not steal focus after state changes.
23. Move desktop to a second monitor, resize/maximize, restart, and verify restoration.
24. Repeat at Windows scaling 100%, 125%, 150%, and 175%.
25. Disconnect the second monitor while closed and confirm safe primary-monitor recovery.
26. Disconnect it while open and use Reset window position if Windows does not relocate it.
27. Build the MSI with `pnpm desktop:package`, install per-user, and repeat registration with the
    installed host path.
28. Uninstall, run registration validation (it should fail after unregister), and confirm user data
    is preserved until manually removed.

The simulator covers all statuses, snapshot state, and the browser-absent UI. It does not prove
live Chrome focus behavior, Windows tray/autostart behavior, or MSI custom actions.
