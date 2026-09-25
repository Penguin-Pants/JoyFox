import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { registerTemplateHandlers } from "../../src/background/template-handlers";
import { MessageRouter } from "../../src/messaging/router";
import { repositories } from "../../src/storage/repositories";
import { TemplateService } from "../../src/templates/template-service";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-23T10:00:00.000Z";
let active: string | undefined;
let router: MessageRouter;
let templates: TemplateService;

beforeEach(async () => {
  await freshDatabase();
  for (const id of ["account-a", "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: now,
      updatedAt: now,
    });
  templates = new TemplateService();
  await templates.save("account-a", { name: "A", body: "Text A" });
  await templates.save("account-b", {
    name: "B",
    body: "Text B",
    folder: "Event cancellation",
  });
  router = new MessageRouter();
  registerTemplateHandlers(router, {
    templates,
    activeAccountId: () => Promise.resolve(active),
  });
});

const list = () =>
  router.route({ type: "template.list", requestId: "r1", payload: {} });

describe("M10 template.list", () => {
  it("returns nothing while no account is active", async () => {
    active = undefined;
    expect(await list()).toEqual({
      requestId: "r1",
      ok: true,
      payload: { templates: [] },
    });
  });

  it("returns only the active account's templates, with their folder", async () => {
    active = "account-b";
    const response = await list();
    expect(response).toMatchObject({
      ok: true,
      payload: {
        accountId: "account-b",
        templates: [
          { name: "B", body: "Text B", folder: "Event cancellation" },
        ],
      },
    });
    active = "account-a";
    // No folder: the background sends "", and the page shows "General".
    expect(await list()).toMatchObject({
      payload: { templates: [{ name: "A", folder: "" }] },
    });
  });
});
