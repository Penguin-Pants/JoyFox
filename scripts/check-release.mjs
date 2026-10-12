import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Release files (`docs/release.md`): the manifests and `package.json` carry the
 * same version, and the Firefox manifest has no `update_url`, which AMO refuses
 * for a listed add-on (ADR 0016, "AMO listing").
 */
const VERSION = /^\d+\.\d+\.\d+$/;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("manifests/firefox.json");
const chrome = await readJson("manifests/chrome.json");
const pkg = await readJson("package.json");
const gecko = manifest.browser_specific_settings.gecko;

assert.match(manifest.version, VERSION, "manifest version is x.y.z");
assert.equal(pkg.version, manifest.version, "package.json version");
assert.equal(chrome.version, manifest.version, "Chrome manifest version");
assert.equal(gecko.update_url, undefined, "no update_url (AMO updates it)");

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
