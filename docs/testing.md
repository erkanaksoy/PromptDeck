# Manual test plan

Record Chrome version, PromptDeck build hash, operating system, and test date.

## Installation and static checks

- Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run package`.
- Load `dist/` from `chrome://extensions` with Developer mode.
- Confirm no manifest, service-worker, content-script, or CSP error.
- Open popup, dashboard, options, and diagnostics.
- Inspect Network panels and confirm the extension makes no external requests.

## First run and general UI

- Confirm the concise welcome panel, local-only explanation, scan button, settings link, and hide action.
- Confirm no supported tabs, no matching filters, loading, Detection unavailable, empty Recent, and storage failure presentations.
- Toggle Grid/Kanban and reload; confirm persistence and no card movement animation.
- Toggle Light, Dark, and System. Zoom to 200%, navigate by keyboard, inspect visible focus, open/close details menus with keyboard, and test reduced-motion mode.
- Exercise every filter alone and in combination, every sort mode, Reset Filters, and result counts.
- Exercise every card command: open, copy URL, read/unread, Waiting, Idle, clear override, reopen Recent, remove Recent.
- Confirm each card shows only its provider/title header, status, and Activity metadata; click the header to focus or reopen it.
- Confirm the left sidebar lists every open AI tab, including duplicate tabs for one conversation, and each entry focuses the exact selected tab.
- Confirm each sidebar row shows the provider favicon, then a separate status icon; outlines follow provider colors while titles and status icons follow conversation status.
- Click the PromptDeck toolbar icon and confirm its explicit action handler opens the Side Panel on New Tab, ChatGPT, Claude, and Gemini; close it between checks.
- Switch to an unrelated website or another `chrome://` page and confirm PromptDeck closes and is absent from the Side Panel menu; switch back to an allowed tab and confirm its prior open state returns.
- Keep the Side Panel open while switching among New Tab and supported LLM tabs; confirm the same panel instance stays open and the active AI conversation highlight updates as focus changes.
- Open duplicate copies of one conversation and confirm the Side Panel collapses them into one row with the correct tab count.
- Exercise Error, Waiting, and Generating filters alone and together; repeat with the matching ChatGPT, Claude, and Gemini provider filters, then group the visible rows by Provider and Status.
- With focus in the Side Panel list, use Up/Down to move through visible rows and Enter to focus the selected conversation tab.
- Open the Side Panel position control, confirm it reports the current side on Chrome 140+, and verify its button opens Chrome Settings → Appearance.
- Press `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS) repeatedly and confirm it opens and closes PromptDeck on the active supported tab, does nothing on unsupported tabs, and remains customizable at `chrome://extensions/shortcuts`.

## ChatGPT

- Open an existing conversation and confirm one compact card with title, status, and activity.
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
- Restart Chrome. Confirm settings, unread state, and Recent survive.
- Stop/restart the service worker from `chrome://extensions`; confirm no duplicate notifications.
- Restore a Chrome session with duplicate tabs; confirm reconciliation.
- Navigate between conversations using each platform’s SPA UI; confirm the old record becomes Recent only if no other tab remains and the new record does not inherit fingerprints.
- Click Open Dashboard repeatedly; confirm the existing dashboard tab/window receives focus.

## Privacy and settings

- Confirm cards and settings expose no assistant-response previews.
- Inspect local storage and confirm assistant-response excerpts are not stored.
- Clear Recent and clear all data; verify each scope.
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
