import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { build } from "esbuild";
import { buildExtension } from "../build.mjs";
import { inbox, profile } from "./pages.mjs";

/**
 * Store screenshots (`docs/branding.md`, "Store assets"): five real JoyFox
 * views, filled with invented data, each framed at 1280×800 in the brand
 * package's screenshot style. Writes `assets/store/screenshots/`.
 *
 * The Chrome build runs in Chromium with `shim.ts` for the extension API and
 * `seed.ts` for the data. JoyClub pages are stand-ins (`pages.mjs`), answered
 * from memory: every other request is refused, so nothing reaches a real site.
 *
 * Needs Playwright with its Chromium (`npm install -g playwright`, then
 * `npx playwright install chromium`); it is not a project dependency. The
 * committed images were made with the Inter font installed as the system
 * sans-serif font.
 */
const OUTPUT = "assets/store/screenshots";
const DIST = "dist/chrome";
const HERE = "scripts/store-screenshots";
/** The capture inside the frame's card, which has a 1 px border. */
const WIDTH = 1182;
const HEIGHT = 670;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const global = execFileSync("npm", ["root", "-g"], { encoding: "utf8" });
  for (const base of [process.cwd(), global.trim()])
    try {
      return require(require.resolve("playwright", { paths: [base] }));
    } catch {
      // Try the next place.
    }
  throw new Error(
    "Playwright is missing: npm install -g playwright, then npx playwright install chromium",
  );
}

const bundle = async (entry) =>
  (
    await build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      target: "chrome120",
      write: false,
      logLevel: "warning",
    })
  ).outputFiles[0].text;

const TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** A `<script>` holding code; `</script` inside it is escaped. */
const inline = (code) =>
  `<script>${code.replaceAll("</script", "<\\/script")}</script>`;

/**
 * Shim and seed first; the extension's own scripts only once the data is in,
 * as they would find it on a user's second visit.
 */
const boot = (shim, seed, scripts) =>
  `${inline(shim)}${inline(seed)}${inline(`seedReady.then(async () => {
  for (const code of ${JSON.stringify(scripts)}) {
    const script = document.createElement("script");
    script.textContent = code;
    document.body.append(script);
  }
  window.harnessReady = true;
}, (error) => { window.harnessReady = "Seed failed: " + (error && (error.stack || error.message)); });`)}`;

async function open(browser, url, answer) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error") errors.push(entry.text());
  });
  await page.route("**/*", async (route) => {
    const body = await answer(new URL(route.request().url()));
    return body ? route.fulfill(body) : route.abort("blockedbyclient");
  });
  await page.goto(url);
  await page
    .waitForFunction("window.harnessReady", null, { timeout: 15000 })
    .catch((error) => {
      throw new Error(`${url}: ${[error.message, ...errors].join("; ")}`);
    });
  const ready = await page.evaluate("window.harnessReady");
  if (ready !== true) throw new Error(String(ready));
  await page.waitForTimeout(1500);
  if (errors.length > 0) throw new Error(`${url}: ${errors.join("; ")}`);
  return { page, context };
}

