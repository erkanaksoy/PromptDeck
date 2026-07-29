# PromptDeck implementation plan

1. Scaffold a Manifest V3 TypeScript extension with deterministic multi-page and worker builds.
2. Implement the versioned local data model, URL identity, transitions, deduplication, retention, sorting, filtering, and notification guards.
3. Add isolated ChatGPT, Claude, and Gemini DOM adapters behind one shared interface.
4. Implement event-driven content observation and a restart-safe service worker registry.
5. Build the dashboard, popup, options page, and diagnostics harness with accessible light/dark UI.
6. Add fixture-driven unit tests, documentation, locally generated icons, and production packaging.
7. Run lint, type checking, tests, build validation, package creation, and local browser smoke checks.

Live site selectors will be treated as best-effort until verified against authenticated current pages.
