// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const start = vi.fn();
vi.mock("../../src/content/navigation-coordinator", () => ({
  NavigationCoordinator: class {
    subscribe = vi.fn();
    start = start;
  },
}));

afterEach(() => {
  start.mockClear();
  vi.resetModules();
  vi.unstubAllGlobals();
});

async function bootOn(hostname: string): Promise<void> {
  vi.stubGlobal("location", {
    ...location,
    hostname,
    href: `https://${hostname}/`,
  });
  vi.stubGlobal("browser", {
    storage: { local: { get: async () => ({}) } },
  });
  await import("../../src/content/index");
  await vi.waitFor(() => Promise.resolve());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("F2 content bootstrap", () => {
  it("starts navigation monitoring on the verified host", async () => {
    await bootOn("www.joyclub.de");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("installs nothing on hosts without verified selectors", async () => {
    for (const hostname of ["www.joyce.app", "static.joyclub.de"]) {
      await bootOn(hostname);
      vi.resetModules();
    }
    expect(start).not.toHaveBeenCalled();
  });
});
