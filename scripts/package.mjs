import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import archiver from "archiver";

const root = resolve(import.meta.dirname, "..");
const node = process.execPath;

await new Promise((resolveBuild, rejectBuild) => {
  const child = spawn(node, [resolve(root, "scripts/build.mjs")], {
    cwd: root,
    stdio: "inherit"
  });
  child.on("exit", (code) => (code === 0 ? resolveBuild() : rejectBuild(new Error(`Build exited ${code}`))));
});

const outputPath = resolve(root, "promptdeck.zip");
await rm(outputPath, { force: true });

await new Promise((resolveArchive, rejectArchive) => {
  const output = createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolveArchive);
  archive.on("error", rejectArchive);
  archive.pipe(output);
  archive.directory(resolve(root, "dist"), false);
  void archive.finalize();
});

console.log(`PromptDeck package created: ${outputPath}`);
