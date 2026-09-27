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
