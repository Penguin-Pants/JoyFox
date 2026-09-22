import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("manifests/firefox.json");
const allowed = await readJson("config/permissions.json");
assert.deepEqual(manifest.permissions ?? [], allowed.permissions);
assert.deepEqual(manifest.host_permissions ?? [], allowed.host_permissions);
assert.ok(!(manifest.host_permissions ?? []).includes("<all_urls>"));
