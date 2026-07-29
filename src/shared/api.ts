import type { ExtensionRequest, ExtensionResponse } from "../messaging/messages";

export async function send(request: ExtensionRequest): Promise<ExtensionResponse> {
  const response = (await chrome.runtime.sendMessage(request)) as ExtensionResponse | undefined;
  return response ?? { ok: false, error: "No response from the extension service worker." };
}
