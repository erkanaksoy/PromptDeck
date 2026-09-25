# PromptDeck

PromptDeck is a local-only Chrome extension that consolidates open ChatGPT, Claude, and Gemini conversations into one calm, colorful attention dashboard. It tracks generation, unread completions, explicit requests for user input, platform errors, idle conversations, and recently closed chats across multiple Chrome windows.

PromptDeck does not use a backend, remote AI classifier, analytics, telemetry, or cloud storage.

## Screenshots

Screenshots should be captured from `dashboard.html`, `popup.html`, and `options.html` after loading `dist/` in Chrome. An offline status gallery is included at `diagnostics.html` so all six visual states can be captured without live AI accounts.

## Features

- Manifest V3 service worker and Chrome dashboard.
- One deduplicated record per platform conversation, even when it is open in multiple tabs.
- Grid and independently scrollable Kanban views.
- Compact left sidebar listing every open AI tab; each entry focuses its exact browser tab.
- Sidebar rows show the provider favicon followed by a separate status icon; titles use status colors while entry outlines identify ChatGPT, Claude, or Gemini.
- Browser-wide Chrome Side Panel with one collapsed row per conversation, a duplicate-tab count, and a clear highlight for the currently focused tab.
- One-click Error, Waiting, and Generating filters with optional Provider or Status grouping.
- Side Panel keyboard navigation with Up/Down arrows and Enter.
- Side Panel position control showing the current side and linking directly to Chrome's global left/right setting.
- `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS) toggles the Side Panel; the shortcut is customizable in Chrome.
- Automatic states: Generating, Finished / Unread, Waiting for Input, Error, Idle, and Detection unavailable.
- Status-colored conversation cards: green Finished, yellow Waiting, red Error, and slate-blue Idle.
- Dismissible first-run welcome panel and a sticky dashboard header.
- Seven-day Recent retention after the last open copy of a conversation closes.
- Combined platform, status, window, unread, and text filters.
- Deterministic sorting by attention, status, unread, activity, title, platform, window, or close time.
- Compact cards with clickable conversation headers and activity metadata.
- Manual read/unread, Waiting, Idle, copy URL, reopen, and Recent-removal actions.
- Local Chrome notifications for finished generation, Waiting, and Error transitions with fingerprint-based deduplication.
- Light, dark, and system themes.
- Manual rescan and safe content-script recovery.
- Offline diagnostics page and fixture-driven tests.

## Supported platforms

- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`

Projects, custom GPT conversations, temporary/new-chat pages, and canonical conversation routes are handled where visible page state and a usable URL make that technically possible.

## Status definitions

- **Error:** A visible platform error, retry, rate-limit, load, interruption, or network signal was detected.
- **Generating:** A platform-specific stop or streaming control is visible.
- **Waiting for Input:** The latest visible assistant response contains a medium- or high-confidence explicit request for approval, confirmation, a choice, a file, logs, or other required input.
- **Finished / Unread:** A generation ended or a new completed response appeared while its tab was not active and visible.
- **Idle:** No generation, error, waiting request, or unread completion remains.
- **Detection unavailable:** The adapter cannot find enough recognized page structure. PromptDeck does not silently call this Idle.
- **Recent:** No copy of the conversation is open; the record is retained for exactly seven days.

Waiting detection is a transparent local heuristic. It examines the last one or two visible paragraphs, direct second-person questions, explicit input and approval phrases, and rendered choices. It excludes code blocks, quotes, headings, citations, rhetorical questions, and generic optional offers. Heuristics are imperfect, so every card exposes response-bound manual Waiting and Idle overrides. A new assistant fingerprint clears an older response-specific override.

## Privacy

All PromptDeck data stays in `chrome.storage.local` on this Chrome installation. The extension only inspects rendered page text and status controls on the three supported origins.

- Assistant response excerpts are never stored.
- Fingerprints are lightweight local hashes; full conversations are never stored.
- Notification bodies contain platform, title, and event only.
- PromptDeck does not read cookies, credentials, authentication tokens, platform localStorage, request headers, or inaccessible/hidden reasoning.
- The settings page can clear Recent items or all local PromptDeck data.
- No external fonts, scripts, styles, API calls, telemetry, or analytics are present.

## Permissions

- `tabs`: enumerate supported tabs in every normal window, match URLs, focus the correct tab/window, and avoid duplicate dashboard tabs.
- `storage`: persist the versioned local schema, unread state, settings, fingerprints, and Recent records.
- `notifications`: show the three user-configurable local Chrome notification categories.
- `alarms`: perform MV3-compatible Recent cleanup every six hours.
- `scripting`: safely reinject the packaged content script during a manual recovery scan when it is missing.
- Host access is restricted to ChatGPT, Claude, and Gemini. There is no `<all_urls>`, cookies, browsing history, or web request permission.

