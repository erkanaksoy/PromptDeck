# Architecture

## Runtime boundaries

PromptDeck has four privileged extension pages, one MV3 service worker, and one content bundle registered only on the three supported origins.

```text
ChatGPT / Claude / Gemini DOM
        │ debounced normalized observation
        ▼
Content script → validated message → MV3 service worker
                                      │
                         transition + dedupe + retention
                                      │
                  ┌───────────────────┴──────────────────┐
                  ▼                                      ▼
       chrome.storage.local                     chrome.notifications
                  │
                  ▼
     Dashboard / Popup / Options
```

Content scripts own DOM knowledge only. They select one adapter, collect visible state, fingerprint the latest visible assistant response, and send a normalized observation. They never make durable state or notification decisions.

The service worker owns identity, tab/window mappings, state transitions, storage, Recent retention, recovery rescans, notification deduplication, and focus/reopen actions. Every mutation starts from durable storage, so service-worker suspension does not lose core state.

Extension pages query normalized state through a discriminated request union. The dashboard performs pure filtering and sorting, then sends explicit commands for mutations.

## Identity and deduplication

The primary identity is `platform + canonical conversation ID`. When a durable ID is unavailable, PromptDeck uses `platform + normalized canonical URL`. Tracking parameters and fragments are removed. Reopening a Recent conversation reuses the same record. Multiple tab IDs accumulate under that record; the lowest ID is the deterministic focus target.

When one duplicate closes, only its tab ID is removed. A record becomes Recent only when its final open tab closes.

## Transition model

The priority order is Error, Generating, Waiting, Finished / Unread, Idle, Unknown. `isUnread` is also stored separately, allowing a card to communicate Waiting and Unread together.

Notifications are created only from reducer transition events. The event key includes an assistant or error fingerprint, and the most recent keys are stored with the conversation. Restoring a worker or refreshing a tab cannot recreate an already recorded notification.

Manual Waiting and Idle overrides are bound to the current assistant fingerprint. A different fingerprint clears that override.

## Storage and migrations

One `promptdeck-state` value in `chrome.storage.local` contains schema version 1, records, settings, window labels, and the next session label. The migration entry point validates the outer shape and every conversation. Invalid records are dropped; unknown schemas reset to safe defaults with a user-visible migration message.

Assistant response excerpts are never stored. Data clear operations are centralized in the repository.

## Performance

- Mutation records are batched by a 450 ms debounce.
- Streaming state writes are deduplicated by an observation signature.
- The latest matching assistant element is inspected instead of every message body.
- A two-second heartbeat compares URL strings only.
- Recent cleanup is linear in the number of conversation records and idempotent.
- Dashboard filtering and sorting are pure and deterministic.

## Build

Vite bundles the dashboard, popup, options, and diagnostics pages. esbuild creates an ESM service worker and an IIFE content script. The build then verifies every manifest entry, checks icons, and rejects unexpected remote URLs or dynamic executable code. The package script rebuilds before writing `promptdeck.zip`.
