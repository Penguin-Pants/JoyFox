// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { pageMember } from "../../src/content/member-panel";
import {
  isPlaced,
  placeInStrip,
  removeEmptyStrip,
  shownElement,
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

  it("keeps focus in a section when the strip moves to a new header row", () => {
    const header = document.querySelector("#header")!;
    const notes = section("member-notes");
    const field = document.createElement("textarea");
    notes.append(field);
    placeInStrip(document, header, notes);
    field.focus();
    // JoyClub rebuilds its header row; the next section placed moves the strip.
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div id="row2" style="display: flex"><a id="header2"></a></div>',
    );
    const header2 = document.querySelector("#header2")!;
    placeInStrip(document, header2, section("member-panel"));
    expect(isPlaced(notes, header2)).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  describe("a page that holds the member header twice", () => {
    // Live check, 2026-09-27: JoyClub's profile page has a second copy of
    // the header inside a container set to `display: none`. jsdom lays out
    // nothing, so the displayed copy is marked by its layout boxes.
    const shown = (element: Element) => {
      element.getClientRects = () =>
        [new DOMRect(0, 0, 100, 20)] as unknown as DOMRectList;
    };

    beforeEach(() => {
      window.history.replaceState(null, "", "/profile/2222222.synthetic.html");
      document.body.innerHTML =
        '<div id="hidden" style="display: none"><div data-e2e="profile-header-base-info" id="copy">NAME</div></div>' +
        '<div id="page"><div data-e2e="profile-header-base-info" id="header">NAME</div><p id="next"></p></div>';
    });

    it("anchors the strip on the copy the page displays", () => {
      shown(document.querySelector("#header")!);
      const member = pageMember(document, "profile")!;
      expect(member.anchor.id).toBe("header");
      expect(member.memberId).toBe("2222222");
      const panel = section("member-panel");
      placeInStrip(document, member.anchor, panel);
      const strip = panel.parentElement!;
      expect(strip.previousElementSibling?.id).toBe("header");
      expect(document.querySelector("#hidden")!.contains(strip)).toBe(false);
    });

    it("takes the first copy while none is displayed, and moves once one is", () => {
      expect(
        shownElement(document, '[data-e2e="profile-header-base-info"]')?.id,
      ).toBe("copy");
      const panel = section("member-panel");
      placeInStrip(document, pageMember(document, "profile")!.anchor, panel);
      shown(document.querySelector("#header")!);
      const anchor = pageMember(document, "profile")!.anchor;
      expect(isPlaced(panel, anchor)).toBe(false);
      placeInStrip(document, anchor, panel);
      expect(panel.parentElement!.previousElementSibling?.id).toBe("header");
    });
  });
});
