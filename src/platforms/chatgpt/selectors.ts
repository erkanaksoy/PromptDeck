import type { AdapterSelectors } from "../shared/base-adapter";

export const CHATGPT_SELECTORS: AdapterSelectors = {
  assistantMessages: [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
    'main article .markdown'
  ],
  userMessages: [
    '[data-message-author-role="user"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="user"]'
  ],
  generating: [
    'button[data-testid="stop-button"]',
    'button[aria-label*="Stop generating" i]',
    'button[aria-label*="Stop streaming" i]'
  ],
  errors: [
    '[role="alert"]',
    '[data-testid*="error" i]',
    'button[aria-label*="Retry" i]'
  ],
  title: [
    'main h1',
    '[data-testid="conversation-title"]',
    'nav [aria-current="page"]'
  ],
  choices: [
    '[data-testid*="choice" i] button',
    'main form button:not([aria-label])'
  ],
  composer: [
    '#prompt-textarea',
    'textarea[placeholder*="Message" i]',
    '[contenteditable="true"][data-lexical-editor="true"]'
  ]
};
