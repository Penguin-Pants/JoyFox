import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Release files (V1-9, `docs/release.md`): the manifests and `package.json`
 * carry the same version, the manifest points Firefox at the decided update
 * address (ADR 0016), and `updates.json` has the form Mozilla documents
 * ("Updating your extension", `docs/distribution.md`).
 */
const UPDATE_URL =
  "https://raw.githubusercontent.com/Penguin-Pants/JoyFox/main/updates.json";
const VERSION = /^\d+\.\d+\.\d+$/;
const HASH = /^sha(256:[0-9a-f]{64}|512:[0-9a-f]{128})$/;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("manifests/firefox.json");
const chrome = await readJson("manifests/chrome.json");
const pkg = await readJson("package.json");
const updates = await readJson("updates.json");
const gecko = manifest.browser_specific_settings.gecko;

assert.match(manifest.version, VERSION, "manifest version is x.y.z");
assert.equal(pkg.version, manifest.version, "package.json version");
assert.equal(chrome.version, manifest.version, "Chrome manifest version");
assert.equal(gecko.update_url, UPDATE_URL, "manifest update_url");

assert.deepEqual(Object.keys(updates), ["addons"], "updates.json top level");
assert.deepEqual(
  Object.keys(updates.addons),
  [gecko.id],
  "updates.json lists only this extension's ID",
);
const entries = updates.addons[gecko.id].updates;
assert.ok(Array.isArray(entries), "updates.json updates is a list");

const parts = (version) => version.split(".").map(Number);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  const i = x.findIndex((n, k) => n !== y[k]);
  return i >= 0 && x[i] > y[i];
};

let previous;
for (const entry of entries) {
  assert.match(entry.version, VERSION, "update version is x.y.z");
  if (previous)
    assert.ok(
      newer(entry.version, previous),
      `update ${entry.version} is higher than ${previous}`,
    );
  assert.ok(
    !newer(entry.version, manifest.version),
    `update ${entry.version} is not above the manifest version`,
  );
  assert.ok(
    entry.update_link.startsWith("https://"),
    `update ${entry.version} links over HTTPS`,
  );
  assert.match(entry.update_hash, HASH, `update ${entry.version} hash`);
  assert.deepEqual(
    entry.applications,
    { gecko: { strict_min_version: gecko.strict_min_version } },
    `update ${entry.version} minimum Firefox version`,
  );
  previous = entry.version;
}

// The release page repeats the README's disclaimer word for word (V1-9, D4).
const disclaimer = (text) => {
  const start = text.indexOf("## Disclaimer");
  assert.ok(start >= 0, "a Disclaimer section");
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end < 0 ? undefined : end).trim();
};
const notes = await readFile(
  `docs/release-notes/${manifest.version}.md`,
  "utf8",
);
assert.equal(
  disclaimer(notes),
  disclaimer(await readFile("README.md", "utf8")),
  "release notes repeat the README disclaimer",
);
