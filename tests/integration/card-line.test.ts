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

  it("gives standalone card signals the tokens used by their note button", () => {
    document.body.innerHTML =
      '<span class="joyfox-signals"><button class="joyfox-button joyfox-signals__note">Edit note</button></span>';
    const style = getComputedStyle(document.querySelector(".joyfox-signals")!);
    for (const token of ["--joyfox-focus", "--joyfox-surface-strong"])
      expect(style.getPropertyValue(token).trim(), token).not.toBe("");
  });

  it("keeps the card row's focus strokes inside its clipped bounds", () => {
    document.body.innerHTML =
      '<div class="joyfox-card-line"><button class="joyfox-button">Note</button><button class="joyfox-badge">Qualified</button></div>';
    for (const button of Array.from(document.querySelectorAll("button"))) {
      // Inspect the focused rules without relying on jsdom's focus state.
      // Chromium checks the rendered ring separately.
      const rules = Array.from(document.styleSheets[0]!.cssRules).filter(
        (rule): rule is CSSStyleRule =>
          "selectorText" in rule &&
          "style" in rule &&
          Boolean(
            (rule.style as CSSStyleDeclaration).getPropertyValue(
              "outline-offset",
            ),
          ) &&
          (rule.selectorText as string)
            .split(",")
            .some((selector) =>
              button.matches(selector.replace(":focus-visible", "").trim()),
            ),
      );
      const offset = rules
        .map((rule) => rule.style.getPropertyValue("outline-offset"))
        .filter(Boolean)
        .at(-1);
      // The 16 px control has only 1 px clearance in the accepted 18 px row.
      // Its 2 px focus stroke must not extend beyond the control's border.
      expect(parseFloat(offset ?? ""), button.className).toBeLessThanOrEqual(
        -2,
      );
    }
  });

  it("keeps empty live regions exposed before their first message", () => {
    for (const name of [
      "template-picker",
      "saved-searches",
      "listing",
      "card-editor",
    ]) {
      const status = document.createElement("p");
      status.className = `joyfox-${name}__status`;
      status.setAttribute("role", "status");
      document.body.append(status);
      expect(getComputedStyle(status).display, name).not.toBe("none");
      expect(getComputedStyle(status).visibility, name).not.toBe("hidden");
      const emptyRule = Array.from(document.styleSheets[0]!.cssRules).find(
        (rule): rule is CSSStyleRule =>
          "selectorText" in rule &&
          rule.selectorText === `.joyfox-${name}__status:empty`,
      );
      expect(emptyRule?.style.margin, name).toBe("0");
      status.textContent = "Saved";
      expect(getComputedStyle(status).display, name).not.toBe("none");
    }
  });

  it("gives editable field boundaries at least 3:1 on light and dark surfaces", () => {
    const rules = Array.from(document.styleSheets[0]!.cssRules).filter(
      (rule): rule is CSSStyleRule => "selectorText" in rule,
    );
    const share = (token: string) => {
      const value = rules
        .map((rule) => rule.style.getPropertyValue(token))
        .find(Boolean);
      const match = /currentColor (\d+)%/.exec(value ?? "");
      expect(match, token).not.toBeNull();
      return Number(match![1]) / 100;
    };
    for (const selector of [
      ".joyfox-notes__text",
      ".joyfox-notes__tag-input",
      ".joyfox-saved-searches__name",
      ".joyfox-listing__note",
      ".joyfox-listing__tag-input",
      ".joyfox-listing__attendance",
      ".joyfox-event-filter__select",
    ]) {
      const rule = rules.find(
        (rule) =>
          rule.style.border &&
          rule.selectorText.split(",").some((part) => part.trim() === selector),
      );
      expect(rule?.style.border, selector).toContain(
        "var(--joyfox-field-line)",
      );
    }
    const luminance = (channel: number) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const mix = (ink: number, background: number, amount: number) =>
      ink * amount + background * (1 - amount);
    for (const [ink, page] of [
      [0, 255],
      [230, 26],
      [251, 28],
    ] as const) {
      // Fields can sit in a panel and its drawer, or on an opaque editor.
      for (const layers of [0, 1, 2]) {
        let surface: number = page;
        for (let layer = 0; layer < layers; layer++)
          surface = mix(ink, surface, share("--joyfox-surface"));
        const field = mix(ink, surface, share("--joyfox-field"));
        const border = mix(ink, field, share("--joyfox-field-line"));
        for (const adjacent of [surface, field]) {
          const values = [luminance(border), luminance(adjacent)].sort(
            (a, b) => b - a,
          );
          expect(
            (values[0]! + 0.05) / (values[1]! + 0.05),
            `${ink} on ${page}, ${layers} layers`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
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
