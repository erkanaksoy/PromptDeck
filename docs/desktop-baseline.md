# PromptDeck Desktop baseline

Recorded on 2026-07-29 from commit `500e1f4` in the dedicated
`codex/windows-desktop-app` worktree.

## Repository architecture

- Manifest V3 Chrome extension built with TypeScript, Vite, and esbuild.
- A service worker owns tab discovery, state transitions, notifications, and `chrome.storage.local`.
- Content scripts use platform adapters for ChatGPT, Claude, and Gemini.
- Storage schema version 1 stores normalized `ConversationRecord` values, settings, and window labels.
- Automatic states are generating, finished/unread, waiting, error, idle, and unknown.
- Manual overrides support waiting and idle. Labels use a fixed eight-label vocabulary.
- Dashboard state logic provides priority, status, unread, activity, title, platform, window, label,
  and recently-closed sorting plus combined search/filtering.
- Shared CSS implements light/dark design tokens. Dashboard, popup, settings, and diagnostics are
  DOM-rendered TypeScript entry points.
- The extension ID is not pinned in the manifest. Native messaging was not present in the baseline.

## Baseline commands

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed: 7 files, 43 tests |
| `pnpm build` | Passed; validated `dist/` |

Node 24.14.0 and pnpm 11.9.0 were available. Rust and Cargo were not installed or available on
`PATH` at baseline, so native compilation was not part of the existing extension baseline.

## Compatibility constraints

The extension remains independently buildable and fully functional without PromptDeck Desktop.
Chrome APIs stay inside extension adapters, while canonical data types, status logic, and the
versioned desktop protocol are extracted into workspace packages.
