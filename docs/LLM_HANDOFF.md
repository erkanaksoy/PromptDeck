# PromptDeck LLM Handoff

Reviewed on 2026-10-15. PromptDeck is a local-only Chrome Manifest V3 extension for tracking ChatGPT, Claude, and Gemini conversations. The GitHub repository is empty; all project commits currently exist locally. The newest implementation is on a linked worktree branch, not on `main`.

## Repository and GitHub state

| Item | Verified state |
| --- | --- |
| GitHub account authenticated through `gh` | `erkanaksoy` |
| GitHub repository | https://github.com/erkanaksoy/PromptDeck |
| GitHub visibility | Public |
| Remote contents | Empty: API reports size 0, branches API returns 0, and `git ls-remote` returns no refs |
| Local remote configuration | No remotes configured, including in the linked worktree |
| Main checkout | `C:/Users/melid/Desktop/PromptDeck` |
| Main branch and commit | `main`, `500e1f49ef6e226f1fa8e8ac7cfc1f8a34808856` |
| Newer linked worktree | `C:/Users/melid/.codex/worktrees/a9eb/PromptDeck` |
| Newer branch and commit | `codex/windows-desktop-app`, `d294548990239acb66b0c350db15cf21558c5053` |
| Branch relationship | Newer branch is 28 commits ahead of `main` |
| Main working tree before handoff | Clean |
| Linked working tree | Tracked files clean; untracked `outputs/` contains a video, images, audio, and a Python script |

**The project is not pushed to this GitHub repository.** A push of `main` alone would omit the 28 newer commits. The branch name is historical: its desktop app was subsequently removed, and the current implementation is extension-only.

This review added only this handoff to tracked project content. No commits, merges, remote configuration changes, or pushes were performed. Packaging regenerated the main checkout's ignored `dist/` and `promptdeck.zip`. The linked worktree's untracked output files were left untouched; review them separately before any broad staging command.

## Which implementation to continue

| Area | Main checkout | Newer linked branch |
| --- | --- | --- |
| Package and manifest version | 1.0.0 | 1.9.4 |
| Minimum Chrome version in manifest | 116 | 142 |
| Toolbar behavior | Popup with dashboard access | Native Chrome Side Panel action |
| UI | Dashboard grid/Kanban, popup, options, diagnostics | Adds shared Side Panel and exact-tab sidebar navigation, provider/status filters, grouping, keyboard navigation, compact colored cards |
| Labels and message previews | Present; preview persistence optional and off by default | Removed; assistant excerpts are not stored |
| Tab identity and registry | Initial implementation | Adds authoritative open-tab reconciliation and separate identities for uninitialized AI tabs |
| Shortcut | None declared | Ctrl+Shift+Y, or Command+Shift+Y on macOS, toggles Side Panel |

Read the README and source on the branch being changed. Do not use the main README as the specification for the newer UI. The newer branch preserves one shared panel while switching among supported tabs, supports New Tab, and closes the panel/disables the action on unsupported tabs. The latest fix calls Side Panel open/close directly from the shortcut handler to preserve Chrome's user gesture requirement.

For current feature work, the newer branch is the likely continuation point. Confirm the desired branch before merging or publishing; preserve both histories and the linked worktree.

## Product and architecture

The extension consolidates conversation attention across normal Chrome windows. It tracks Generating, Finished/Unread, Waiting for Input, Error, Idle, Detection unavailable, and Recent. Waiting detection uses local English-focused heuristics and supports manual response-specific overrides. Recent records expire seven days after the final open copy closes; cleanup also runs on a six-hour alarm.

There is no backend, cloud sync, telemetry, remote model, or runtime framework. The project uses vanilla TypeScript, Vite for extension pages, esbuild for service-worker/content bundles, Vitest with jsdom, ESLint, and archiver for ZIP packaging.

The runtime path is rendered platform DOM -> platform adapter -> content observation -> validated runtime message -> service-worker reducer/registry -> local storage and notifications -> extension pages. Durable data lives under `promptdeck-state` in `chrome.storage.local`; the schema constant is currently 1 on both branches. The newer branch also stores Side Panel open-window state in session storage. Main uses session storage for transient previews.

