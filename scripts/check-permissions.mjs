import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const allowed = await readJson("config/permissions.json");
// Every browser's manifest asks for exactly the allowlisted access.
for (const browser of ["firefox", "chrome"]) {
  const manifest = await readJson(`manifests/${browser}.json`);
  assert.deepEqual(manifest.permissions ?? [], allowed.permissions, browser);
  assert.deepEqual(
    manifest.host_permissions ?? [],
    allowed.host_permissions,
    browser,
  );
  assert.deepEqual(
    (manifest.content_scripts ?? []).flatMap(({ matches }) => matches ?? []),
    allowed.content_script_matches,
    browser,
  );
  assert.ok(!(manifest.host_permissions ?? []).includes("<all_urls>"));
}
