// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  placeInInboxLine,
  removeEmptyCardLines,
} from "../../src/content/card-line";
import contentCss from "../../src/content/content.css?raw";

const part = (name: string) => {
  const node = document.createElement("span");
  node.setAttribute("data-joyfox-ui", name);
  return node;
};
const row = () => document.querySelector(".cm-conversation-list-item")!;
const line = () => row().querySelector('[data-joyfox-ui="card-line"]');

beforeEach(() => {
  document.body.innerHTML =
    '<j-list-item class="cm-conversation-list-item">' +
    '<j-avatar-image slot="image"></j-avatar-image>' +
    '<div class="cm-conversation-list-item__line" id="name-line"><div>NAME</div></div>' +
    '<div slot="description" class="cm-conversation-list-item__line cm-conversation-list-item__line--description" id="description">TEXT</div>' +
    "</j-list-item>";
});

describe("the inbox row's JoyFox line", () => {
  it("keeps badge, shared count and signals in a fixed order, however they mount", () => {
    const signals = part("card-signals");
    const shared = part("compat-badge");
    const badge = part("badge");
    placeInInboxLine(row(), signals);
    placeInInboxLine(row(), shared);
    placeInInboxLine(row(), badge);
    expect(Array.from(line()!.children)).toEqual([badge, shared, signals]);
    expect(line()!.previousElementSibling?.id).toBe("name-line");
    expect(line()!.nextElementSibling?.id).toBe("description");
    expect(row().querySelectorAll('[data-joyfox-ui="card-line"]')).toHaveLength(
      1,
    );
  });

  it("goes when its last part goes", () => {
    const badge = part("badge");
    placeInInboxLine(row(), badge);
    badge.remove();
    removeEmptyCardLines(document);
    expect(line()).toBeNull();
  });

  it("follows the row's content when the row has no description line", () => {
    document.querySelector("#description")!.remove();
    placeInInboxLine(row(), part("badge"));
    expect(row().lastElementChild).toBe(line());
  });
});

describe("JoyFox's page styles", () => {
  beforeEach(() => {
    const style = document.createElement("style");
    style.textContent = contentCss;
    document.head.replaceChildren(style);
  });

  it("keeps the card line clickable inside an overlay without pointer events", () => {
    // Owner's live check, item 126: a click on the note button over a search
    // result's photo opened the profile instead.
    document.body.innerHTML =
      '<div style="pointer-events: none"><div class="joyfox-card-line" slot="media-overlay"></div></div>';
    const line = document.querySelector(".joyfox-card-line")!;
    expect(getComputedStyle(line).pointerEvents).toBe("auto");
    expect(getComputedStyle(line).zIndex).toBe("2");
  });

  it("shows the pointer only on a badge that is a button", () => {
    document.body.innerHTML =
      '<span class="joyfox-badge">3 shared</span><button class="joyfox-badge">Qualified</button>';
    const [label, control] = Array.from(
      document.querySelectorAll(".joyfox-badge"),
    );
    expect(getComputedStyle(label!).cursor).not.toBe("pointer");
    expect(getComputedStyle(control!).cursor).toBe("pointer");
  });

  it("draws a busy button like a disabled one", () => {
    document.body.innerHTML =
      '<button class="joyfox-button">Ready</button>' +
      '<button class="joyfox-button" aria-disabled="true">Busy</button>' +
      '<button class="joyfox-button" disabled>Off</button>';
    const [ready, busy, off] = Array.from(
      document.querySelectorAll(".joyfox-button"),
    ).map((node) => getComputedStyle(node));
    expect(ready!.cursor).toBe("pointer");
    for (const style of [busy!, off!]) {
      expect(style.cursor).toBe("default");
      expect(style.opacity).toBe("0.6");
    }
  });

  it("keeps placement, error and brand text at 4.5:1 on light and dark pages", () => {
    // jsdom keeps `color-mix()` unresolved, so the mix is computed here.
    const rules = Array.from(
      document.styleSheets[0]!.cssRules,
    ) as CSSStyleRule[];
    const declared = (selector: string, property: string) =>
      rules
        .find((rule) => rule.selectorText === selector)
        ?.style.getPropertyValue(property) ?? "";
    const token = (name: string) =>
      new RegExp(`--joyfox-${name}:\\s*(#[0-9a-f]{6})`).exec(contentCss)![1]!;
    /** The color and its share of a `color-mix(… X%, currentColor)`. */
    const mixOf = (value: string) => {
      const match =
        /^color-mix\(in srgb, var\(--joyfox-([\w-]+)(?:, currentColor)?\) (\d+)%, currentColor\)$/.exec(
          value,
        );
      if (!match) throw new Error(`Not a mix with the text color: ${value}`);
      return { name: match[1]!, share: Number(match[2]) / 100 };
    };
    const rgb = (hex: string) =>
      [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const mix = (a: number[], b: number[], share: number) =>
      a.map((value, index) => value * share + b[index]! * (1 - share));
    const luminance = (color: number[]) => {
      const [r, g, b] = color.map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light! + 0.05) / (dark! + 0.05);
    };
    // The pill mixes its own `--joyfox-pill`, set per placement.
    const pill = (placement: string) => ({
      what: `${placement} pill`,
      value: declared(".joyfox-pill", "color").replace(
        "var(--joyfox-pill, currentColor)",
        declared(
          `.joyfox-pill[data-placement="${placement}"]`,
          "--joyfox-pill",
        ).trim(),
      ),
    });
    const texts = [
      pill("qualified"),
      pill("needs-review"),
      pill("quarantined"),
      { what: "error", value: declared(".joyfox-error", "color") },
      {
        what: "brand",
        value: declared(".joyfox-bar__brand-accent", "color"),
      },
    ];
    // The page's text and background, and JoyFox's surfaces on them (up to
    // 12% of the text color).
    const pages = [
      { ink: rgb("#000000"), background: rgb("#ffffff") },
      { ink: rgb("#e6e6e6"), background: rgb("#1a1a1a") },
      { ink: rgb("#fbfbfe"), background: rgb("#1c1b22") },
    ];
    for (const { what, value } of texts) {
      const { name, share } = mixOf(value);
      for (const { ink, background } of pages)
        for (const surface of [0, 0.06, 0.12]) {
          const text = mix(rgb(token(name)), ink, share);
          expect(
            contrast(text, mix(ink, background, surface)),
            `${what} on ${background} with ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
    }
  });

  it("draws a JoyFox select's options in the system colours", () => {
    // Owner's live check: the page's light text on Firefox's white option
    // list. jsdom resolves the system colours to black on white.
    document.body.innerHTML =
      '<div style="color: rgb(255, 255, 255)"><select class="joyfox-listing__attendance"><option>No status</option></select></div>';
    const option = document.querySelector("option")!;
    expect(getComputedStyle(option).color).toBe("rgb(0, 0, 0)");
    expect(getComputedStyle(option).backgroundColor).toBe("rgb(255, 255, 255)");
  });
});
