import { describe, expect, it } from "vitest";
import { ExtensionError } from "../../src/errors";
import {
  containment,
  contentLength,
  jaccard,
  shingleCounts,
  normalizeMessage,
  RuleBasedTemplateDetector,
  shingles,
} from "../../src/spam/template-detector";

const TEMPLATE =
  "Hey there, I really liked your profile and would love to chat more with you soon";
const detector = new RuleBasedTemplateDetector();

describe("M3 template detector", () => {
  it("normalizes case, punctuation, symbols and whitespace", () => {
    expect(normalizeMessage("  Hey!!  THERE…\n\tHow’s it 🙂 going? ")).toBe(
      "hey there how s it going",
    );
    expect(normalizeMessage("Grüße aus Köln")).toBe("grüße aus köln");
    expect(normalizeMessage("ＦＵＬＬ width")).toBe("full width");
  });

  it("removes invisible format characters that could split a copy", () => {
    expect(normalizeMessage("wo\u200Buld lo\u00ADve to\u2060 chat")).toBe(
      "would love to chat",
    );
    const verdict = detector.classify({
      text: TEMPLATE.split("").join("\u200B"),
      priorMessages: [{ id: "prior-1", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict.status).toBe("flagged");
  });

  it("matches a phrase embedded in text written without spaces", () => {
    const text =
      "你好我很喜欢你的个人资料希望我们可以多聊聊天请加我的联系方式谢谢你的时间祝你今天过得愉快我们下次再聊";
    const verdict = detector.classify({
      text,
      priorMessages: [],
      phrases: [{ id: "p", phrase: "请加我的联系方式" }],
    });
    expect(verdict).toMatchObject({
      status: "flagged",
      matches: [{ kind: "phrase", phraseId: "p", similarity: 1 }],
    });
  });

  it("removes variation selectors that could split a copy", () => {
    expect(normalizeMessage("wo\uFE0Fuld lo\uFE0Eve")).toBe("would love");
    const verdict = detector.classify({
      text: TEMPLATE.split("").join("\uFE0F"),
      priorMessages: [{ id: "prior-1", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict.status).toBe("flagged");
  });

  it("never compares messages without letters or digits", () => {
    const anyLength = new RuleBasedTemplateDetector({
      minimumMessageLength: 0,
    });
    for (const text of ["", "!!!", "🙂🙂🙂"])
      expect(
        anyLength.classify({
          text,
          priorMessages: [{ id: "prior-1", text: "🎉🎉" }],
          phrases: [],
        }).status,
      ).toBe("too-short");
    expect(
      anyLength.classify({
        text: "hello there",
        priorMessages: [{ id: "prior-1", text: "🎉🎉" }],
        phrases: [],
      }).status,
    ).toBe("clear");
  });

  it("counts letters and digits as code points", () => {
    // U+20000 is one Han letter stored as two UTF-16 code units.
    expect(contentLength(normalizeMessage("\u{20000}".repeat(20)))).toBe(20);
    expect(contentLength("e\u0301 1")).toBe(2);
    const verdict = detector.classify({
      text: "\u{20000}".repeat(20),
      priorMessages: [{ id: "prior-1", text: "\u{20000}".repeat(20) }],
      phrases: [],
    });
    expect(verdict.status).toBe("too-short");
  });

  it("counts repeated word pairs in a phrase", () => {
    const phrase = shingleCounts("buy now buy now buy now buy now buy now");
    expect(containment(phrase, shingleCounts("please buy now buy today"))).toBe(
      2 / 9,
    );
    const verdict = detector.classify({
      text: "I really think you should buy now buy before the synthetic offer runs out",
      priorMessages: [],
      phrases: [{ id: "p", phrase: "buy now buy now buy now buy now buy now" }],
    });
    expect(verdict.status).toBe("clear");
  });

  it("ignores a phrase without letters or digits", () => {
    const verdict = detector.classify({
      text: `${TEMPLATE} \u0301`,
      priorMessages: [],
      phrases: [{ id: "marks", phrase: "\u0301" }],
    });
    expect(verdict.status).toBe("clear");
  });

  it("builds word-pair shingles", () => {
    expect([...shingles("a b c")]).toEqual(["a b", "b c"]);
    expect([...shingles("single")]).toEqual(["single"]);
    expect(shingles("").size).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("flags a near-identical copy of an earlier message", () => {
    const verdict = detector.classify({
      text: TEMPLATE.replace("Hey there", "Hey there!!").toUpperCase(),
      priorMessages: [{ id: "prior-1", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict).toMatchObject({
      status: "flagged",
      matches: [
        { kind: "prior-message", priorMessageId: "prior-1", similarity: 1 },
      ],
      reasons: ["Is 100% similar to an earlier message."],
    });
  });

  it("flags a copy with one substituted name", () => {
    const verdict = detector.classify({
      text: `Hi Alex, ${TEMPLATE}`,
      priorMessages: [{ id: "prior-1", text: `Hi Sam, ${TEMPLATE}` }],
      phrases: [],
    });
    expect(verdict.status).toBe("flagged");
  });

  it("does not flag a different message", () => {
    const verdict = detector.classify({
      text: "We met at the synthetic garden event last weekend, would you like to meet again?",
      priorMessages: [{ id: "prior-1", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict).toEqual({
      status: "clear",
      reasons: ["No saved spam phrase or earlier message is similar."],
    });
  });

  it("skips short messages instead of flagging common openers", () => {
    const verdict = detector.classify({
      text: "Hi, how are you?",
      priorMessages: [{ id: "prior-1", text: "Hi, how are you?" }],
      phrases: [{ id: "p", phrase: "how are you" }],
    });
    expect(verdict.status).toBe("too-short");
  });

  it("honors a configured minimum message length", () => {
    const strict = new RuleBasedTemplateDetector({ minimumMessageLength: 5 });
    const verdict = strict.classify({
      text: "Hi, how are you?",
      priorMessages: [{ id: "prior-1", text: "hi how are you" }],
      phrases: [],
    });
    expect(verdict.status).toBe("flagged");
  });

  it("does not compare a message with itself", () => {
    const verdict = detector.classify({
      text: TEMPLATE,
      messageId: "same",
      priorMessages: [{ id: "same", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict.status).toBe("clear");
  });

  it("matches a saved phrase exactly or fuzzily and explains which one", () => {
    const exact = detector.classify({
      text: TEMPLATE,
      priorMessages: [],
      phrases: [{ id: "p1", phrase: "Would love to chat!" }],
    });
    expect(exact).toMatchObject({
      status: "flagged",
      matches: [{ kind: "phrase", phraseId: "p1", similarity: 1 }],
      reasons: ['Matches the saved spam phrase "Would love to chat!" (100%).'],
    });

    const fuzzy = detector.classify({
      text: TEMPLATE,
      priorMessages: [],
      phrases: [
        {
          id: "p2",
          phrase:
            "really liked your profile and would love to chat more with them",
        },
      ],
    });
    expect(fuzzy.status).toBe("flagged");
    if (fuzzy.status !== "flagged") return;
    expect(fuzzy.matches[0]?.similarity).toBeGreaterThanOrEqual(0.8);
    expect(fuzzy.matches[0]?.similarity).toBeLessThan(1);
  });

  it("matches a single-word phrase only on a word boundary", () => {
    const phrases = [{ id: "p", phrase: "bitcoin" }];
    const flagged = detector.classify({
      text: "I can show you how to earn with bitcoin every single week, message me",
      priorMessages: [],
      phrases,
    });
    const clear = detector.classify({
      text: "I can show you how to earn with bitcoinlike tokens every week, message me",
      priorMessages: [],
      phrases,
    });
    expect(flagged.status).toBe("flagged");
    expect(clear.status).toBe("clear");
  });

  it("never echoes an earlier message's text in a reason", () => {
    const verdict = detector.classify({
      text: TEMPLATE,
      priorMessages: [{ id: "prior-1", text: TEMPLATE }],
      phrases: [],
    });
    expect(verdict.reasons.join(" ")).not.toContain("liked your profile");
  });

  it("keeps validated settings immutable", () => {
    const configured = new RuleBasedTemplateDetector();
    expect(() => {
      (
        configured.settings as { priorMessageThreshold: number }
      ).priorMessageThreshold = 0;
    }).toThrow(TypeError);
    expect(configured.settings.priorMessageThreshold).toBe(0.7);
  });

  it("rejects settings that would flag everything or nothing honestly", () => {
    for (const settings of [
      { minimumMessageLength: -1 },
      { minimumMessageLength: 1.5 },
      { priorMessageThreshold: 0 },
      { phraseThreshold: 1.1 },
      { phraseThreshold: Number.NaN },
    ])
      expect(() => new RuleBasedTemplateDetector(settings)).toThrow(
        ExtensionError,
      );
  });
});
