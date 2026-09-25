// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { reportOperation } from "../../src/actions/ignore-delete";
import { InboxTriage } from "../../src/content/inbox-triage";
import { MemberNotes, type NotesClient } from "../../src/content/member-notes";
import { MemberPanel } from "../../src/content/member-panel";
import {
  QuickIgnoreDelete,
  type QuickActionClient,
} from "../../src/content/quick-action";
import type { TriageClient } from "../../src/content/triage-client";
import {
  TemplatePicker,
  type TemplateClient,
} from "../../src/content/template-picker";
import type { QuickActionDriver } from "../../src/actions/executor";
import { LOCALE_KEY } from "../../src/i18n/locale";
import { setLocale } from "../../src/i18n/translator";
import type { ContactRuleDefinition } from "../../src/rules/contact-rule";
import { RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { TemplateService } from "../../src/templates/template-service";
import { TriageService } from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { englishFragments, leakedEnglish, shownText } from "../i18n-text";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import optionsHtml from "../../src/options/options.html?raw";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import inboxHtml from "../fixtures/joyclub/inbox.html?raw";

type Listener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  area: string,
) => void;

/**
 * A stand-in for the `browser` global: `storage.local` with its change
 * event, delivered after the write as Firefox does, and Firefox's language.
 */
function fakeBrowser(language: string) {
  const items = new Map<string, unknown>();
  const listeners = new Set<Listener>();
  const emit = (changes: Parameters<Listener>[0]) =>
    setTimeout(() => {
      for (const listener of listeners) listener(changes, "local");
    }, 0);
  return {
    items,
    i18n: { getUILanguage: () => language },
    storage: {
      onChanged: {
        addListener: (listener: Listener) => listeners.add(listener),
        removeListener: (listener: Listener) => listeners.delete(listener),
      },
      local: {
        get(keys: string[] | null) {
          const all = Object.fromEntries(items);
          return Promise.resolve(
            keys === null
              ? all
              : Object.fromEntries(
                  keys.filter((key) => items.has(key)).map((k) => [k, all[k]]),
                ),
          );
        },
        set(values: Record<string, unknown>) {
          const changes: Parameters<Listener>[0] = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: items.get(key), newValue: value };
            items.set(key, value);
          }
          emit(changes);
          return Promise.resolve();
        },
        remove(keys: string[]) {
          const changes: Parameters<Listener>[0] = {};
          for (const key of keys) {
            changes[key] = { oldValue: items.get(key) };
            items.delete(key);
          }
          emit(changes);
          return Promise.resolve();
        },
        clear() {
          const changes: Parameters<Listener>[0] = {};
          for (const [key, value] of items) changes[key] = { oldValue: value };
          items.clear();
          emit(changes);
          return Promise.resolve();
        },
      },
    },
  };
}

const rule = (): ContactRuleDefinition => ({
  schemaVersion: 1,
  audience: "all",
  enabled: true,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match: "all",
    children: [
      { type: "condition", kind: "personallyKnown", whenUnknown: "not-met" },
      {
        type: "condition",
        kind: "minimumPhotos",
        value: 3,
        whenUnknown: "needs-review",
      },
    ],
  },
});

let fragments: string[];
beforeAll(() => {
  fragments = englishFragments();
});

/** Closes the database the re-imported options page opened. */
let closeOptionsDatabase: (() => Promise<void>) | undefined;

afterEach(async () => {
  setLocale("en");
  await closeOptionsDatabase?.();
  closeOptionsDatabase = undefined;
  vi.unstubAllGlobals();
});

/** Load the options page as Firefox does: its HTML, then its script. */
async function openOptionsPage(): Promise<void> {
  const parsed = new DOMParser().parseFromString(optionsHtml, "text/html");
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement,
  );
  vi.resetModules();
  await import("../../src/options/index");
  const database = await import("../../src/storage/database");
  closeOptionsDatabase = database.resetDatabaseConnectionForTests;
}

/** The English catalog text a German page still shows; none is expected. */
const leaks = (roots: Iterable<Element>) =>
  leakedEnglish(shownText(roots), fragments);

