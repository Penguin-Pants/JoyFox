// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { detectPage } from "../../src/content/page-detector";
import { NavigationCoordinator } from "../../src/content/navigation-coordinator";
import {
  selectorRegistry,
  verifiedSelector,
} from "../../src/selectors/registry";

describe("F2 unverified content framework", () => {
  it("does not infer a page or expose invented selectors", () => {
    expect(detectPage()).toEqual({
      status: "missing",
      source: "selector-registry-unverified",
    });
    expect(
      Object.values(selectorRegistry).every(
        ({ status, fields }) =>
          status === "unverified" && Object.keys(fields).length === 0,
      ),
    ).toBe(true);
    expect(verifiedSelector("inbox", "senderName")).toBeUndefined();
  });
  it("coordinates initial and debounced mutation notifications", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const coordinator = new NavigationCoordinator(detectPage);
    coordinator.subscribe(listener);
    coordinator.start();
    document.body.append(document.createElement("div"));
    await vi.runAllTimersAsync();
    expect(listener).toHaveBeenCalledTimes(2);
    coordinator.stop();
    vi.useRealTimers();
  });
});
