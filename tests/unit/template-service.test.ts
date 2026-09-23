import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExtensionAccount } from "../../src/domain/types";
import { repositories } from "../../src/storage/repositories";
import {
  DEFAULT_FOLDER,
  folderOf,
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  normalizeTemplateBody,
  TemplateService,
} from "../../src/templates/template-service";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-23T10:00:00.000Z";

async function addAccount(id: string): Promise<void> {
  const account: ExtensionAccount = {
    id,
    accountId: id,
    joyClubAccountId: `synthetic-${id}`,
    createdAt: now,
    updatedAt: now,
  };
  await repositories.extensionAccounts.put(id, account);
}

let service: TemplateService;
let sequence: number;

beforeEach(async () => {
  await freshDatabase();
  sequence = 0;
  service = new TemplateService(
    repositories.messageTemplates,
    repositories.extensionAccounts,
    () => now,
    () => `template:${(sequence += 1)}`,
  );
  await addAccount("account-a");
  await addAccount("account-b");
});

describe("M10 template service", () => {
  it("creates, edits and deletes a template", async () => {
    const created = await service.save("account-a", {
      name: "Greeting",
      body: "Hallo!\nSchön, von dir zu hören.",
    });
    expect(created).toMatchObject({ id: "template:1", name: "Greeting" });
    expect(created.folder).toBeUndefined();
    expect(folderOf(created)).toBe(DEFAULT_FOLDER);

    const edited = await service.save("account-a", {
      id: created.id,
      name: "  Greeting   long ",
      folder: " Event   confirmation ",
      body: "Neu",
    });
    expect(edited).toMatchObject({
      id: created.id,
      name: "Greeting long",
      folder: "Event confirmation",
      body: "Neu",
      createdAt: created.createdAt,
    });
    expect(await service.list("account-a")).toHaveLength(1);

    await service.delete("account-a", created.id);
    expect(await service.list("account-a")).toEqual([]);
  });

  it("stores the body exactly, with line breaks as the textarea reports them", async () => {
    const body = "  Line one\r\nLine two\rLine three  \n\n😀 Emoji ß";
    const saved = await service.save("account-a", { name: "Exact", body });
    expect(saved.body).toBe(normalizeTemplateBody(body));
    expect(saved.body).toBe("  Line one\nLine two\nLine three  \n\n😀 Emoji ß");
    expect((await service.list("account-a"))[0]?.body).toBe(saved.body);
  });

  it("sorts by folder, then by name", async () => {
    await service.save("account-a", { name: "B", body: "x" });
    await service.save("account-a", {
      name: "A",
      body: "x",
      folder: "Event cancellation",
    });
    await service.save("account-a", { name: "A", body: "x" });
    const names = (await service.list("account-a")).map(
      (t) => `${folderOf(t)}/${t.name}`,
    );
    expect(names).toEqual(["Event cancellation/A", "General/A", "General/B"]);
  });

  it("refuses invalid input without storing anything", async () => {
    await expect(
      service.save("account-a", { name: "  ", body: "x" }),
    ).rejects.toThrow("name");
    await expect(
      service.save("account-a", { name: "Empty", body: " \n " }),
    ).rejects.toThrow("text");
    await expect(
      service.save("account-a", {
        name: "x".repeat(MAX_TEMPLATE_NAME_LENGTH + 1),
        body: "x",
      }),
    ).rejects.toThrow("name");
    await expect(
      service.save("account-a", {
        name: "Long",
        body: "x".repeat(MAX_TEMPLATE_BODY_LENGTH + 1),
      }),
    ).rejects.toThrow("at most");
    expect(await service.list("account-a")).toEqual([]);
  });

  it("does not recreate a template deleted meanwhile", async () => {
    const created = await service.save("account-a", { name: "T", body: "x" });
    await service.delete("account-a", created.id);
    await expect(
      service.save("account-a", { id: created.id, name: "T", body: "y" }),
    ).rejects.toThrow("deleted meanwhile");
    expect(await service.list("account-a")).toEqual([]);
  });

  it("refuses writes for an account that no longer exists", async () => {
    await expect(
      service.save("account-gone", { name: "T", body: "x" }),
    ).rejects.toThrow("no longer exists");
    expect(await repositories.messageTemplates.list("account-gone")).toEqual(
      [],
    );
  });

  it("keeps each account's templates separate (M7)", async () => {
    await service.save("account-a", { name: "Only A", body: "x" });
    expect(await service.list("account-b")).toEqual([]);
    const [template] = await service.list("account-a");
    // An ID from account A does not reach account A's record from B.
    await expect(
      service.save("account-b", { id: template!.id, name: "B", body: "y" }),
    ).rejects.toThrow("deleted meanwhile");
    await service.delete("account-b", template!.id);
    expect(await service.list("account-a")).toHaveLength(1);
  });
});
