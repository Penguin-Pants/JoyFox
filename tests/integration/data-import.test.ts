import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../../src/accounts/account-service";
import { DataService, serializeExport } from "../../src/data/data-service";
import { parseImportFile, planImport } from "../../src/data/import";
import type {
  ExtensionAccount,
  MessageTemplate,
  UserNote,
} from "../../src/domain/types";
import { ExtensionError } from "../../src/errors";
import { LOCALE_KEY } from "../../src/i18n/locale";
import { isMessage } from "../../src/i18n/message";
import { setLocale, t } from "../../src/i18n/translator";
import { DATABASE_VERSION, ENTITY_NAMES } from "../../src/storage/database";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const t0 = "2026-09-20T10:00:00.000Z";
const t1 = "2026-09-21T10:00:00.000Z";
const t2 = "2026-09-22T10:00:00.000Z";

let settings: MemorySettingsArea;
let data: DataService;

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  data = new DataService(
    new AccountService(repositories.extensionAccounts, settings),
    settings,
  );
});

const account = (id: string, joyClubAccountId: string): ExtensionAccount => ({
  id,
  accountId: id,
  joyClubAccountId,
  createdAt: t0,
  updatedAt: t0,
});
const note = (accountId: string, body: string, at: string): UserNote => ({
  id: "note:1234567",
  accountId,
  memberId: "1234567",
  body,
  createdAt: t0,
  updatedAt: at,
});
const template = (
  accountId: string,
  id: string,
  body: string,
): MessageTemplate => ({
  id,
  accountId,
  name: "Hello",
  folder: "General",
  body,
  createdAt: t0,
  updatedAt: t0,
});

/** A full export file holding the given records, built in memory. */
function fullFile(
  records: Partial<Record<string, unknown[]>>,
  fileSettings: Record<string, unknown> = {},
): string {
  const entities = Object.fromEntries(
    ENTITY_NAMES.map((name) => [name, records[name] ?? []]),
  );
  return JSON.stringify({
    schemaVersion: DATABASE_VERSION,
    exportedAt: t2,
    scope: "all",
    entities,
    settings: fileSettings,
  });
}

async function importText(text: string) {
  const plan = await data.previewImport(text);
  return data.applyImport(text, plan.signature);
}

describe("M8 import: checking the file", () => {
  it.each([
    ["not JSON", "{", "not valid JSON"],
    [
      "no entities",
      JSON.stringify({ schemaVersion: 2, scope: "all" }),
      "not a JoyFox export",
    ],
    [
      "a newer version",
      JSON.stringify({
        schemaVersion: DATABASE_VERSION + 1,
        scope: "all",
        entities: {},
      }),
      "newer JoyFox version",
    ],
    [
      "an unknown type",
      JSON.stringify({
        schemaVersion: 2,
        scope: "all",
        entities: { secrets: [] },
      }),
      "unknown data type",
    ],
    [
      "a foreign setting",
      JSON.stringify({
        schemaVersion: 2,
        scope: "all",
        entities: {},
        settings: { other: 1 },
      }),
      "setting JoyFox does not use",
    ],
  ])("refuses %s", (_label, text, message) => {
    expect(() => parseImportFile(text)).toThrow(message);
  });

  it("refuses the whole file when one record is invalid", async () => {
    const text = fullFile({
      extensionAccounts: [account("a", "synthetic-a")],
      userNotes: [
        note("a", "fine", t1),
        { ...note("a", "x", t1), id: "note:2", body: "" },
      ],
    });
    await expect(data.previewImport(text)).rejects.toThrow(
      "Record 2 of userNotes",
    );
    expect(await repositories.userNotes.list("a")).toEqual([]);
  });

  it("refuses an account export holding another account's record", () => {
    const text = JSON.stringify({
      schemaVersion: 2,
      scope: "account",
      accountId: "a",
      entities: {
        extensionAccounts: [account("a", "x")],
        userNotes: [note("b", "x", t1)],
      },
    });
    expect(() => parseImportFile(text)).toThrow("belongs to another account");
  });

  it("refuses two accounts with one identifier, and duplicate records", () => {
    expect(() =>
      parseImportFile(
        fullFile({
          extensionAccounts: [account("a", "same"), account("b", "same")],
        }),
      ),
    ).toThrow("same identifier");
    expect(() =>
      parseImportFile(
        fullFile({
          extensionAccounts: [account("a", "x")],
          userNotes: [note("a", "1", t1), note("a", "2", t1)],
        }),
      ),
    ).toThrow("appears twice");
  });
});

