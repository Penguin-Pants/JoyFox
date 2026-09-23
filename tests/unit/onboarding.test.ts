import { describe, expect, it } from "vitest";
import {
  registerOnboarding,
  type InstallEvents,
} from "../../src/background/onboarding";

function runtime() {
  let listener: (details: { reason: string }) => void = () => undefined;
  const opened: string[] = [];
  const events: InstallEvents = {
    onInstalled: {
      addListener: (next) => {
        listener = next;
      },
    },
    openOptionsPage: () => {
      opened.push("options");
      return Promise.resolve();
    },
  };
  return { events, fire: (reason: string) => listener({ reason }), opened };
}

describe("onboarding (build plan Section 28)", () => {
  it("opens the options page once on a fresh install", () => {
    const { events, fire, opened } = runtime();
    registerOnboarding(events);
    fire("install");
    expect(opened).toEqual(["options"]);
  });

  it("opens nothing on an update or a browser update", () => {
    const { events, fire, opened } = runtime();
    registerOnboarding(events);
    fire("update");
    fire("browser_update");
    expect(opened).toEqual([]);
  });

  it("does not throw when the options page cannot open", async () => {
    const { events, fire } = runtime();
    events.openOptionsPage = () => Promise.reject(new Error("blocked"));
    registerOnboarding(events);
    expect(() => fire("install")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
