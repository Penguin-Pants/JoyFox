import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/**
 * Brand icons (`docs/branding.md`): every icon a manifest names is in the
 * brand package for that browser, is a PNG, and has the size its key says.
 * Theme icons give their size in `size`.
 */
const pngSize = (bytes) => {
  assert.equal(bytes.toString("latin1", 1, 4), "PNG", "a PNG file");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

for (const browser of ["firefox", "chrome"]) {
  const manifest = JSON.parse(
    await readFile(`manifests/${browser}.json`, "utf8"),
  );
  const action = manifest.action ?? {};
  const sized = [
    ...Object.entries(manifest.icons ?? {}),
    ...Object.entries(action.default_icon ?? {}),
    ...(action.theme_icons ?? []).flatMap(({ light, dark, size }) => [
      [size, light],
      [size, dark],
    ]),
  ];
  assert.ok(manifest.icons?.["128"], `${browser}: a 128 px icon`);
  for (const [size, path] of sized) {
    assert.match(path, /^icons\/[\w-]+\.png$/, `${browser}: ${path}`);
    const bytes = await readFile(
      `assets/brand/icons/${browser}/${basename(path)}`,
    );
    assert.deepEqual(
      pngSize(bytes),
      [Number(size), Number(size)],
      `${browser}: ${path} is ${size} px square`,
    );
  }
}
