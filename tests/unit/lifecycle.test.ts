import "../setup-indexeddb";
import { beforeEach, expect, it, vi } from "vitest";
import { freshDatabase } from "../setup-indexeddb";

beforeEach(freshDatabase);
it("F3 keeps wake state outside background module scope", async () => {
  const first = await import("../../src/background/lifecycle");
  expect(await first.incrementPersistentWakeCounter("account-a")).toBe(1);
  vi.resetModules();
  const afterWake = await import("../../src/background/lifecycle");
  expect(await afterWake.incrementPersistentWakeCounter("account-a")).toBe(2);
});
