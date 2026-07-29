# Manual test plan

Record Chrome version, PromptDeck build hash, operating system, and test date. Start with previews and persistence off.

## Installation and static checks

- Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run package`.
- Load `dist/` from `chrome://extensions` with Developer mode.
- Confirm no manifest, service-worker, content-script, or CSP error.
- Open popup, dashboard, options, and diagnostics.
- Inspect Network panels and confirm the extension makes no external requests.

## First run and general UI

- Confirm the concise welcome panel, local-only explanation, hidden-preview note, scan button, and settings link.
- Confirm no supported tabs, no matching filters, loading, Detection unavailable, empty Recent, and storage failure presentations.
- Toggle Grid/Kanban and reload; confirm persistence and no card movement animation.
- Toggle Light, Dark, and System. Zoom to 200%, navigate by keyboard, inspect visible focus, open/close details menus with keyboard, and test reduced-motion mode.
- Exercise every filter alone and in combination, every sort mode, Reset Filters, and result counts.
- Assign multiple labels, remove one, clear all, filter by label, and verify labels on Recent records.
- Exercise every card command: open, copy URL, read/unread, Waiting, Idle, clear override, reopen Recent, remove Recent.

## ChatGPT

- Open an existing conversation and confirm one card with title, host, and window.
- Start generation; confirm Generating.
- Switch away; complete generation; confirm one completion notification and unread.
- Return to the tab; after the configured stabilization delay confirm read/Idle.
- Ask for explicit approval or a missing value; confirm Waiting and its reasons in diagnostics.
- Simulate or encounter a visible failure; confirm Error and one error notification.
- Retry; confirm Error → Generating → completion.
- Close the tab; confirm Recent. Reopen from the card and confirm it becomes active without a duplicate.
- Repeat for a Project, custom GPT conversation, and temporary/new chat that later receives a canonical URL.

## Claude

Repeat the full ChatGPT sequence with a Claude conversation:

- existing conversation and title;
- generation;
- background completion, notification, unread, focus/read;
- explicit confirmation or file/log request;
- visible error and retry;
- close, Recent, reopen.

## Gemini

Repeat the full ChatGPT sequence with a Gemini conversation:

- existing conversation and title;
- generation;
- background completion, notification, unread, focus/read;
- explicit confirmation or option request;
- visible error and retry;
- close, Recent, reopen.

## Multiple tabs, windows, and lifecycle

- Open one conversation twice in one window. Confirm one card and “2 tabs.”
- Close one copy. Confirm the card stays active and no Recent duplicate appears.
- Close the final copy. Confirm one Recent record.
- Open the same conversation in two normal windows. Confirm both window labels and correct focus behavior.
- Confirm each window filter and sort.
- Restart Chrome. Confirm labels, settings, unread state, and Recent survive.
- Stop/restart the service worker from `chrome://extensions`; confirm no duplicate notifications.
- Restore a Chrome session with duplicate tabs; confirm reconciliation.
- Navigate between conversations using each platform’s SPA UI; confirm the old record becomes Recent only if no other tab remains and the new record does not inherit fingerprints.
- Click Open Dashboard repeatedly; confirm the existing dashboard tab/window receives focus.

## Privacy and settings

- With previews off, confirm every card says Preview hidden and storage has no preview.
- Enable Show previews only; confirm excerpts appear during observation but do not survive restart.
- Enable Persist previews; confirm only a short sanitized plain-text excerpt is stored.
- Verify code is reduced to `[code]`, whitespace is normalized, and page HTML cannot execute.
- Clear stored previews, clear Recent, and clear all data; verify each scope.
- Toggle all three notification categories independently.
- Confirm “Suppress finished while visible” suppresses only finished, not Waiting or Error.
- Change focus delay and verify acknowledgement timing.

## Seven-day cleanup

- Insert or adjust a sanitized test record with `recentExpiresAt` just before seven days; run cleanup and confirm it remains.
- Move expiry past seven days; run cleanup and confirm removal.
- Run cleanup twice; confirm idempotency.
- Verify cleanup on startup, dashboard open, and alarm.

## Release sign-off

- Confirm icons render at 16, 32, 48, and 128 pixels.
- Confirm the ZIP contains manifest at its root and no `node_modules`, source maps, external fonts, or remote scripts.
- Recheck current platform selectors against authenticated live pages and record results.
- Capture dashboard, Kanban, popup, options, dark theme, and empty-state screenshots.
