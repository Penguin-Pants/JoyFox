import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPAM_OPTIONS,
  detectTemplateSpam,
  type PriorMessage,
} from "../../src/spam/detector";
import {
  normalizedWordCount,
  normalizeMessage,
} from "../../src/spam/normalize";
import {
  defaultSimilarityEngine,
  TrigramDiceSimilarity,
  type SimilarityEngine,
} from "../../src/spam/similarity";

const TEMPLATE =
  "Hello there, I really liked your profile and I would love to get to know you better soon.";
const prior = (
  id: string,
  text: string,
  memberId = "member-1",
): PriorMessage => ({
  id,
  memberId,
  normalizedText: normalizeMessage(text),
});

describe("M3 normalization", () => {
  it("folds case, punctuation and spacing to one form", () => {
    expect(normalizeMessage("Hello,   THERE!!!  ")).toBe("hello there");
    expect(normalizeMessage("hi,there")).toBe("hi there");
  });

  it("normalizes compatibility forms so lookalikes compare equal", () => {
    expect(normalizeMessage("ﬁne")).toBe(normalizeMessage("fine"));
  });

  it("counts words on the normalized form", () => {
    expect(normalizedWordCount(normalizeMessage("  one, two  three "))).toBe(3);
    expect(normalizedWordCount(normalizeMessage("!!!"))).toBe(0);
  });
});

describe("M3 similarity engine", () => {
  it("scores identical text 1 and unrelated text near 0", () => {
    const engine = new TrigramDiceSimilarity();
    expect(engine.score("abcdef", "abcdef")).toBe(1);
    expect(engine.score("abcdef", "zyxwvu")).toBe(0);
  });

  it("rates a lightly edited copy above a rewritten message", () => {
    const engine = defaultSimilarityEngine;
    const base = normalizeMessage(TEMPLATE);
    const edited = normalizeMessage(TEMPLATE.replace("really", "very"));
    const rewritten = normalizeMessage(
      "I saw you are going to the Berlin event next month, are you still looking for company?",
    );
    expect(engine.score(base, edited)).toBeGreaterThan(
      engine.score(base, rewritten),
    );
    expect(engine.score(base, rewritten)).toBeLessThan(
      DEFAULT_SPAM_OPTIONS.duplicateThreshold,
    );
  });

  it("compares strings shorter than one trigram by equality", () => {
    const engine = new TrigramDiceSimilarity();
    expect(engine.score("ab", "ab")).toBe(1);
    expect(engine.score("ab", "ac")).toBe(0);
  });
});

describe("M3 template spam detector", () => {
  it("flags a near-identical copy of an earlier message", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE.replace("really", "very"),
      priorMessages: [prior("p1", TEMPLATE, "member-2")],
    });
    expect(result.flagged).toBe(true);
    expect(result.findings[0]?.kind).toBe("duplicate-message");
    expect(result.findings[0]?.priorMemberId).toBe("member-2");
    expect(result.explanation[0]).toContain(
      "closely matches an earlier message",
    );
  });

  it("does not flag an unrelated message", () => {
    const result = detectTemplateSpam({
      text: "I saw you are going to the Berlin event next month, are you still looking for company?",
      priorMessages: [prior("p1", TEMPLATE)],
    });
    expect(result.flagged).toBe(false);
    expect(result.findings[0]?.kind).toBe("no-match");
  });

  it("reports the closest prior match, not merely the first", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE,
      priorMessages: [
        prior("p1", TEMPLATE.replace("really liked", "liked")),
        prior("p2", TEMPLATE),
      ],
    });
    expect(result.findings[0]?.priorMessageId).toBe("p2");
    expect(result.findings[0]?.similarity).toBe(1);
  });

  it("flags a message containing a known phrase", () => {
    const result = detectTemplateSpam({
      text: `Good evening. ${TEMPLATE}`,
      knownPhrases: [
        { id: "phrase-1", phrase: "I would love to get to know you better" },
      ],
    });
    expect(result.flagged).toBe(true);
    expect(result.findings[0]).toMatchObject({
      kind: "known-phrase",
      phraseId: "phrase-1",
    });
  });

  it("ignores an empty known phrase rather than matching everything", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE,
      knownPhrases: [{ id: "phrase-1", phrase: "   " }],
    });
    expect(result.flagged).toBe(false);
  });

  it("never flags a message below the configured minimum length", () => {
    const result = detectTemplateSpam({
      text: "Hi there",
      priorMessages: [prior("p1", "Hi there")],
    });
    expect(result.flagged).toBe(false);
    expect(result.findings[0]?.kind).toBe("below-minimum-length");
    expect(result.explanation[0]).toContain("below the 8");
  });

  it("honors a raised minimum length", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE,
      priorMessages: [prior("p1", TEMPLATE)],
      options: { minimumWordCount: 100 },
    });
    expect(result.flagged).toBe(false);
  });

  it("explains why a sender override suppressed the flag", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE,
      priorMessages: [prior("p1", TEMPLATE)],
      senderOverridden: true,
    });
    expect(result.flagged).toBe(false);
    expect(result.findings[0]?.kind).toBe("sender-override");
    expect(result.explanation[0]).toContain("marked this sender as not spam");
  });

  it("always explains its verdict and names the engine used", () => {
    for (const result of [
      detectTemplateSpam({ text: TEMPLATE }),
      detectTemplateSpam({ text: "too short" }),
      detectTemplateSpam({
        text: TEMPLATE,
        priorMessages: [prior("p1", TEMPLATE)],
      }),
    ]) {
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.explanation.every((line) => line.length > 0)).toBe(true);
      expect(result.engine).toBe("trigram-dice");
    }
  });

  it("puts no message text into its explanation", () => {
    const result = detectTemplateSpam({
      text: TEMPLATE,
      priorMessages: [prior("p1", TEMPLATE)],
    });
    expect(result.explanation.join(" ")).not.toContain("liked your profile");
  });

  it("accepts a replacement similarity engine", () => {
    const always: SimilarityEngine = { name: "always", score: () => 1 };
    const result = detectTemplateSpam({
      text: TEMPLATE,
      priorMessages: [prior("p1", "completely different text entirely")],
      engine: always,
    });
    expect(result.flagged).toBe(true);
    expect(result.engine).toBe("always");
  });
});
