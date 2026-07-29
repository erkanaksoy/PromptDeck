import type { AdapterSelectors } from "../shared/base-adapter";

export const GEMINI_SELECTORS: AdapterSelectors = {
  assistantMessages: [
    "model-response",
    '[data-test-id="model-response"]',
    ".model-response-text"
  ],
  userMessages: [
    "user-query",
    '[data-test-id="user-query"]',
    ".user-query-container"
  ],
  generating: [
    'button[aria-label*="Stop response" i]',
    'button[aria-label*="Stop generating" i]',
    ".loading-indicator",
    "model-response[aria-busy=\"true\"]"
  ],
  errors: [
    '[role="alert"]',
    "mat-error",
    '[data-test-id*="error" i]',
    ".error-message"
  ],
  title: [
    '[data-test-id="conversation-title"]',
    "header h1",
    'nav [aria-current="page"]'
  ],
  choices: [
    "suggestion-chip button",
    ".suggestion-chip",
    '[data-test-id*="suggestion" i]'
  ],
  composer: [
    'rich-textarea [contenteditable="true"]',
    'textarea[aria-label*="prompt" i]',
    '.ql-editor[contenteditable="true"]'
  ]
};