describe("options page (docs/i18n-spec.md, Sections 3.7 to 3.9)", () => {
  it("switches every panel at once, keeps unsaved input and adds no copies", async () => {
    await freshDatabase();
    const browser = fakeBrowser("en-US");
    vi.stubGlobal("browser", browser);
    const account = await new AccountService().createAccount({
      joyClubAccountId: "synthetic-login",
    });
    await new RuleService().saveGlobalRule(account.id, rule());
    await new TemplateService().save(account.id, {
      name: "Samstag",
      body: "Bis Samstag!",
    });
    await openOptionsPage();

    const heading = (id: string) =>
      document.querySelector(`#${id} h2`)?.textContent;
    await vi.waitFor(() => {
      expect(heading("joyfox-accounts")).toBe("Accounts");
      expect(document.querySelector("#joyfox-rule form")).not.toBeNull();
      expect(document.querySelector("#joyfox-templates form")).not.toBeNull();
      expect(heading("joyfox-data")).toBe("Your data");
    });
    const language =
      document.querySelector<HTMLSelectElement>("#joyfox-language")!;
    // The default follows Firefox, and nothing is stored until a choice.
    expect(language.value).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(browser.items.has(LOCALE_KEY)).toBe(false);

    // Unsaved input in three editors, one of them a number not valid yet.
    const field = (id: string) =>
      document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    field("joyfox-account-identifier").value = "typed-login";
    field("joyfox-template-name").value = "Entwurf";
    field("joyfox-template-body").value = "Noch nicht gespeichert";
    field("joyfox-rule-all-minimumPhotos-value").value = "999999999";
    // A phrase with spaces the save would trim: a redraw keeps it as typed.
    field("joyfox-rule-any-firstMessageContains-text").value = "  Hallo du ";

    // The guard sees English while English is shown.
    expect(leaks([document.body]).length).toBeGreaterThan(20);

    language.value = "de";
    language.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe("de");
      expect(heading("joyfox-accounts")).toBe("Konten");
      expect(heading("joyfox-get-started")).toBe("Erste Schritte");
      expect(heading("joyfox-rule")).toBe("Kontaktregel");
      expect(heading("joyfox-templates")).toBe("Nachrichtenvorlagen");
      expect(heading("joyfox-data")).toBe("Deine Daten");
    });
    expect(browser.items.get(LOCALE_KEY)).toBe("de");
    expect(document.title).toBe("JoyFox-Einstellungen");
    expect(
      Array.from(document.querySelectorAll('[role="tab"]'), (tab) =>
        tab.textContent?.trim(),
      ),
    ).toEqual([
      "Erste Schritte",
      "Konten",
      "Kontaktregel",
      "Vorlagen",
      "Deine Daten",
    ]);
    // The toggle itself is never translated.
    expect(
      document.querySelector('label[for="joyfox-language"]')?.textContent,
    ).toBe("Sprache / Language");
    // No panel was added twice.
    for (const id of [
      "joyfox-get-started",
      "joyfox-accounts",
      "joyfox-rule",
      "joyfox-templates",
      "joyfox-data",
    ])
      expect(document.querySelectorAll(`#${id} h2`)).toHaveLength(1);
    expect(document.querySelectorAll("#joyfox-rule form")).toHaveLength(1);
    expect(document.querySelectorAll("#joyfox-templates form")).toHaveLength(1);
    expect(
      document.querySelectorAll("#joyfox-import input[type=file]"),
    ).toHaveLength(1);
    // Typed text stayed.
    expect(field("joyfox-account-identifier").value).toBe("typed-login");
    expect(field("joyfox-template-name").value).toBe("Entwurf");
    expect(field("joyfox-template-body").value).toBe("Noch nicht gespeichert");
    expect(field("joyfox-rule-all-minimumPhotos-value").value).toBe(
      "999999999",
    );
    expect(field("joyfox-rule-any-firstMessageContains-text").value).toBe(
      "  Hallo du ",
    );
    // Dates and numbers follow the language.
    expect(
      document.querySelector(
        '[data-entity="messageTemplates"] .joyfox-data__count',
      )?.textContent,
    ).toBe("1");

    // Leak guard: every panel, in the simple and the advanced editor.
    expect(leaks([document.body])).toEqual([]);
    const advanced = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>("#joyfox-rule button"),
      )
        .find((button) => button.textContent === "Erweitert")!
        .click();
    // The number typed before the switch is still refused, now in German.
    advanced();
    expect(
      document.querySelector("#joyfox-rule [role=alert]")?.textContent,
    ).toBe(
      "Gib für „Mindestanzahl Fotos“ eine ganze Zahl von 0 bis 100.000 ein.",
    );
    field("joyfox-rule-all-minimumPhotos-value").value = "3";
    advanced();
    expect(document.querySelector(".joyfox-rule__rules")).not.toBeNull();
    expect(leaks([document.body])).toEqual([]);

    // And back, through the same path.
    language.value = "en";
    language.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(heading("joyfox-accounts")).toBe("Accounts");
    });
    expect(field("joyfox-template-name").value).toBe("Entwurf");
  });

  it("starts in German when Firefox is German, and again after the choice is cleared", async () => {
    await freshDatabase();
    const browser = fakeBrowser("de-AT");
    vi.stubGlobal("browser", browser);
    await openOptionsPage();
    await vi.waitFor(() =>
      expect(document.querySelector("#joyfox-accounts h2")?.textContent).toBe(
        "Konten",
      ),
    );
    const language =
      document.querySelector<HTMLSelectElement>("#joyfox-language")!;
    expect(language.value).toBe("de");

    await browser.storage.local.set({ [LOCALE_KEY]: "en" });
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    // "Delete all JoyFox data" clears the key: the default applies again.
    await browser.storage.local.clear();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("de"));
    expect(language.value).toBe("de");
  });
});

