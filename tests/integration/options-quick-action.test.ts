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
const status = () => root.querySelector('[role="status"]')?.textContent ?? "";

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

  it("says so and keeps the old state when the setting cannot be saved", async () => {
    await panel.render();
    settings.set = () => Promise.reject(new Error("unavailable"));
    toggle().click();
    await flush();
    expect(toggle().checked).toBe(false);
    expect(status()).toBe("JoyFox could not save this setting. Try again.");
  });

  it("counts an unreadable setting as off, and speaks German", async () => {
    settings.get = () => Promise.reject(new Error("unavailable"));
    setLocale("de");
    await panel.render();
    expect(toggle().checked).toBe(false);
    expect(root.textContent).toContain("Ignorieren und löschen");
  });
});
