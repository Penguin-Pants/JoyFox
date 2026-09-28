// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QUICK_ACTION_KEY } from "../../src/actions/quick-action-setting";
import { setLocale } from "../../src/i18n/translator";
import { QuickActionPanel } from "../../src/options/quick-action-panel";
import { MemorySettingsArea } from "../memory-settings";

// Owner request, 2026-09-27: turn Ignore and Delete on and off on the options
// page, never through the console.
let settings: MemorySettingsArea;
let root: HTMLElement;
let panel: QuickActionPanel;

const flush = async () => {
  for (let round = 0; round < 10; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};
const toggle = () =>
  root.querySelector<HTMLInputElement>("#joyfox-quick-action-toggle")!;
const statusNode = () =>
  root.querySelector<HTMLElement>(".joyfox-panel__status")!;
const status = () => statusNode().textContent ?? "";
/** The text of every node the switch names as its description. */
const description = () =>
  (toggle().getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => root.querySelector(`#${id}`)?.textContent ?? "");

beforeEach(() => {
  settings = new MemorySettingsArea();
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
  panel = new QuickActionPanel(root, settings);
});

afterEach(() => setLocale("en"));

describe("the Ignore and Delete switch on the options page", () => {
  it("is off by default, and turns the button on and off", async () => {
    await panel.render();
    expect(root.textContent).toContain(
      'Show the "Ignore and Delete" button on ClubMail conversations',
    );
    expect(toggle().checked).toBe(false);
    expect(root.querySelector("label")?.contains(toggle())).toBe(true);

    toggle().click();
    await flush();
    expect(settings.items.get(QUICK_ACTION_KEY)).toBe(true);
    expect(toggle().checked).toBe(true);
    expect(status()).toBe("Saved. Open ClubMail tabs follow at once.");
    expect(statusNode().getAttribute("role")).toBe("status");
    expect(statusNode().dataset.kind).toBe("info");
    // The keyboard stays on the switch after the redraw.
    expect(document.activeElement).toBe(toggle());

    toggle().click();
    await flush();
    expect(settings.items.get(QUICK_ACTION_KEY)).toBe(false);
    expect(toggle().checked).toBe(false);
  });

  it("shows the stored choice, and counts only true as on", async () => {
    await settings.set({ [QUICK_ACTION_KEY]: true });
    await panel.render();
    expect(toggle().checked).toBe(true);
    await settings.set({ [QUICK_ACTION_KEY]: "yes" });
    await panel.render();
    expect(toggle().checked).toBe(false);
  });

  it("says so as an error and keeps the old state when the setting cannot be saved", async () => {
    await panel.render();
    const save = settings.set.bind(settings);
    settings.set = () => Promise.reject(new Error("unavailable"));
    toggle().click();
    await flush();
    expect(toggle().checked).toBe(false);
    expect(status()).toBe("JoyFox could not save this setting. Try again.");
    // An error, styled and announced as one, not as a plain status.
    expect(statusNode().dataset.kind).toBe("error");
    expect(statusNode().getAttribute("role")).toBe("alert");
    expect(document.activeElement).toBe(toggle());

    // The next save that works replaces the error.
    settings.set = save;
    toggle().click();
    await flush();
    expect(status()).toBe("Saved. Open ClubMail tabs follow at once.");
    expect(statusNode().dataset.kind).toBe("info");
  });

  it("keeps one status node across redraws, so its message is not lost", async () => {
    await panel.render();
    toggle().click();
    await flush();
    const node = statusNode();
    // Another tab's change, or the page's own storage.onChanged, redraws.
    await panel.render();
    expect(statusNode()).toBe(node);
    expect(root.querySelectorAll(".joyfox-panel__status")).toHaveLength(1);
    expect(status()).toBe("Saved. Open ClubMail tabs follow at once.");
    // A language change shows the same message in the new language.
    setLocale("de");
    await panel.render();
    expect(statusNode()).toBe(node);
    expect(status()).toBe("Gespeichert. Offene ClubMail-Tabs folgen sofort.");
  });

  it("describes the switch with the risk, where it works and how to undo it", async () => {
    await panel.render();
    const [hint, risk, undo] = description();
    expect(hint).toContain("off by default");
    expect(hint).toContain(
      "It works only while the ClubMail list shows beside the conversation.",
    );
    // Named as the "Your data" table names it.
    expect(hint).toContain(
      'The "Action log" in "Your data" records every step.',
    );
    expect(hint).not.toContain("ActionLog");
    expect(risk).toBe(
      "If JoyClub finds a tool that clicks for you, it can restrict or close your account. Of all JoyFox features, this one has the highest risk.",
    );
    expect(undo).toContain("restore the conversation from JoyClub's trash");
    // JoyClub's own German label, in either language.
    expect(undo).toContain('"Profil nicht mehr ignorieren"');

    setLocale("de");
    await panel.render();
    const [germanHint, germanRisk, germanUndo] = description();
    expect(germanHint).toContain("„Aktionsprotokoll“ unter „Deine Daten“");
    expect(germanHint).toContain("ClubMail-Liste neben der Unterhaltung");
    expect(germanRisk).toContain(
      "kann dein Konto eingeschränkt oder geschlossen werden",
    );
    expect(germanUndo).toContain("„Profil nicht mehr ignorieren“");
    expect(germanUndo).toContain("Papierkorb");
  });

  it("counts an unreadable setting as off, and speaks German", async () => {
    settings.get = () => Promise.reject(new Error("unavailable"));
    setLocale("de");
    await panel.render();
    expect(toggle().checked).toBe(false);
    expect(root.textContent).toContain("Ignorieren und löschen");
  });
});