| Path | Responsibility |
| --- | --- |
| `public/manifest.json` | Chrome version, permissions, origins, worker, content scripts, toolbar and panel declarations |
| `src/background/service-worker.ts` | Messaging, lifecycle, mutation queue, focus/reopen, scans, notifications, newer Side Panel integration |
| `src/background/transitions.ts` | Pure automatic status, unread, override and transition-event logic |
| `src/background/tab-registry.ts` | Attach/detach, identity lifecycle, Recent cleanup; newer branch adds reconciliation |
| `src/background/notification-manager.ts` | Fingerprint-based notification deduplication |
| `src/background/side-panel-shortcut.ts` | Newer branch only: direct shortcut open/close and rollback on failure |
| `src/content/content-script.ts` | Debounced DOM observation, focus/visibility delay, SPA URL heartbeat, recovery rescan |
| `src/platforms/<platform>/selectors.ts` | Isolated site selectors; maintain with sanitized fixtures |
| `src/platforms/shared/base-adapter.ts` | Shared DOM-to-observation logic |
| `src/shared/waiting-detector.ts` | Local Waiting classification |
| `src/shared/urls.ts` | Supported URL normalization, conversation identity and newer panel URL eligibility |
| `src/shared/types.ts`, `src/shared/constants.ts` | Data model, schema, defaults and retention |
| `src/messaging/` | Message union and runtime validators |
| `src/storage/` | Local persistence and migration fallback |
| `src/dashboard/`, `src/sidepanel/` | Views and pure filtering/sorting/grouping; sidepanel exists only on newer branch |
| `src/options/`, `src/popup/`, `src/diagnostics/` | Settings, popup implementation and offline status gallery |
| `src/styles/app.css` | Shared UI styling |
| `scripts/build.mjs`, `scripts/package.mjs` | Production bundling, static checks and distribution ZIP |
| `tests/`, `tests/fixtures/` | Unit tests and sanitized platform DOM fragments |

Preserve the local-only privacy model, exact supported host restrictions, text escaping, restrictive CSP, and notification fingerprint deduplication. Missing page structure should report Detection unavailable. Avoid introducing cookies, credentials, private platform APIs, hidden state inspection, remote assets or telemetry.

## Setup and verification

The reviewed environment has Node 24.19.0, npm 11.17.0, pnpm 12.4.2, and installed dependencies in both worktrees. The committed dependency lock is `pnpm-lock.yaml`; prefer pnpm for a fresh checkout to preserve dependency resolution. `package.json` has no package-manager pin.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm package
```

Equivalent npm scripts work with installed dependencies. `npm install` is documented but can create a second lockfile. `dev` starts Vite; it does not replace the production build needed for the extension's worker/content bundles.

| Check on 2026-10-15 | Main at 500e1f4 | Newer branch at d294548 |
| --- | --- | --- |
| `npm run typecheck` | Passed | Passed |
| `npm run lint` | Passed | Passed |
| `npm run test` | 43 tests across 7 files passed | 62 tests across 10 files passed |
| `npm run package` | Passed, including production build and build validation | Not run in this review |
| Authenticated platform/browser checks | Not performed | Not performed |

Load the chosen worktree's `dist/` using Developer mode -> Load unpacked at `chrome://extensions`, then reload the extension after rebuilding. The main checkout's freshly generated ZIP is version 1.0.0 and does not contain the Side Panel implementation.

Tests cover transitions, URLs, registry/retention, migrations/notifications, sort/filter behavior, Waiting heuristics and three sanitized platform fixtures. The newer branch adds validator, Side Panel state and shortcut tests. These checks do not establish that selectors work against current authenticated production pages. Follow `docs/testing.md` for browser verification and `docs/platform-adapters.md` for selector maintenance. No GitHub Actions workflow is tracked.

## Review findings to address

These are source-review findings, not fixes made during this task. Line references below identify the reviewed commits and may move after editing.

### High priority storage writes bypass serialization

On both branches, observation updates and card mutations use the service worker's `queue`, but `GET_DASHBOARD_STATE` independently loads, cleans and saves the entire state. Settings changes and data-clearing requests also bypass that queue. Two operations can read the same old state and then overwrite each other's changes: for example, a dashboard read can save an old snapshot after a new unread transition is saved. An in-flight writer can also restore data after Clear All.

