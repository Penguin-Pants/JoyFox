// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { detectPage } from "../../src/content/page-detector";
import { NavigationCoordinator } from "../../src/content/navigation-coordinator";
import { resolveMemberIdentity } from "../../src/identity/member-identity";
import {
  hasVerifiedSelectors,
  selectorRegistry,
  verifiedSelector,
} from "../../src/selectors/registry";
import inboxEvidence from "../../docs/live-evidence/01-inbox.md?raw";
import conversationEvidence from "../../docs/live-evidence/02-conversation.md?raw";
import profileEvidence from "../../docs/live-evidence/03-profile.md?raw";
import searchEvidence from "../../docs/live-evidence/11-search.md?raw";

const EVIDENCE: Record<string, string> = {
  "01-inbox.md": inboxEvidence,
  "02-conversation.md": conversationEvidence,
  "03-profile.md": profileEvidence,
  "11-search.md": searchEvidence,
};

describe("F2 content framework", () => {
  it("verifies only pages backed by live evidence", () => {
    for (const [page, definition] of Object.entries(selectorRegistry)) {
      if (definition.status === "verified") {
        expect(definition.evidence, page).toMatch(/^\d\d-[a-z-]+\.md$/);
        expect(EVIDENCE[definition.evidence ?? ""], page).toMatch(/^# /);
      } else expect(Object.keys(definition.fields), page).toHaveLength(0);
    }
    expect(verifiedSelector("search", "row")).toBeUndefined();
    // The sender name is verified for display, but never as an identity.
    expect(
      resolveMemberIdentity({
        page: "inbox",
        field: "senderName",
        extraction: { status: "found", value: "Synthetic", source: "t" },
      }),
    ).toEqual({ status: "unresolved", reason: "unstable-identifier" });
    expect(hasVerifiedSelectors()).toBe(true);
  });

  it("never selects on build-hash attributes", () => {
    for (const definition of Object.values(selectorRegistry))
      for (const selector of [
        definition.root ?? "",
        ...Object.values(definition.fields),
      ])
        expect(selector).not.toMatch(/data-v-/);
  });

  it("detects no page on a non-JoyClub document", () => {
    expect(detectPage().status).toBe("missing");
  });
  it("coordinates initial and debounced mutation notifications", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const coordinator = new NavigationCoordinator(detectPage);
    coordinator.subscribe(listener);
    coordinator.start();
    document.body.append(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(50);
    expect(listener).toHaveBeenCalledTimes(2);
    coordinator.stop();
    vi.useRealTimers();
  });

  it("wakes on an in-place change to a watched attribute, not on JoyFox's own", async () => {
    vi.useFakeTimers();
    const shield = document.createElement("j-veri-icon");
    shield.setAttribute("verification-status", "1");
    document.body.append(shield);
    const listener = vi.fn();
    const coordinator = new NavigationCoordinator(detectPage);
    coordinator.subscribe(listener);
    coordinator.start();
    expect(listener).toHaveBeenCalledTimes(1);
    shield.setAttribute("verification-status", "3");
    await vi.advanceTimersByTimeAsync(50);
    expect(listener).toHaveBeenCalledTimes(2);
    shield.setAttribute("data-joyfox-placement", "qualified");
    await vi.advanceTimersByTimeAsync(50);
    expect(listener).toHaveBeenCalledTimes(2);
    // Showing or hiding an element in place is noticed too.
    shield.setAttribute("style", "display: none");
    await vi.advanceTimersByTimeAsync(50);
    expect(listener).toHaveBeenCalledTimes(3);
    coordinator.stop();
    shield.remove();
    vi.useRealTimers();
  });

  it("keeps delivering to other listeners when one throws", async () => {
    vi.useFakeTimers();
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(() => {
      throw new Error("synthetic listener failure");
    });
    const healthy = vi.fn();
    const coordinator = new NavigationCoordinator(detectPage);
    coordinator.subscribe(failing);
    coordinator.subscribe(healthy);
    expect(() => coordinator.start()).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
    document.body.append(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(50);
    expect(healthy).toHaveBeenCalledTimes(2);
    expect(failing).toHaveBeenCalledTimes(2);
    coordinator.stop();
    failure.mockRestore();
    vi.useRealTimers();
  });

  it("coordinates History API navigation without replacing browser functions", async () => {
    vi.useFakeTimers();
    const originalPushState = history.pushState;
    const listener = vi.fn();
    const coordinator = new NavigationCoordinator(detectPage);
    coordinator.subscribe(listener);
    coordinator.start();
    history.pushState({}, "", "/synthetic-navigation");
    await vi.advanceTimersByTimeAsync(250);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: "history" }),
    );
    coordinator.stop();
    expect(history.pushState).toBe(originalPushState);
    vi.useRealTimers();
  });
});
