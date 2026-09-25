import { describe, expect, it } from "vitest";
import { normalizePhrase, phrasesIn } from "../../src/rules/message-phrase";

describe("normalizePhrase", () => {
  it("ignores upper and lower case and extra spaces", () => {
    expect(normalizePhrase("  Blue   HERON \n")).toBe("blue heron");
  });

  it("keeps punctuation", () => {
    expect(normalizePhrase("Hi!")).toBe("hi!");
  });

  it("drops emoji variation selectors, so text and emoji hearts match", () => {
    expect(normalizePhrase("❤️")).toBe(normalizePhrase("❤"));
  });

  it("keeps skin tone modifiers, so a different tone does not match", () => {
    expect(normalizePhrase("👋🏽")).not.toBe(normalizePhrase("👋🏻"));
  });
});

describe("phrasesIn", () => {
  it("finds a phrase anywhere in the message", () => {
    const phrases = new Set(["blue heron", "🦊", "absent"]);
    expect(
      phrasesIn("Hello! I read your profile: BLUE  Heron 🦊", phrases),
    ).toEqual(new Set(["blue heron", "🦊"]));
  });

  it("finds nothing in an empty message", () => {
    expect(phrasesIn("", new Set(["blue heron"]))).toEqual(new Set());
  });
});
