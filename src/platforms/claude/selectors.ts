import type { AdapterSelectors } from "../shared/base-adapter";

export const CLAUDE_SELECTORS: AdapterSelectors = {
  assistantMessages: [
    '[data-testid="assistant-message"]',
    '[data-is-streaming] .font-claude-message',
    '[data-testid*="conversation-turn"] .font-claude-message'
  ],
  userMessages: [
    '[data-testid="user-message"]',
    '[data-testid*="conversation-turn"] .font-user-message'
  ],
  generating: [
    'button[aria-label*="Stop response" i]',
    'button[aria-label*="Stop generating" i]',
    '[data-is-streaming="true"]'
  ],
  errors: [
    '[role="alert"]',
    '[data-testid*="error" i]',
    'button[aria-label*="Retry" i]'
  ],
  title: [
    '[data-testid="conversation-title"]',
    'header h1',
    'nav [aria-current="page"]'
  ],
  choices: [
    '[data-testid*="suggestion" i] button',
    '[role="group"] button'
  ],
  composer: [
    '[contenteditable="true"][data-testid*="composer" i]',
    'div.ProseMirror[contenteditable="true"]',
    'textarea'
  ]
};