describe("content surfaces (docs/i18n-spec.md, Sections 3.7 and 6)", () => {
  const ACCOUNT = "account-a";
  const MEMBER = "1234567";
  let triage: TriageService;
  let trust: TrustService;

  async function setUp(): Promise<TriageClient> {
    await freshDatabase();
    const settings = new MemorySettingsArea();
    const rules = new RuleService(undefined, settings);
    triage = new TriageService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settings,
    );
    trust = new TrustService(undefined, undefined, settings);
    await repositories.extensionAccounts.put(ACCOUNT, {
      id: ACCOUNT,
      accountId: ACCOUNT,
      joyClubAccountId: "synthetic-login",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    });
    await rules.saveGlobalRule(ACCOUNT, rule());
    return {
      evaluate: (members) => triage.evaluate(ACCOUNT, members),
      setOverride: (accountId, memberId, placement) =>
        triage.setOverride(accountId, memberId, placement),
      getTrust: (memberId, observed) =>
        triage.trustFor(ACCOUNT, memberId, observed),
      logTrust: (accountId, memberId, kind) =>
        trust.logOutcome(accountId, memberId, kind).then(() => undefined),
      undoTrust: (accountId, memberId) =>
        trust.undoLastOutcome(accountId, memberId).then(() => undefined),
      captureSnapshot: (accountId, memberId, observed) =>
        triage
          .captureSnapshot(accountId, memberId, observed)
          .then(() => undefined),
      openOptions: () => Promise.resolve(),
    };
  }

  const joyfox = () =>
    Array.from(document.querySelectorAll("[data-joyfox-ui]"));

  it("redraws the inbox triage in German, with no duplicate nodes", async () => {
    const client = await setUp();
    window.history.replaceState(null, "", "/clubmail/");
    document.body.innerHTML = inboxHtml;
    const inbox = new InboxTriage(document, client);
    inbox.update();
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-joyfox-ui="triage-bar"]'),
      ).not.toBeNull(),
    );
    // Open the details of the first row, so its explanation is drawn.
    document
      .querySelector<HTMLButtonElement>('[data-joyfox-ui="badge"]')!
      .click();
    await vi.waitFor(() =>
      expect(document.querySelector(".joyfox-explain")).not.toBeNull(),
    );
    const badges = document.querySelectorAll('[data-joyfox-ui="badge"]').length;
    expect(leaks(joyfox()).length).toBeGreaterThan(5);
    const conditions = () =>
      document.querySelector<HTMLDetailsElement>(".joyfox-explain__conditions");
    conditions()!.open = true;

    setLocale("de");
    inbox.localeChanged();
    // The section the user opened stays open.
    expect(conditions()?.open).toBe(true);
    const bar = document.querySelector('[data-joyfox-ui="triage-bar"]')!;
    expect(
      document.querySelectorAll('[data-joyfox-ui="triage-bar"]'),
    ).toHaveLength(1);
    expect(document.querySelectorAll('[data-joyfox-ui="badge"]')).toHaveLength(
      badges,
    );
    expect(bar.querySelector(".joyfox-triage__view")?.textContent).toBe(
      "Posteingang",
    );
    expect(bar.getAttribute("aria-label")).toBe("JoyFox-Sortierung");
    await vi.waitFor(() =>
      expect(document.querySelector(".joyfox-explain")?.textContent).toContain(
        "Einordnung:",
      ),
    );
    expect(leaks(joyfox())).toEqual([]);
  });

  it("keeps an inbox save failure on screen across a switch", async () => {
    const client = await setUp();
    client.setOverride = () => Promise.reject(new Error("synthetic failure"));
    window.history.replaceState(null, "", "/clubmail/");
    document.body.innerHTML = inboxHtml;
    const inbox = new InboxTriage(document, client);
    inbox.update();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-joyfox-ui="badge"]')).not.toBeNull(),
    );
    document
      .querySelector<HTMLButtonElement>('[data-joyfox-ui="badge"]')!
      .click();
    await vi.waitFor(() =>
      expect(document.querySelector(".joyfox-explain")).not.toBeNull(),
    );
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".joyfox-explain button"),
    )
      .find((button) => !button.disabled)!
      .click();
    const error = () =>
      document.querySelector(".joyfox-triage__details .joyfox-error")
        ?.textContent;
    await vi.waitFor(() =>
      expect(error()).toBe(
        "JoyFox could not save that change. Nothing was changed.",
      ),
    );
    setLocale("de");
    inbox.localeChanged();
    expect(error()).toBe(
      "JoyFox konnte diese Änderung nicht speichern. Es wurde nichts geändert.",
    );
    expect(
      document.querySelectorAll(".joyfox-triage__details .joyfox-error"),
    ).toHaveLength(1);
  });

  it("redraws the member panel, notes, Ignore and Delete and the picker, keeping typed text", async () => {
    const client = await setUp();
    await trust.logOutcome(ACCOUNT, MEMBER, "positive");
    await triage.setOverride(ACCOUNT, MEMBER, "needs-review");
    window.history.replaceState(
      null,
      "",
      "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321",
    );
    document.body.innerHTML = conversationHtml;

    const panel = new MemberPanel(document, client);
    const notesClient: NotesClient = {
      getNotes: () =>
        Promise.resolve({
          status: "ok",
          accountId: ACCOUNT,
          note: "Gespeichert",
          tags: ["Kaffee"],
        }),
      saveNote: () => Promise.resolve({ status: "saved", current: null }),
      addTag: () => Promise.resolve(true),
      removeTag: () => Promise.resolve(true),
    };
    const notes = new MemberNotes(document, notesClient);
    const stopped = reportOperation(
      {
        steps: [
          { name: "Started", ok: true, at: "2026-09-25T10:00:00.000Z" },
          { name: "DeleteRequested", ok: true, at: "2026-09-25T10:00:01.000Z" },
          {
            name: "Failed",
            ok: false,
            at: "2026-09-25T10:00:02.000Z",
            errorCode: "confirmation-missing",
          },
        ],
        updatedAt: "2026-09-25T10:00:02.000Z",
      },
      Date.parse("2026-09-25T10:00:03.000Z"),
    );
    const quickClient = {
      latest: () =>
        Promise.resolve({
          status: "ok",
          accountId: ACCOUNT,
          conversationId: "personal-1234567-7654321",
          updatedAt: "2026-09-25T10:00:02.000Z",
          report: stopped,
        }),
      recorder: () => ({}) as never,
      handOff: () => Promise.resolve(),
      pending: () => Promise.resolve({ status: "none" }),
    } as QuickActionClient;
    const quick = new QuickIgnoreDelete(
      document,
      quickClient,
      () => ({}) as QuickActionDriver,
    );
    const templateClient: TemplateClient = {
      listTemplates: () =>
        Promise.resolve({
          accountId: ACCOUNT,
          templates: [
            { id: "template:1", name: "Hallo", folder: "", body: "Hallo!" },
          ],
        }),
      openOptions: () => Promise.resolve(),
    };
    const picker = new TemplatePicker(document, templateClient);

    panel.update("conversation");
    notes.update("conversation");
    quick.update();
    picker.update();
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-joyfox-ui="member-panel"]'),
      ).not.toBeNull();
      expect(
        document.querySelector('[data-joyfox-ui="member-notes"]'),
      ).not.toBeNull();
      expect(
        document.querySelector('[data-joyfox-ui="quick-action"] li'),
      ).not.toBeNull();
    });
    // Open everything a user can open: the drawer and its sections, the
    // editor, the picker.
    document.querySelector<HTMLButtonElement>(".joyfox-bar__toggle")!.click();
    for (const section of Array.from(
      document.querySelectorAll<HTMLDetailsElement>(".joyfox-drawer details"),
    ))
      section.open = true;
    const openInDrawer = () =>
      Array.from(
        document.querySelectorAll<HTMLDetailsElement>(".joyfox-drawer details"),
        (section) => [section.className, section.open],
      );
    const drawerSections = openInDrawer();
    expect(drawerSections.length).toBeGreaterThan(1);
    const editor = document.querySelector<HTMLDetailsElement>(
      ".joyfox-notes__details",
    )!;
    editor.open = true;
    editor.dispatchEvent(new Event("toggle"));
    const box = document.querySelector<HTMLTextAreaElement>(
      ".joyfox-notes__text",
    )!;
    box.value = "Noch nicht gespeichert";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    document
      .querySelector<HTMLButtonElement>(".joyfox-template-picker__toggle")!
      .click();
    await vi.waitFor(() =>
      expect(
        document.querySelector(".joyfox-template-picker__item"),
      ).not.toBeNull(),
    );
    const count = (ui: string) =>
      document.querySelectorAll(`[data-joyfox-ui="${ui}"]`).length;
    const before = [
      "member-panel",
      "member-notes",
      "quick-action",
      "template-picker",
    ].map(count);

    expect(leaks(joyfox()).length).toBeGreaterThan(10);

    setLocale("de");
    panel.localeChanged();
    notes.localeChanged();
    quick.localeChanged();
    picker.localeChanged();
    await vi.waitFor(() => {
      expect(
        document.querySelector(".joyfox-template-picker__folder")?.textContent,
      ).toBe("Allgemein");
      expect(
        document.querySelector(".joyfox-explain__placement")?.textContent,
      ).toContain("Einordnung: Zu prüfen");
    });
    expect(
      ["member-panel", "member-notes", "quick-action", "template-picker"].map(
        count,
      ),
    ).toEqual(before);
    // The open editor keeps its text and stays open; the drawer stays open.
    const redrawn = document.querySelector<HTMLTextAreaElement>(
      ".joyfox-notes__text",
    )!;
    expect(redrawn.value).toBe("Noch nicht gespeichert");
    expect(
      document.querySelector<HTMLDetailsElement>(".joyfox-notes__details")
        ?.open,
    ).toBe(true);
    expect(document.querySelector<HTMLElement>(".joyfox-drawer")?.hidden).toBe(
      false,
    );
    expect(openInDrawer()).toEqual(drawerSections);
    // A German date, and JoyClub's own German label for its control.
    expect(document.querySelector(".joyfox-explain")?.textContent).toMatch(
      /am \d{2}\.\d{2}\.\d{4} verschoben/u,
    );
    expect(
      document.querySelector('[data-joyfox-ui="quick-action"]')?.textContent,
    ).toContain("„In den Papierkorb schieben“");
    expect(leaks(joyfox())).toEqual([]);
  });
});
