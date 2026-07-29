# Stable Chrome extension ID

Chrome Native Messaging manifests allow exact extension origins, so an unpacked extension whose ID
changes will be rejected. PromptDeck does not commit a private extension signing key and does not
hardcode a developer-specific ID.

## Find the current ID

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer mode and choose **Load unpacked**.
4. Select this repository's `dist` directory.
5. Copy the 32-character lowercase ID shown on the PromptDeck card.
6. Register it with `Register-PromptDeckNativeHost.ps1 -ExtensionId <id>`.

The script accepts only Chrome's `a` through `p` 32-character form and generates exactly one allowed
origin. `-Validate` checks the executable, manifest, registry, and origin.

## Development strategy

Keep the same unpacked-extension installation in the same Chrome profile. If Chrome assigns a new
ID, re-run the registration command. Teams may use a locally managed development manifest `key`,
but the corresponding private key must remain outside Git and secret management is the team's
responsibility.

## Release strategy

A Chrome Web Store listing supplies a stable release ID. Build or install PromptDeck Desktop, then
run the registration tool with that published ID. A managed enterprise installer may pass the
release ID and installed host path to the same script. Never use `*`, multiple unrelated extension
origins, or a guessed ID.