describe("M8 import: restoring and merging", () => {
  it("restores a full export on an empty install exactly", async () => {
    await repositories.extensionAccounts.put("a", account("a", "synthetic-a"));
    await repositories.userNotes.put("a", note("a", "Invented", t1));
    await repositories.messageTemplates.put(
      "a",
      template("a", "template:1", "Hi"),
    );
    await settings.set({
      [ACTIVE_ACCOUNT_SETTING_KEY]: "a",
      "joyfox.templatePicker": false,
    });
    const before = await data.exportAll();
    const text = serializeExport(before);

    await data.deleteEverything();
    const plan = await importText(text);
    expect(plan.accounts).toEqual({ matched: 0, added: 1 });

    const after = await data.exportAll();
    for (const name of ENTITY_NAMES)
      expect(after.entities[name]).toEqual(before.entities[name]);
    expect(settings.items.get(ACTIVE_ACCOUNT_SETTING_KEY)).toBe("a");
    expect(settings.items.get("joyfox.templatePicker")).toBe(false);
  });

  it("merges into the account with the same identifier, by the approved rules", async () => {
    // Stored: account "local" for identifier "me", an older note, a tag,
    // and a template.
    await repositories.extensionAccounts.put("local", account("local", "me"));
    await repositories.userNotes.put("local", note("local", "old note", t0));
    await repositories.userTags.put("local", {
      id: "tag:1234567:met",
      accountId: "local",
      memberId: "1234567",
      label: "Met",
      createdAt: t0,
      updatedAt: t0,
    });
    await repositories.messageTemplates.put(
      "local",
      template("local", "template:a", "Same text"),
    );
    await settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: "local" });

    // File: the same person under another account ID, with newer data.
    const text = fullFile(
      {
        extensionAccounts: [
          { ...account("remote", "me"), label: "Other label" },
        ],
        userNotes: [note("remote", "new note", t2)],
        userTags: [
          {
            id: "tag:1234567:met",
            accountId: "remote",
            memberId: "1234567",
            label: "MET",
            createdAt: t0,
            updatedAt: t2,
          },
        ],
        messageTemplates: [
          template("remote", "template:b", "Same text"),
          template("remote", "template:c", "Other text"),
        ],
        trustSignals: [
          {
            id: "trust:1",
            accountId: "remote",
            memberId: "1234567",
            kind: "positive",
            occurredAt: t1,
            createdAt: t1,
            updatedAt: t1,
          },
        ],
      },
      { [ACTIVE_ACCOUNT_SETTING_KEY]: "remote" },
    );
    const plan = await importText(text);

    expect(plan.accounts).toEqual({ matched: 1, added: 0 });
    expect(plan.counts.userNotes).toMatchObject({ replaced: 1 });
    expect(plan.counts.userTags).toMatchObject({ kept: 1 });
    expect(plan.counts.messageTemplates).toMatchObject({
      added: 1,
      duplicates: 1,
    });
    expect(plan.counts.trustSignals).toMatchObject({ added: 1 });
    // Everything lands in the existing account; nothing under "remote".
    expect(
      (await repositories.userNotes.get("local", "note:1234567"))?.body,
    ).toBe("new note");
    expect((await repositories.userTags.list("local"))[0]?.label).toBe("Met");
    expect(await repositories.messageTemplates.list("local")).toHaveLength(2);
    expect(await repositories.trustSignals.list("local")).toHaveLength(1);
    expect(
      await repositories.extensionAccounts.get("remote", "remote"),
    ).toBeUndefined();
    expect(
      (await repositories.extensionAccounts.get("local", "local"))?.label,
    ).toBeUndefined();
    // The active account stays.
    expect(settings.items.get(ACTIVE_ACCOUNT_SETTING_KEY)).toBe("local");
  });

  it("keeps the stored version when the file's is older or the same age", async () => {
    await repositories.extensionAccounts.put("a", account("a", "me"));
    await repositories.userNotes.put("a", note("a", "stored", t1));
    const plan = await importText(
      fullFile({
        extensionAccounts: [account("a", "me")],
        userNotes: [note("a", "file", t1)],
      }),
    );
    expect(plan.counts.userNotes).toMatchObject({ kept: 1, replaced: 0 });
    expect((await repositories.userNotes.get("a", "note:1234567"))?.body).toBe(
      "stored",
    );
  });

  it("gives a new ID to an imported account whose ID is taken by another account", async () => {
    await repositories.extensionAccounts.put("a", account("a", "someone-else"));
    await repositories.userNotes.put("a", note("a", "theirs", t0));
    const text = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [note("a", "mine", t2)],
    });
    const plan = await importText(text);
    expect(plan.accounts).toEqual({ matched: 0, added: 1 });
    const accounts = await repositories.extensionAccounts.listAllAccounts();
    const mine = accounts.find((item) => item.joyClubAccountId === "me")!;
    expect(mine.id).not.toBe("a");
    expect(mine.accountId).toBe(mine.id);
    expect(
      (await repositories.userNotes.get(mine.id, "note:1234567"))?.body,
    ).toBe("mine");
    expect((await repositories.userNotes.get("a", "note:1234567"))?.body).toBe(
      "theirs",
    );
  });

  it("imports a single-account export as a new account without changing the active one", async () => {
    await repositories.extensionAccounts.put("a", account("a", "first"));
    await settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: "a" });
    const text = JSON.stringify({
      schemaVersion: DATABASE_VERSION,
      exportedAt: t2,
      scope: "account",
      accountId: "b",
      entities: {
        extensionAccounts: [account("b", "second")],
        userNotes: [note("b", "B", t1)],
      },
    });
    const plan = await importText(text);
    expect(plan.accounts).toEqual({ matched: 0, added: 1 });
    expect((await repositories.userNotes.get("b", "note:1234567"))?.body).toBe(
      "B",
    );
    expect(settings.items.get(ACTIVE_ACCOUNT_SETTING_KEY)).toBe("a");
  });

  it("activates an imported account when none is active", async () => {
    const text = JSON.stringify({
      schemaVersion: DATABASE_VERSION,
      scope: "account",
      accountId: "b",
      entities: { extensionAccounts: [account("b", "second")] },
    });
    await importText(text);
    expect(settings.items.get(ACTIVE_ACCOUNT_SETTING_KEY)).toBe("b");
  });

  it("changes nothing when the same file is imported twice", async () => {
    const text = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [note("a", "x", t1)],
    });
    await importText(text);
    const second = await data.previewImport(text);
    expect(second.writes).toEqual([]);
    expect(second.counts.userNotes).toMatchObject({ kept: 1 });
  });

  it("refuses to apply a preview that stored data has outdated", async () => {
    const text = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [note("a", "file", t1)],
    });
    const plan = await data.previewImport(text);
    // Another tab stores a newer note after the preview.
    await repositories.extensionAccounts.put("a", account("a", "me"));
    await repositories.userNotes.put("a", note("a", "newer", t2));
    await expect(data.applyImport(text, plan.signature)).rejects.toThrow(
      "changed while the file was checked",
    );
    expect((await repositories.userNotes.get("a", "note:1234567"))?.body).toBe(
      "newer",
    );
  });

  it("plans the same way twice, even with a moved account", () => {
    const file = parseImportFile(
      fullFile({ extensionAccounts: [account("a", "me")] }),
    );
    const stored = {
      entities: parseImportFile(
        fullFile({ extensionAccounts: [account("a", "other")] }),
      ).entities,
      settings: {},
    };
    let n = 0;
    const first = planImport(file, stored, () => `id-${(n += 1)}`);
    const second = planImport(file, stored, () => `id-${(n += 1)}`);
    expect(first.signature).toBe(second.signature);
  });

  it("refuses records whose scope would land in an account the file does not hold", async () => {
    await repositories.extensionAccounts.put("S", account("S", "mine"));
    // No account "S" in the file, but a note scoped to "S".
    await expect(
      data.previewImport(fullFile({ userNotes: [note("S", "sneaky", t1)] })),
    ).rejects.toThrow("account the file does not hold");
    // A file account that merges into "S", plus stray records scoped "S".
    await expect(
      data.previewImport(
        fullFile({
          extensionAccounts: [account("f", "mine")],
          userNotes: [note("f", "one", t1), note("S", "two", t1)],
        }),
      ),
    ).rejects.toThrow("account the file does not hold");
    expect(await repositories.userNotes.list("S")).toEqual([]);
  });

  it("still imports records under a scope that is no account (the wake counter)", async () => {
    const plan = await importText(
      fullFile({
        extensionPreferences: [
          {
            id: "background-wake-count",
            accountId: "acceptance",
            key: "diagnostic.backgroundWakeCount",
            value: 3,
            createdAt: t0,
            updatedAt: t0,
          },
        ],
      }),
    );
    expect(plan.counts.extensionPreferences.added).toBe(1);
  });

  it("refuses unknown fields and prototype keys at any depth", () => {
    const withField = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [{ ...note("a", "x", t1), html: "<img>" }],
    });
    expect(() => parseImportFile(withField)).toThrow("unknown field (html)");
    const proto = fullFile({ extensionAccounts: [account("a", "me")] }).replace(
      '"joyClubAccountId":"me"',
      '"joyClubAccountId":"me","__proto__":{"x":1}',
    );
    expect(() => parseImportFile(proto)).toThrow("forbidden key");
    const nested = fullFile({
      extensionAccounts: [account("a", "me")],
      extensionPreferences: [
        {
          id: "p",
          accountId: "a",
          key: "k",
          value: { deep: { constructor: 1 } },
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(nested)).toThrow("forbidden key");
  });

  it("refuses a record dated in the future, which would win every later merge", () => {
    const text = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [note("a", "x", "9999-01-01T00:00:00.000Z")],
    });
    expect(() => parseImportFile(text)).toThrow("dated in the future");
  });

  it("refuses a future date in any date field, including action steps", () => {
    const future = "9999-01-01T00:00:00.000Z";
    const snapshot = fullFile({
      extensionAccounts: [account("a", "me")],
      profileSnapshots: [
        {
          id: "snap",
          accountId: "a",
          memberId: "1234567",
          capturedAt: future,
          verification: "unknown",
          photoCount: "unknown",
          profileWordCount: "unknown",
          joinedAt: "unknown",
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(snapshot)).toThrow("dated in the future");
    const step = fullFile({
      extensionAccounts: [account("a", "me")],
      actionLogs: [
        {
          id: "log",
          accountId: "a",
          action: "x",
          steps: [{ name: "started", ok: true, at: future }],
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(step)).toThrow("dated in the future");
  });

  it("refuses unknown fields inside action steps and rule conditions", () => {
    const step = fullFile({
      extensionAccounts: [account("a", "me")],
      actionLogs: [
        {
          id: "log",
          accountId: "a",
          action: "x",
          steps: [{ name: "s", ok: true, at: t0, messageText: "secret" }],
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(step)).toThrow("unknown field (messageText)");
    const rule = fullFile({
      extensionAccounts: [account("a", "me")],
      contactRules: [
        {
          id: "rule:global",
          accountId: "a",
          name: "R",
          schemaVersion: 1,
          audience: "all",
          enabled: true,
          defaultPlacement: "needs-review",
          root: {
            type: "group",
            match: "all",
            children: [
              {
                type: "condition",
                kind: "verified",
                whenUnknown: "needs-review",
                note: "x",
              },
            ],
          },
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(rule)).toThrow("unknown field (note)");
  });

  it("accepts a version 2 rule with a turned-around condition", () => {
    const file = fullFile({
      extensionAccounts: [account("a", "me")],
      contactRules: [
        {
          id: "rule:global",
          accountId: "a",
          name: "R",
          schemaVersion: 2,
          audience: "all",
          enabled: true,
          defaultPlacement: "needs-review",
          root: {
            type: "group",
            match: "any",
            children: [
              {
                type: "group",
                match: "all",
                children: [
                  {
                    type: "condition",
                    kind: "minimumPhotos",
                    value: 3,
                    whenUnknown: "needs-review",
                    negate: true,
                  },
                ],
              },
            ],
          },
          createdAt: t0,
          updatedAt: t0,
        },
      ],
    });
    expect(() => parseImportFile(file)).not.toThrow();
  });

  it("applies the size limits ordinary saves use", () => {
    const longNote = fullFile({
      extensionAccounts: [account("a", "me")],
      userNotes: [note("a", "x".repeat(4001), t1)],
    });
    expect(() => parseImportFile(longNote)).toThrow("longer than 4000");
    const longTemplate = fullFile({
      extensionAccounts: [account("a", "me")],
      messageTemplates: [{ ...template("a", "t", "x"), name: "n".repeat(81) }],
    });
    expect(() => parseImportFile(longTemplate)).toThrow("longer than 80");
    // V1-5: the event tracker's note and tag limits, so the editor can
    // save an imported record again.
    const listing = (fields: Record<string, unknown>) =>
      fullFile({
        extensionAccounts: [account("a", "me")],
        eventMetadata: [
          {
            id: "event:1234567",
            accountId: "a",
            eventId: "1234567",
            tags: [],
            attendance: "attending",
            createdAt: t0,
            updatedAt: t0,
            ...fields,
          },
        ],
      });
    expect(() => parseImportFile(listing({ tags: ["Friends"] }))).not.toThrow();
    expect(() =>
      parseImportFile(
        listing({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }),
      ),
    ).toThrow("more than 20 tags");
    expect(() => parseImportFile(listing({ tags: ["x".repeat(65)] }))).toThrow(
      "longer than 64",
    );
    expect(() => parseImportFile(listing({ note: "x".repeat(4001) }))).toThrow(
      "longer than 4000",
    );
    for (const field of ["title", "venueName"])
      expect(() =>
        parseImportFile(listing({ [field]: "x".repeat(301) })),
      ).toThrow(`${field} is longer than 300`);
  });

  it("refuses cached message text that is not normalized", () => {
    const observation = (normalizedText: string) =>
      fullFile({
        extensionAccounts: [account("a", "me")],
        messageObservations: [
          {
            id: "obs",
            accountId: "a",
            memberId: "1234567",
            observedAt: t0,
            normalizedText,
            createdAt: t0,
            updatedAt: t0,
          },
        ],
      });
    expect(() => parseImportFile(observation("HELLO THERE!"))).toThrow(
      "not in normalized form",
    );
    expect(
      parseImportFile(observation("hello there")).entities.messageObservations,
    ).toHaveLength(1);
  });

  it("imports only allowlisted settings, never a feature switch", async () => {
    const plan = await importText(
      fullFile(
        { extensionAccounts: [account("a", "me")] },
        {
          "joyfox.templatePicker": false,
          "joyfox.quickIgnoreDelete": true,
          "joyfox.diagnostics": true,
          "joyfox.triageRevision": "x",
        },
      ),
    );
    expect(plan.settingsAdded).toEqual([
      "joyfox.activeAccountId",
      "joyfox.templatePicker",
    ]);
    expect(plan.settingsSkipped).toEqual([
      "joyfox.diagnostics",
      "joyfox.quickIgnoreDelete",
    ]);
    expect(settings.items.has("joyfox.quickIgnoreDelete")).toBe(false);
    expect(settings.items.get("joyfox.templatePicker")).toBe(false);
  });

  it("imports a valid snapshot retention setting, and skips an invalid one (V1-12)", async () => {
    const plan = await importText(
      fullFile(
        { extensionAccounts: [account("a", "me")] },
        { "joyfox.snapshotRetention": 5 },
      ),
    );
    expect(plan.settingsAdded).toContain("joyfox.snapshotRetention");
    expect(settings.items.get("joyfox.snapshotRetention")).toBe(5);
    settings.items.delete("joyfox.snapshotRetention");
    const invalid = await importText(
      fullFile(
        { extensionAccounts: [account("a", "me")] },
        { "joyfox.snapshotRetention": 0 },
      ),
    );
    expect(invalid.settingsAdded).not.toContain("joyfox.snapshotRetention");
    expect(settings.items.has("joyfox.snapshotRetention")).toBe(false);
  });

  it("applies the snapshot limit to imported snapshots at once (V1-12)", async () => {
    const snapshots = Array.from({ length: 4 }, (_, index) => ({
      id: `snap-${index}`,
      accountId: "a",
      memberId: "1234567",
      capturedAt: new Date(Date.parse(t0) + index * 1000).toISOString(),
      verification: "unknown",
      photoCount: index,
      profileWordCount: "unknown",
      joinedAt: "unknown",
      createdAt: t0,
      updatedAt: t0,
    }));
    const ids = async () =>
      (await repositories.profileSnapshots.list("a"))
        .map(({ id }) => id)
        .sort();
    // A limit that comes with the file applies to the file's snapshots.
    await importText(
      fullFile(
        {
          extensionAccounts: [account("a", "me")],
          profileSnapshots: snapshots,
        },
        { "joyfox.snapshotRetention": 2 },
      ),
    );
    expect(await ids()).toEqual(["snap-2", "snap-3"]);
    // A limit already stored applies too, when the file brings none.
    await freshDatabase();
    settings = new MemorySettingsArea();
    data = new DataService(
      new AccountService(repositories.extensionAccounts, settings),
      settings,
    );
    await settings.set({ "joyfox.snapshotRetention": 1 });
    await importText(
      fullFile({
        extensionAccounts: [account("a", "me")],
        profileSnapshots: snapshots,
      }),
    );
    expect(await ids()).toEqual(["snap-3"]);
  });

  it("keeps the imported records when saving settings fails afterwards", async () => {
    const text = fullFile({ extensionAccounts: [account("a", "me")] });
    const plan = await data.previewImport(text);
    settings.set = () =>
      Promise.reject(new Error("synthetic settings failure"));
    const result = await data.applyImport(text, plan.signature);
    expect(result.settingsSaved).toBe(false);
    expect(await repositories.extensionAccounts.get("a", "a")).toBeDefined();
  });

  it("never replaces a stored sync endpoint", async () => {
    const sync = (endpoint: string, at: string) => ({
      id: "sync",
      accountId: "a",
      endpoint,
      keyDerivation: {
        algorithm: "PBKDF2",
        iterations: 600000,
        hash: "SHA-256",
        salt: "s",
      },
      createdAt: t0,
      updatedAt: at,
    });
    await repositories.extensionAccounts.put("a", account("a", "me"));
    await repositories.syncConfigs.put(
      "a",
      sync("https://mine.invalid", t0) as never,
    );
    await importText(
      fullFile({
        extensionAccounts: [account("a", "me")],
        syncConfigs: [sync("https://other.invalid", t2)],
      }),
    );
    expect((await repositories.syncConfigs.get("a", "sync"))?.endpoint).toBe(
      "https://mine.invalid",
    );
  });

  it("accepts a file from the older schema version 1", () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      scope: "all",
      entities: { extensionAccounts: [account("a", "me")] },
    });
    expect(parseImportFile(text).schemaVersion).toBe(1);
  });
});

describe("M8 import: language and schema version 4", () => {
  const classification = (reasons: unknown[]) => ({
    id: "classification:1234567",
    accountId: "a",
    memberId: "1234567",
    placement: "quarantined",
    source: "user",
    decidedAt: t1,
    reasons,
    createdAt: t1,
    updatedAt: t1,
  });
  const fileOf = (
    version: number,
    reasons: unknown[],
    fileSettings: Record<string, unknown> = {},
  ) =>
    JSON.stringify({
      ...JSON.parse(
        fullFile(
          {
            extensionAccounts: [account("a", "me")],
            conversationClassifications: [classification(reasons)],
          },
          fileSettings,
        ),
      ),
      schemaVersion: version,
    });

  it.each([2, 3])(
    "imports a version %i export with English reasons as messages",
    async (version) => {
      await importText(
        fileOf(version, [
          "You moved this sender to Quarantined.",
          "Something an older build wrote.",
        ]),
      );
      const [stored] = await repositories.conversationClassifications.list("a");
      expect(stored?.reasons).toEqual([
        {
          key: "triage.reason.userMoved",
          params: { placement: { key: "placement.quarantined" } },
        },
        {
          key: "legacy.text",
          params: { text: "Something an older build wrote." },
        },
      ]);
    },
  );

  it("refuses English reasons in a version 4 file, with a display message", () => {
    let refusal: unknown;
    try {
      parseImportFile(fileOf(4, ["You moved this sender to Quarantined."]));
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ExtensionError);
    const display = (refusal as ExtensionError).display;
    expect(display).toEqual({
      key: "error.import.invalid",
      params: {
        index: 1,
        entity: { key: "entity.conversationClassifications" },
      },
    });
    setLocale("de");
    expect(t(display!)).toBe("Eintrag 1 in „Eigene Einordnungen“ ist ungültig");
    setLocale("en");
  });

  it("gives every refusal a display message", () => {
    for (const text of [
      "{",
      JSON.stringify({ schemaVersion: 3, scope: "all" }),
      JSON.stringify({ schemaVersion: 9, scope: "all", entities: {} }),
      JSON.stringify({ schemaVersion: 3, scope: "x", entities: {} }),
      JSON.stringify({ schemaVersion: 3, scope: "all", entities: { x: [] } }),
      fullFile({ userNotes: [note("a", "x".repeat(5000), t0)] }),
      fullFile({ userNotes: [{ ...note("a", "x", t0), html: "<b>" }] }),
    ]) {
      let refusal: unknown;
      try {
        parseImportFile(text);
      } catch (error) {
        refusal = error;
      }
      expect(isMessage((refusal as ExtensionError).display), text).toBe(true);
    }
  });

  it("imports the language only when it is valid and none is stored", async () => {
    const plan = await importText(
      fullFile(
        { extensionAccounts: [account("a", "me")] },
        { [LOCALE_KEY]: "de" },
      ),
    );
    expect(plan.settingsAdded).toContain(LOCALE_KEY);
    expect(settings.items.get(LOCALE_KEY)).toBe("de");

    // A stored choice is never overwritten.
    await settings.set({ [LOCALE_KEY]: "en" });
    await importText(fullFile({}, { [LOCALE_KEY]: "de" }));
    expect(settings.items.get(LOCALE_KEY)).toBe("en");

    // An invalid value is never imported.
    settings.items.delete(LOCALE_KEY);
    const invalid = await importText(fullFile({}, { [LOCALE_KEY]: "fr" }));
    expect(invalid.settingsAdded).not.toContain(LOCALE_KEY);
    expect(settings.items.has(LOCALE_KEY)).toBe(false);
  });

  it("exports the language with the other settings", async () => {
    await settings.set({ [LOCALE_KEY]: "de" });
    const exported = await data.exportAll();
    expect(exported.schemaVersion).toBe(4);
    expect(exported.settings[LOCALE_KEY]).toBe("de");
  });
});
