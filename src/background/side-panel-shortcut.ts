import { isPromptDeckSidePanelUrl } from "../shared/urls";

type ShortcutTab = Pick<chrome.tabs.Tab, "windowId" | "url" | "pendingUrl">;
type SidePanelControls = Pick<typeof chrome.sidePanel, "open" | "close">;

export function toggleSidePanelForTab(
  tab: ShortcutTab | undefined,
  openWindowIds: ReadonlySet<number>,
  setWindowOpen: (windowId: number, open: boolean) => void,
  sidePanel: SidePanelControls
): void {
  if (!tab || !isPromptDeckSidePanelUrl(tab.url ?? tab.pendingUrl)) return;

  const windowId = tab.windowId;
  const wasOpen = openWindowIds.has(windowId);
  setWindowOpen(windowId, !wasOpen);

  // Chrome requires open() to be called during the shortcut's user gesture.
  // Do not await tab, window, or storage APIs before this call.
  const operation = wasOpen
    ? sidePanel.close({ windowId })
    : sidePanel.open({ windowId });
  void operation.catch((error: unknown) => {
    if (openWindowIds.has(windowId) === !wasOpen) setWindowOpen(windowId, wasOpen);
    console.warn("PromptDeck could not toggle the side panel:", error);
  });
}
