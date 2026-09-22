import { MessageRouter } from "../messaging/router";
import { incrementPersistentWakeCounter } from "./lifecycle";

const router = new MessageRouter();
router.register("diagnostic.ping", ({ value }) => ({ value }));
// Exercises the persisted wake counter from the packaged background bundle so
// the forced-restart verification in docs/manual-verification-needed.md can be
// performed against a real background event.
router.register("diagnostic.wake", async ({ accountId }) => ({
  wakeCount: await incrementPersistentWakeCounter(accountId),
}));
browser.runtime.onMessage.addListener((message: unknown) =>
  router.route(message as never),
);
