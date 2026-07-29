# Platform adapters

## Contract

All adapters implement the same `PlatformAdapter` interface: location matching, conversation identity and URL, title, latest assistant/user message, generation, platform errors, Waiting detection, rendered choices, availability, and normalized observation collection.

`BaseAdapter` implements shared safety and fallback behavior. Site-specific modules contain only selectors and the small host/platform declaration.

## Selector strategy

Fallbacks are ordered from most semantic to least specific:

1. stable `data-testid` or author-role markers;
2. ARIA labels, roles, and busy/streaming attributes;
3. platform custom elements;
4. meaningful structural classes as a final fallback.

Selector evaluation is guarded. One invalid or stale selector cannot crash the adapter. Missing recognized message/composer/generation structure yields Detection unavailable, not Idle.

## Current selector surfaces requiring live verification

### ChatGPT

- Assistant and user roles: `data-message-author-role`.
- Generating: stop button test ID or accessible stop label.
- Composer: `#prompt-textarea`, accessible textarea, or Lexical editor.
- Error: alert, error test ID, or Retry control.
- Title: page heading, conversation title marker, or selected navigation item.

Projects, custom GPT routes, and temporary chats need authenticated live checks because their visible heading and conversation URL behavior can vary.

### Claude

- Assistant/user message test IDs and message font containers.
- Generating: accessible stop response/generating button or `data-is-streaming`.
- Composer: composer test ID, ProseMirror, or textarea.
- Error: alert, error test ID, or Retry control.
- Title: conversation title test ID, header, or selected navigation item.

### Gemini

- `model-response` and `user-query` custom elements, test IDs, or meaningful response containers.
- Generating: accessible stop control, loading indicator, or busy model response.
- Composer: rich-textarea editor, prompt textarea, or Quill editor.
- Error: alert, `mat-error`, error test ID, or error message class.
- Title: conversation title test ID, header, or selected navigation item.

## Update workflow

1. Open the current production conversation with DevTools.
2. Inspect only visible rendered elements. Never inspect cookies, tokens, localStorage, hidden app state, request headers, or private APIs.
3. Find a semantic marker and add it before weaker fallbacks in the platform selector file.
4. Remove selectors that match ordinary assistant prose or unrelated page controls.
5. Sanitize and add a representative HTML fragment under `tests/fixtures/<platform>/`.
6. Add or update the adapter fixture test.
7. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
8. Complete the platform manual matrix in `docs/testing.md`.

Do not introduce generated obfuscated class names unless there is no stable alternative; document and isolate them if unavoidable.
