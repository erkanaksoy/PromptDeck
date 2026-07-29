const development = import.meta.env?.DEV === true;

export const logger = {
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (development) console.debug(`[PromptDeck] ${message}`, metadata ?? "");
  },
  warn(message: string, metadata?: Record<string, unknown>): void {
    if (development) console.warn(`[PromptDeck] ${message}`, metadata ?? "");
  }
};
