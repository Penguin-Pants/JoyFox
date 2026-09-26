import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferenceRetry } from "../../src/content/preference-retry";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("V1-2 retry while tag labels are still drawing", () => {
  it("asks for another pass after a delay, once at a time, a bounded number of times", () => {
    const refresh = vi.fn();
    const retry = new PreferenceRetry(refresh, 3, 500);
    retry.check("/profile/1", true);
    retry.check("/profile/1", true);
    vi.advanceTimersByTime(499);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    for (let pass = 0; pass < 5; pass += 1) {
      retry.check("/profile/1", true);
      vi.advanceTimersByTime(500);
    }
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("stops once the labels are read, and starts over on another page", () => {
    const refresh = vi.fn();
    const retry = new PreferenceRetry(refresh, 1, 500);
    retry.check("/profile/1", true);
    vi.advanceTimersByTime(500);
    retry.check("/profile/1", true);
    vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledTimes(1);
    retry.check("/profile/2", false);
    vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledTimes(1);
    retry.check("/profile/2", true);
    // Leaving the page cancels a pending pass.
    retry.check("/member/", false);
    vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
