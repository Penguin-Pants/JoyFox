// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  isOwnProfile,
  readPreferences,
  sharedPreferences,
} from "../../src/extraction/preferences";
import { checklist } from "../fixtures/preferences";

afterEach(() => {
  document.body.replaceChildren();
});

describe("V1-2 reading the preference checklist (13-preferences.md)", () => {
  it("lists the positive tags, sorted and unique, and every entry with its level", () => {
    document.body.append(
      checklist([
        {
          Unbedingt: ["Synthetic A", "Synthetic  B"],
          "Mag ich nicht so": ["Synthetic C"],
          "Möchte ich gerne ausprobieren": ["Synthetic D"],
          "Geht gar nicht": ["Synthetic E"],
        },
      ]),
    );
    const reading = readPreferences(document);
    if (reading.status !== "found") throw new Error(reading.status);
    expect(reading.positive).toEqual([
      "Synthetic A",
      "Synthetic B",
      "Synthetic D",
    ]);
    // Two copies of five tags.
    expect(reading.entries).toHaveLength(10);
    expect(
      reading.entries.find((entry) => entry.label === "Synthetic C")?.level,
    ).toBe("Mag ich nicht so");
  });

  it("counts a couple's tag when either partner has it at a positive level", () => {
    document.body.append(
      checklist([
        { "Steh ich drauf": ["Shared"], "Geht gar nicht": ["Split"] },
        { Situationsabhängig: ["Split"], "Mag ich nicht so": ["Neither"] },
      ]),
    );
    const reading = readPreferences(document);
    expect(reading).toMatchObject({
      status: "found",
      positive: ["Shared", "Split"],
    });
  });

  it("is missing without a checklist, and unreadable while a label is not drawn or a level is new", () => {
    expect(readPreferences(document)).toEqual({ status: "missing" });
    document.body.append(checklist([{ Unbedingt: ["Drawn", ""] }]));
    expect(readPreferences(document)).toEqual({ status: "unreadable" });
    document.body.replaceChildren(checklist([{ "Neue Stufe": ["Tag"] }]));
    expect(readPreferences(document)).toEqual({ status: "unreadable" });
    // A profile whose list has no level groups shares nothing.
    document.body.replaceChildren(checklist([{}]));
    expect(readPreferences(document)).toMatchObject({
      status: "found",
      positive: [],
    });
  });

  it("recognizes the viewer's own profile by its Account headline", () => {
    const headline = document.createElement("h2");
    headline.className = "profile-headline";
    headline.textContent = "Das mögen wir";
    document.body.append(headline);
    expect(isOwnProfile(document)).toBe(false);
    const own = headline.cloneNode() as HTMLElement;
    own.textContent = " Account ";
    document.body.append(own);
    expect(isOwnProfile(document)).toBe(true);
  });

  it("shares only labels both lists hold", () => {
    expect(sharedPreferences(["A", "B", "C"], ["C", "D", "A", "A"])).toEqual([
      "A",
      "C",
    ]);
    expect(sharedPreferences([], ["A"])).toEqual([]);
  });
});