References: main `src/background/service-worker.ts:302`, `:353`, `:363`; newer branch equivalent handlers at `:356`, `:410`, `:416`; `src/storage/repository.ts` read/modify/write helpers. Route all durable writes through a single serialization boundary, including cleanup and clear operations. Add a test that controls asynchronous storage completion order and verifies no update is lost.

### Medium priority failed observations are deduplicated before delivery

Both branches have identical `src/content/content-script.ts`. At lines 31-35, `lastSignature` and `lastUrl` advance before `sendMessage` succeeds. If delivery fails, a subsequent observation with the same signature is discarded. The comment claiming the next event retries is therefore incorrect; a manual rescan, route change or signature change is needed. An `{ ok: false }` response is also ignored.

Track successfully acknowledged delivery separately from in-flight observations, and retain a retry path for failure. Verify a rejected send followed by an unchanged observation and a negative application response. Avoid a fix that lets an older in-flight acknowledgement overwrite a newer signature.

### Medium priority main does not reconcile stale tab memberships

Main's `rescanTabs` at `src/background/service-worker.ts:210` discovers current supported tabs without removing stored memberships for missing tabs. Browser restarts and navigation to an unsupported origin can leave records incorrectly marked open, preventing Recent retention and potentially targeting stale tab IDs. The newer branch adds `reconcileOpenTabs` and related tests; use that implementation as the starting point rather than recreating the fix on main.

### Medium priority main Clear All leaves session previews

Main's `CLEAR_ALL_DATA` at `src/background/service-worker.ts:363` calls a repository helper that clears only `chrome.storage.local`. Session preview entries remain, and `dashboardState` can reattach them when a conversation key is recreated. Clear the session preview key as part of the same operation and test reopening the same conversation. The newer branch removes the preview feature, so this finding is specific to main's retained functionality.

### Further validation gaps

Observation validation on both branches checks only part of the declared payload. It does not fully validate status enums, detection availability, nested errors, Waiting confidence/reason types, optional fingerprints/previews or platform-to-host consistency. Settings patches are accepted as arbitrary records. Strengthen these boundaries with targeted malformed-message tests if changing messaging or storage. The runtime listener is internal; this review does not establish a remotely exploitable issue.

Authenticated selectors, browser lifecycle behavior, notifications and the newer Chrome Side Panel integration still need the manual matrix. The newer README permissions section also omits the manifest's `sidePanel` and `favicon` permissions; update release-facing documentation when preparing publication.

## Recommended continuation

1. Start with `git worktree list`, `git status` in both worktrees, and this document. Preserve the linked branch and its untracked `outputs/` files.
2. Choose whether to continue the 1.9.4 branch or retain the original 1.0.0 feature set. The newer branch intentionally removes labels and previews and raises the Chrome minimum to 142.
3. Fix the serialization and delivery findings on the chosen implementation, then run its checks. For the newer branch, run production packaging as well as its already-passing static/unit checks.
4. Complete the manual browser matrix with authenticated ChatGPT, Claude and Gemini pages, including panel toolbar/shortcut behavior, navigation, multiple windows, worker suspension and Chrome restart.
5. If publishing to GitHub is requested, preserve both branches. Do not force-push or publish untracked output media by default.

The following commands are an example for a future explicitly requested push; they were not executed during this review. They preserve the current branch split and do not merge newer work into main:

```powershell
# In the main checkout, commit the handoff before pushing if it should be included.
git add docs/LLM_HANDOFF.md
git commit -m "docs: add repository review and LLM handoff"

# Recheck the remote before adding or pushing; its state may have changed.
git remote -v
git ls-remote https://github.com/erkanaksoy/PromptDeck.git
git remote add origin https://github.com/erkanaksoy/PromptDeck.git
git push -u origin main
git push -u origin codex/windows-desktop-app
git ls-remote --heads origin
```

After a push, compare both local branch hashes with the corresponding remote refs. A clean local working tree alone is not evidence that the project is backed up on GitHub. Another machine will need this file from main plus the newer branch to resume with full context.

## Publication follow up

After the review, the user requested publication to GitHub. The publication includes this handoff on main and the existing `codex/windows-desktop-app` branch, preserving the branch split. The empty-remote and uncommitted-file descriptions above record the original review state. Untracked output media in the linked worktree is excluded. Check the current remote refs for publication status.