The Chrome API choices follow the official [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs/), [Storage](https://developer.chrome.com/docs/extensions/reference/api/storage/), [Notifications](https://developer.chrome.com/docs/extensions/reference/api/notifications/), and [Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting/) documentation.

## Install from `dist/`

1. Build the project using the commands below.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository’s `dist` directory.
6. Pin PromptDeck if desired. Click its toolbar icon, then **Open Dashboard**.

Reload the extension from `chrome://extensions` after rebuilding.

## Development

This environment used pnpm because no npm executable was available. The project remains compatible with npm.

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run package
```

Equivalent pnpm commands are `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm package`.

`npm run build` creates the loadable `dist/` directory and validates manifest paths, icon files, remote URLs, and dynamic code. `npm run package` rebuilds and creates `promptdeck.zip`.

## Project structure

```text
src/
  background/       service worker, reducer, tab registry, notifications
  content/          event-driven content observation and SPA recovery
  dashboard/        grid/Kanban UI, sorting, filtering
  diagnostics/      offline state visual harness
  messaging/        discriminated message union and runtime validation
  options/          settings and local-data controls
  platforms/        isolated ChatGPT, Claude, Gemini adapters/selectors
  popup/            compact toolbar summary
  shared/           types, URL safety, text, hashing, constants
  storage/          versioned repository and migration fallback
tests/              unit tests and sanitized DOM fixtures
scripts/            build, package, and icon generation
docs/               architecture, adapters, and manual test plan
public/             MV3 manifest and local icons
```

## Implementation decisions

- Vanilla TypeScript was selected instead of React to minimize extension runtime code while preserving typed, composable modules.
- The durable model keeps the requested single `automaticStatus` plus `isUnread`; Waiting can therefore remain unread and is displayed with both signals.
- The lowest tab ID is the deterministic primary instance for duplicate conversations.
- Window labels are stable for the current Chrome session. Chrome window IDs are not treated as durable across full browser restarts.
- Recent retention is fixed at exactly seven days; cleanup occurs on startup, dashboard reads, and a six-hour alarm.
- Content updates are MutationObserver-driven and debounced. A low-frequency two-second URL heartbeat only detects SPA routes that do not emit `popstate`; it does not rescan content continuously.
- Rendered response text is examined transiently for local status detection and is never stored.

## Security model

Page-derived text is untrusted. PromptDeck renders it through text escaping, never `innerHTML` from a source page, and never `dangerouslySetInnerHTML`. URLs are parsed, normalized, restricted to HTTPS and the three exact supported hosts before they are stored or opened. Incoming content-script messages are structurally validated. Production builds prohibit `eval()` and `new Function()` and use a restrictive extension page CSP. No resources are web-accessible.

The build checks bundled workers for unexpected remote URLs and dynamic executable code. Development diagnostics never log conversation content in production.

## Updating platform selectors

Each site’s selectors live in `src/platforms/<platform>/selectors.ts`. See [docs/platform-adapters.md](docs/platform-adapters.md) for the update workflow. Prefer semantic attributes, ARIA labels, roles, custom elements, and stable test IDs. Add a sanitized fixture and adapter test whenever a fallback changes.

## Troubleshooting

- **Detection unavailable:** let the page finish loading, click **Rescan Tabs**, then inspect the offline diagnostics page and adapter selector notes. A current platform DOM change may require selector maintenance.
- **No notification:** verify both PromptDeck’s toggle and Chrome/OS notification permissions. Chrome may suppress notifications based on system policy.
- **Duplicate dashboard tab:** close older developer builds; dashboard deduplication is scoped to the currently installed extension ID.
- **A closed chat disappeared:** Recent is intentionally deleted after seven days or when explicitly removed.

## Known limitations

- Live selectors were implemented from layered semantic fallbacks and sanitized fixtures, but authenticated current ChatGPT, Claude, and Gemini pages still require manual live verification.
- Platform DOM changes can temporarily reduce a card to Detection unavailable.
- Temporary/new chat routes use a tab-scoped identity until the platform assigns a durable conversation ID.
- Waiting detection is English-focused in version 1.
- Chrome and the operating system ultimately control whether and how notifications appear.
- The focus delay setting is used by content visibility stabilization; rapid focus changes may delay acknowledgement until the next observation.

## Chrome Web Store considerations

Before submission, perform the complete manual matrix in `docs/testing.md`, capture screenshots, provide the privacy disclosure above, justify the five permissions, and verify every host selector against current production pages. The ZIP contains only locally bundled runtime assets.

## Disclaimer

PromptDeck is an independent extension and is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, or Google.
