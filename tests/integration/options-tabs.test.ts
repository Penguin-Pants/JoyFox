// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import html from "../../src/options/options.html?raw";
import { OptionsTabs } from "../../src/options/tabs";

const tab = (name: string) =>
  document.querySelector<HTMLAnchorElement>(`[role="tab"][href="#${name}"]`)!;
const panel = (name: string) =>
  document.getElementById(tab(name).getAttribute("aria-controls")!)!;
const shownPanels = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'))
    .filter((node) => !node.hidden)
    .map((node) => node.id);

function mount(hash = ""): OptionsTabs {
  window.history.replaceState(null, "", `/options.html${hash}`);
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  return new OptionsTabs(
    document,
    document.querySelector<HTMLElement>('[role="tablist"]')!,
  );
}

const key = (name: string) =>
  document.activeElement!.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true }),
  );

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("options tabs", () => {
  it("has one tab and one panel per section, each panel holding its section", () => {
    mount();
    const names = Array.from(
      document.querySelectorAll('[role="tab"]'),
      (node) => node.getAttribute("href"),
    );
    expect(names).toEqual([
      "#start",
      "#accounts",
      "#rule",
      "#templates",
      "#data",
    ]);
    for (const [name, section] of [
      ["start", "joyfox-get-started"],
      ["accounts", "joyfox-accounts"],
      ["rule", "joyfox-rule"],
      ["templates", "joyfox-templates"],
      ["data", "joyfox-data"],
    ] as const) {
      expect(panel(name).querySelector(`#${section}`)).not.toBeNull();
      expect(panel(name).getAttribute("aria-labelledby")).toBe(tab(name).id);
    }
  });

  it("shows only Get started at first", () => {
    const tabs = mount();
    expect(tabs.selected).toBe("start");
    expect(shownPanels()).toEqual(["panel-start"]);
    expect(tab("start").getAttribute("aria-selected")).toBe("true");
    expect(tab("start").tabIndex).toBe(0);
    expect(tab("rule").tabIndex).toBe(-1);
  });

  it("opens the tab named in the address, and ignores an unknown one", () => {
    expect(mount("#data").selected).toBe("data");
    expect(shownPanels()).toEqual(["panel-data"]);
    expect(mount("#nothing").selected).toBe("start");
  });

  it("switches on a click and puts the tab in the address", () => {
    const tabs = mount();
    tab("rule").click();
    expect(tabs.selected).toBe("rule");
    expect(shownPanels()).toEqual(["panel-rule"]);
    expect(window.location.hash).toBe("#rule");
  });

  it("follows a link to a tab, such as the Get started steps", () => {
    const tabs = mount();
    window.location.hash = "#accounts";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(tabs.selected).toBe("accounts");
    expect(shownPanels()).toEqual(["panel-accounts"]);
  });

  it("moves with the arrow keys, Home and End, wrapping at the ends", () => {
    const tabs = mount();
    tab("start").focus();
    key("ArrowLeft");
    expect(tabs.selected).toBe("data");
    expect(document.activeElement).toBe(tab("data"));
    key("ArrowRight");
    expect(tabs.selected).toBe("start");
    key("End");
    expect(tabs.selected).toBe("data");
    key("Home");
    expect(tabs.selected).toBe("start");
  });
});
