import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await viteBuild({ configFile: resolve(root, "vite.config.ts") });
await mkdir(resolve(dist, "assets"), { recursive: true });

await Promise.all([
  esbuild({
    entryPoints: [resolve(root, "src/background/service-worker.ts")],
    bundle: true,
    outfile: resolve(dist, "assets/service-worker.js"),
    format: "esm",
    platform: "browser",
    target: "chrome116",
    minify: true,
    sourcemap: false,
    legalComments: "none",
    define: { "import.meta.env.DEV": "false" }
  }),
  esbuild({
    entryPoints: [resolve(root, "src/content/content-script.ts")],
    bundle: true,
    outfile: resolve(dist, "assets/content-script.js"),
    format: "iife",
    platform: "browser",
    target: "chrome116",
    minify: true,
    sourcemap: false,
    legalComments: "none",
    define: { "import.meta.env.DEV": "false" }
  })
]);

await cp(resolve(root, "README.md"), resolve(dist, "README.md"));

const manifest = JSON.parse(await readFile(resolve(dist, "manifest.json"), "utf8"));
const required = [
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  ...(manifest.action.default_popup ? [manifest.action.default_popup] : []),
  manifest.options_page,
  manifest.content_scripts[0].js[0],
  ...Object.values(manifest.icons)
];
await Promise.all(required.map((path) => access(resolve(dist, path))));

const filesToInspect = [
  resolve(dist, "assets/service-worker.js"),
  resolve(dist, "assets/content-script.js")
];
for (const file of filesToInspect) {
  const source = await readFile(file, "utf8");
  if (/\beval\s*\(|\bnew Function\s*\(/.test(source)) {
    throw new Error(`Forbidden dynamic code found in ${file}`);
  }
  if (/https?:\/\//.test(source)) {
    const allowedOriginsOnly = source
      .replaceAll("https://chatgpt.com/", "")
      .replaceAll("https://claude.ai/", "")
      .replaceAll("https://gemini.google.com/", "");
    if (/https?:\/\//.test(allowedOriginsOnly)) {
      throw new Error(`Unexpected remote URL found in ${file}`);
    }
  }
}

console.log(`PromptDeck build validated: ${dist}`);
