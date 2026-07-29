import type { Settings, StoredState } from "../shared/types";
import { createDefaultState, migrateStoredState } from "./migrations";

const STORAGE_KEY = "promptdeck-state";

export async function loadState(): Promise<StoredState> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return migrateStoredState(stored[STORAGE_KEY]);
  } catch (error) {
    return {
      ...createDefaultState(),
      migrationError: error instanceof Error ? error.message : "Storage could not be read."
    };
  }
}

export async function saveState(state: StoredState): Promise<void> {
  const serializable = JSON.parse(JSON.stringify(state)) as StoredState;
  await chrome.storage.local.set({ [STORAGE_KEY]: serializable });
}

export async function updateState(
  updater: (state: StoredState) => StoredState | Promise<StoredState>
): Promise<StoredState> {
  const current = await loadState();
  const next = await updater(current);
  await saveState(next);
  return next;
}

export async function updateSettings(patch: Partial<Settings>): Promise<StoredState> {
  return updateState((state) => ({ ...state, settings: { ...state.settings, ...patch } }));
}

export async function clearStoredPreviews(): Promise<void> {
  await updateState((state) => {
    const conversations = Object.fromEntries(
      Object.entries(state.conversations).map(([key, value]) => [
        key,
        { ...value, latestAssistantPreview: undefined, previewStored: false }
      ])
    );
    return { ...state, conversations };
  });
}

export async function clearRecent(): Promise<void> {
  await updateState((state) => ({
    ...state,
    conversations: Object.fromEntries(
      Object.entries(state.conversations).filter(([, conversation]) => !conversation.closedAt)
    )
  }));
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}
