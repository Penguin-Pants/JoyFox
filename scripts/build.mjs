import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

/**
 * The unpacked extension for one browser: `dist/<browser>`, with the bundles,
 * `manifests/<browser>.json` as `manifest.json`, and the static files. Every
 * browser gets the same source; only the manifest and the esbuild target
 * differ.
 */
export async function buildExtension(browser, target) {
  const output = `dist/${browser}`;
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
    target,
    outdir: output,
    sourcemap: false,
    legalComments: "none",
  });
  const manifest = JSON.parse(
    await readFile(`manifests/${browser}.json`, "utf8"),
  );
  await writeFile(
    `${output}/manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await cp("src/options/options.html", `${output}/options.html`);
  await cp("src/options/options.css", `${output}/options.css`);
  await cp("src/content/content.css", `${output}/content.css`);
  await cp("README.md", `${output}/README.md`);
  await cp("LICENSE", `${output}/LICENSE`);
}
