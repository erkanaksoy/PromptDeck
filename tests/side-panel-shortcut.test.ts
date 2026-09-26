import { describe, expect, it, vi } from "vitest";
import { toggleSidePanelForTab } from "../src/background/side-panel-shortcut";

function setup(openWindows = new Set<number>()) {
  const open = vi.fn(() => Promise.resolve());
  const close = vi.fn(() => Promise.resolve());
  const setWindowOpen = (windowId: number, isOpen: boolean): void => {
    if (isOpen) openWindows.add(windowId);
    else openWindows.delete(windowId);
  };
  return { openWindows, open, close, setWindowOpen };
}

describe("side panel shortcut", () => {
  it("opens synchronously from the shortcut tab", () => {
    const panel = setup();
    toggleSidePanelForTab(
      { windowId: 42, url: "https://chatgpt.com/c/example" },
      panel.openWindows,
      panel.setWindowOpen,
      panel
    );

    expect(panel.open).toHaveBeenCalledWith({ windowId: 42 });
    expect(panel.close).not.toHaveBeenCalled();
    expect(panel.openWindows.has(42)).toBe(true);
  });

  it("closes an open panel and reopens it on the next shortcut", () => {
    const panel = setup(new Set([42]));
    const tab = { windowId: 42, url: "https://claude.ai/new" };
    toggleSidePanelForTab(tab, panel.openWindows, panel.setWindowOpen, panel);
    expect(panel.close).toHaveBeenCalledWith({ windowId: 42 });
    expect(panel.openWindows.has(42)).toBe(false);

    toggleSidePanelForTab(tab, panel.openWindows, panel.setWindowOpen, panel);
    expect(panel.open).toHaveBeenCalledWith({ windowId: 42 });
    expect(panel.openWindows.has(42)).toBe(true);
  });

  it("does nothing on unsupported pages", () => {
    const panel = setup();
    toggleSidePanelForTab(
      { windowId: 42, url: "https://example.com/" },
      panel.openWindows,
      panel.setWindowOpen,
      panel
    );
    expect(panel.open).not.toHaveBeenCalled();
    expect(panel.close).not.toHaveBeenCalled();
  });

  it("restores the prior state if Chrome rejects opening", async () => {
    const panel = setup();
    panel.open.mockRejectedValueOnce(new Error("open failed"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    toggleSidePanelForTab(
      { windowId: 42, url: "chrome://newtab/" },
      panel.openWindows,
      panel.setWindowOpen,
      panel
    );
    await vi.waitFor(() => expect(panel.openWindows.has(42)).toBe(false));
    warning.mockRestore();
  });
});
