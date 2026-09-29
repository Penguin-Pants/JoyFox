// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { decodeTypes } from "../../src/content/profile-type-filter";
import { cardProfileType } from "../../src/extraction/joyclub";

const card = (attributes: Record<string, string>) => {
  const node = document.createElement("j-member-card");
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, value);
  return node;
};

describe("V1-14 card profile type", () => {
  it("reads the card's own universal-gender code (17-my-joy-lists.md)", () => {
    expect(cardProfileType(card({ "universal-gender": "1" }))).toBe("man");
    expect(cardProfileType(card({ "universal-gender": "2" }))).toBe("woman");
    // A couple is one card code, 3, not two icons.
    expect(cardProfileType(card({ "universal-gender": "3" }))).toBe("couple");
    expect(cardProfileType(card({ "universal-gender": " 2 " }))).toBe("woman");
  });

  it("reads anything else as unknown", () => {
    // Seen on "Besuchte Profile": a card without a code.
    expect(cardProfileType(card({}))).toBe("unknown");
    expect(cardProfileType(card({ "universal-gender": "4" }))).toBe("unknown");
    expect(cardProfileType(card({ "universal-gender": "" }))).toBe("unknown");
    expect(cardProfileType(card({ "universal-gender": "2a" }))).toBe("unknown");
    // Only a member card carries a type.
    const other = document.createElement("j-card");
    other.setAttribute("universal-gender", "2");
    expect(cardProfileType(other)).toBe("unknown");
  });
});

describe("V1-14 kept types", () => {
  it("keeps known type names only, in a fixed order", () => {
    expect([...decodeTypes('["couple","woman"]')]).toEqual(["woman", "couple"]);
    expect([...decodeTypes('["woman","robot"]')]).toEqual(["woman"]);
    expect([...decodeTypes('["unknown"]')]).toEqual(["unknown"]);
  });

  it("reads a missing or broken value as nothing ticked", () => {
    for (const value of [null, undefined, "", "nonsense", "{}", '"woman"', "3"])
      expect(decodeTypes(value).size, String(value)).toBe(0);
  });
});
