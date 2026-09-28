import { build } from "esbuild";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";

/** The approved brand package (`docs/branding.md`). */
const BRAND = "assets/brand";

/**
 * The brand files the options page shows, besides the manifest's icons: the
 * mark for a light and for a dark page. Store, social and preview images are
 * for listings only and never go into a build.
 */
const PAGE_MARKS = [
  "joyfox-mark-dark-on-light.svg",
  "joyfox-mark-light-on-dark.svg",
];

/** Every icon path a manifest names: `icons`, the action and its themes. */
function manifestIcons(manifest) {
  const action = manifest.action ?? {};
  return [
    ...new Set([
      ...Object.values(manifest.icons ?? {}),
      ...Object.values(action.default_icon ?? {}),
      ...(action.theme_icons ?? []).flatMap(({ light, dark }) => [light, dark]),
    ]),
  ];
}

/** Local files the options page loads (`src`, `href`, `srcset`). */
const pageReferences = (html) =>
  [...html.matchAll(/\b(?:src|href|srcset)="([^"#][^"]*)"/g)].map(
    ([, value]) => value,
  );

/**
 * The unpacked extension for one browser: `dist/<browser>`, with the bundles,
 * `manifests/<browser>.json` as `manifest.json`, and the static files. Every
 * browser gets the same source; only the manifest, its icons and the esbuild
 * target differ. The icons come from `assets/brand/icons/<browser>`, and only
 * those the manifest names are copied.
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
  for (const path of manifestIcons(manifest))
    await cp(
      `${BRAND}/icons/${browser}/${basename(path)}`,
      `${output}/${path}`,
    );
  for (const name of PAGE_MARKS)
    await cp(`${BRAND}/master/${name}`, `${output}/brand/${name}`);
  // A broken image path fails the build, not the options page.
  for (const path of pageReferences(
    await readFile("src/options/options.html", "utf8"),
  ))
    await access(`${output}/${path}`);
  await cp("README.md", `${output}/README.md`);
  await cp("LICENSE", `${output}/LICENSE`);
}
