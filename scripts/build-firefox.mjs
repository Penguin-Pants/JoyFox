import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = "dist/firefox";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    options: "src/options/index.ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "firefox121",
  outdir: output,
  sourcemap: false,
  legalComments: "none",
});
const manifest = JSON.parse(await readFile("manifests/firefox.json", "utf8"));
await writeFile(
  `${output}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await cp("src/options/options.html", `${output}/options.html`);
await cp("src/options/options.css", `${output}/options.css`);
await cp("src/content/content.css", `${output}/content.css`);
await cp("README.md", `${output}/README.md`);
