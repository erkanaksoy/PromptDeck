# Windows installer integration

`pnpm desktop:package` builds the release native host, copies it into Tauri's Windows sidecar
layout, creates the MSI, and copies all deliverables to `artifacts/windows/`.

The Chrome extension ID is intentionally not hardcoded. After installation, register the sidecar
for the exact installed extension ID with `scripts/Register-PromptDeckNativeHost.ps1`. The same
script supports `-Validate` and `-Unregister`; uninstall tooling must invoke `-Unregister`.

This explicit post-install configuration prevents an MSI built for one unpacked extension ID from
silently granting access to a different extension.