async function main() {
  const { chromium } = loadPlaywright();
  await buildExtension("chrome", "chrome148");
  const shim = await bundle(`${HERE}/shim.ts`);
  const seed = await bundle(`${HERE}/seed.ts`);
  const read = (path) => readFile(path, "utf8");
  const [background, content, contentCss, standin, optionsHtml, mark] =
    await Promise.all([
      read(`${DIST}/background.js`),
      read(`${DIST}/content.js`),
      read(`${DIST}/content.css`),
      read(`${HERE}/standin.css`),
      read(`${DIST}/options.html`),
      read("assets/brand/master/joyfox-mark-light-on-dark.svg"),
    ]);

  /** The options page, served from the build at a secure origin. */
  const options = (browser, hash) =>
    open(browser, `https://joyfox.test/options.html${hash}`, async (url) => {
      if (url.host !== "joyfox.test") return undefined;
      const file = url.pathname.slice(1);
      if (file === "options.html") {
        const scripts = boot(shim, seed, [
          background,
          await read(`${DIST}/options.js`),
        ]);
        // A function, so `$` in the bundles is not a replacement pattern.
        return {
          contentType: "text/html",
          body: optionsHtml.replace(
            '<script src="options.js"></script>',
            () => scripts,
          ),
        };
      }
      try {
        return {
          contentType: TYPES[extname(file)],
          body: await readFile(`${DIST}/${file}`),
        };
      } catch {
        return { status: 404, body: "" };
      }
    });

  /** A stand-in JoyClub page with the content script and its styles. */
  const joyclub = (browser, page) =>
    open(browser, page.url, async (url) =>
      url.href === page.url
        ? {
            contentType: "text/html",
            body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${standin}</style><style>${contentCss}</style></head><body>${page.body}${boot(shim, seed, [background, content])}</body></html>`,
          }
        : undefined,
    );

  const scrollToTabs =
    "window.scrollTo(0, document.querySelector('.joyfox-tabs').getBoundingClientRect().top + scrollY - 16)";

  const shots = [
    {
      name: "01-inbox",
      caption: "Sort your inbox with your own contact rule",
      open: (browser) => joyclub(browser, inbox),
    },
    {
      name: "02-profile",
      caption: "Private notes, tags and shared interests",
      open: async (browser) => {
        const opened = await joyclub(browser, profile);
        await opened.page.locator(".joyfox-notes__summary").first().click();
        await opened.page.evaluate(
          "document.activeElement.blur(); window.scrollTo(0, 60)",
        );
        return opened;
      },
    },
    {
      name: "03-contact-rule",
      caption: "Your contact rule, in plain language",
      open: async (browser) => {
        const opened = await options(browser, "#rule");
        await opened.page.evaluate(scrollToTabs);
        return opened;
      },
    },
    {
      name: "04-events",
      caption: "Your own calendar of tracked events",
      open: async (browser) => {
        const opened = await options(browser, "#events");
        await opened.page.evaluate(scrollToTabs);
        return opened;
      },
    },
    {
      name: "05-your-data",
      caption: "Stored only in your browser. Inspect, export, delete",
      open: (browser) => options(browser, "#data"),
    },
  ];

  const browser = await chromium.launch();
  await mkdir(OUTPUT, { recursive: true });
  try {
    for (const shot of shots) {
      const { page, context } = await shot.open(browser);
      await page.waitForTimeout(300);
      const capture = await page.screenshot({ type: "png" });
      await context.close();
      const frame = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      });
      await frame.setContent(`<!doctype html><html><head><style>
* { box-sizing: border-box; }
body { margin: 0; width: 1280px; height: 800px; overflow: hidden; background: #f5f5f4; font-family: "Inter Display", Inter, Arial, sans-serif; }
header { height: 72px; display: flex; align-items: center; gap: 14px; padding: 0 40px; background: #0a0a0b; }
header svg { flex: none; width: 48px; height: 48px; }
.word { color: #f5f5f4; font-size: 30px; font-weight: 700; letter-spacing: -0.04em; }
.word b { color: #ea1c2c; }
.caption { margin-left: auto; text-align: right; }
.caption strong { display: block; color: #f5f5f4; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }
.caption small { display: block; margin-top: 2px; color: #8a8a8e; font-size: 12px; }
.card { position: absolute; left: 48px; top: 100px; width: 1184px; height: 672px; overflow: hidden; border: 1px solid #d7d7d9; border-radius: 16px; background: #fff; }
.card img { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
</style></head><body>
<header>${mark}<span class="word">Joy<b>Fox</b></span><div class="caption"><strong>${shot.caption}</strong><small>Example with invented data</small></div></header>
<div class="card"><img alt="" src="data:image/png;base64,${capture.toString("base64")}"></div>
</body></html>`);
      await frame.waitForTimeout(300);
      await writeFile(
        `${OUTPUT}/joyfox-screenshot-${shot.name}.png`,
        await frame.screenshot({ type: "png" }),
      );
      await frame.close();
      process.stdout.write(`${OUTPUT}/joyfox-screenshot-${shot.name}.png\n`);
    }
  } finally {
    await browser.close();
  }
}

await main();
