import { describe, expect, it } from "vitest";
import { de } from "../../src/i18n/catalog/de";
import { en, type Format, type MessageKey } from "../../src/i18n/catalog/en";
import { paramsOf } from "../../src/i18n/message";
import stored from "../../docs/i18n-strings.md?raw";

/** Shows each param as `{name}` and both plural forms. */
const format: Format = {
  number: (value) => String(value),
  plural: (_value, forms) => `${forms.one} / ${forms.other}`,
};

function shown(value: unknown, key: MessageKey): string {
  if (typeof value === "string") return value;
  const params = Object.fromEntries(
    Object.keys(paramsOf(key) ?? {}).map((name) => [name, `{${name}}`]),
  );
  return (value as (p: unknown, f: Format) => string)(params, format);
}

const cell = (text: string) =>
  text.replace(/\|/gu, "\\|").replace(/\n/gu, " ").trim() || "(empty)";

/** The review table: every key, its English and its German text. */
function stringTable(): string {
  const lines = [
    "# JoyFox UI strings: English and German",
    "",
    "Generated from `src/i18n/catalog/en.ts` and `src/i18n/catalog/de.ts` for",
    "the owner's review (docs/i18n-spec.md, Section 1). The owner approved",
    "every string on 2026-09-25; a changed string needs a new review. Do not",
    "edit by hand:",
    "change the catalogs, then run",
    "`UPDATE_I18N_TABLE=1 npx vitest run tests/unit/i18n-table.test.ts`.",
    "`npm test` fails while this file does not match the catalogs.",
    "",
    "`{name}` is a value filled in when the text is shown. `a / b` shows the",
    "singular and the plural form. Brand names and JoyClub's own German labels",
    "stay as they are.",
  ];
  let section = "";
  for (const key of Object.keys(en) as MessageKey[]) {
    const group = key.split(".")[0]!;
    if (group !== section) {
      section = group;
      lines.push(
        "",
        `## ${group}`,
        "",
        "| Key | English | Deutsch |",
        "| --- | --- | --- |",
      );
    }
    lines.push(
      `| \`${key}\` | ${cell(shown(en[key], key))} | ${cell(shown(de[key], key))} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

describe("EN/DE review table", () => {
  it("lists every key in both languages, as the catalogs hold them", async () => {
    const expected = stringTable();
    const env = (
      globalThis as { process?: { env: Record<string, string | undefined> } }
    ).process?.env;
    if (env?.UPDATE_I18N_TABLE) {
      // Node's file API, loaded only to rewrite the table on request.
      const fs = await import(/* @vite-ignore */ `node:${"fs"}`);
      fs.writeFileSync(
        new URL("../../docs/i18n-strings.md", import.meta.url),
        expected,
      );
      return;
    }
    expect(stored).toBe(expected);
  });
});
