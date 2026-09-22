import { MessageRouter } from "../messaging/router";

const router = new MessageRouter();
router.register("diagnostic.ping", ({ value }) => ({ value }));
browser.runtime.onMessage.addListener((message: unknown) =>
  router.route(message as never),
);
