// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  isPlaced,
  placeInStrip,
  removeEmptyStrip,
  stripAnchor,
} from "../../src/content/member-strip";

const section = (name: string) => {
  const node = document.createElement("section");
  node.setAttribute("data-joyfox-ui", name);
  return node;
};

beforeEach(() => {
  document.body.innerHTML =
    '<div id="row" style="display: flex"><a id="header"></a><button></button></div><ul id="messages"></ul>';
});

describe("member strip", () => {
  it("follows the header's horizontal row", () => {
    const header = document.querySelector("#header")!;
    expect(stripAnchor(header)).toBe(document.querySelector("#row"));
  });

  it("keeps panel, notes and quick action in a fixed order, however they mount", () => {
    const header = document.querySelector("#header")!;
    const quick = section("quick-action");
    const notes = section("member-notes");
    const panel = section("member-panel");
    placeInStrip(document, header, quick);
    placeInStrip(document, header, notes);
    placeInStrip(document, header, panel);
    const strip = document.querySelector("#row")!.nextElementSibling!;
    expect(Array.from(strip.children)).toEqual([panel, notes, quick]);
    expect(strip.nextElementSibling).toBe(document.querySelector("#messages"));
    for (const node of [panel, notes, quick])
      expect(isPlaced(node, header)).toBe(true);
  });

  it("goes when its last section goes", () => {
    const header = document.querySelector("#header")!;
    const panel = section("member-panel");
    placeInStrip(document, header, panel);
    panel.remove();
    removeEmptyStrip(document);
    expect(
      document.querySelector('[data-joyfox-ui="member-strip"]'),
    ).toBeNull();
  });

  it("follows the header itself when the parent is not a row", () => {
    document.body.innerHTML = '<div id="col"><a id="header"></a></div>';
    const header = document.querySelector("#header")!;
    expect(stripAnchor(header)).toBe(header);
  });
});
