import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { registerMemberHandlers } from "../../src/background/member-handlers";
import { parseImportFile } from "../../src/data/import";
import { MessageRouter } from "../../src/messaging/router";
import { DATABASE_VERSION, ENTITY_NAMES } from "../../src/storage/database";
import {
  cleanNickname,
  nicknamesOf,
  rememberNicknames,
} from "../../src/storage/member-directory";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

// Owner decision, 2026-09-27: JoyFox keeps the nickname a card shows, so its
// own texts name a member instead of a number. Every name here is invented.
const now = "2026-09-27T10:00:00.000Z";
const later = "2026-09-27T11:00:00.000Z";
let router: MessageRouter;
let active: string | undefined;

const send = (payload: unknown) =>
  router.route({ type: "member.names", requestId: "r1", payload } as never);

beforeEach(async () => {
  await freshDatabase();
  active = "account-a";
  router = new MessageRouter();
  registerMemberHandlers(router, {
    activeAccountId: () => Promise.resolve(active),
    now: () => now,
  });
});

describe("member nicknames", () => {
  it("cleans a nickname, and refuses an empty, long or control-character one", () => {
    expect(cleanNickname("  Synthetic   Owl ")).toBe("Synthetic Owl");
    expect(cleanNickname("")).toBeUndefined();
    expect(cleanNickname("   ")).toBeUndefined();
    expect(cleanNickname("x".repeat(65))).toBeUndefined();
    expect(cleanNickname("Owl\u0000")).toBeUndefined();
    expect(cleanNickname(7)).toBeUndefined();
  });

  it("adds a member, updates a changed nickname and skips an unchanged one", async () => {
    const members = repositories.joyClubMembers;
    const names = [{ memberId: "2222222", nickname: "Synthetic_Owl" }];
    expect(await rememberNicknames(members, "account-a", names, now)).toBe(1);
    expect(await rememberNicknames(members, "account-a", names, later)).toBe(0);
    expect((await members.get("account-a", "2222222"))?.updatedAt).toBe(now);
    await rememberNicknames(
      members,
      "account-a",
      [{ memberId: "2222222", nickname: "Synthetic_Owl2" }],
      later,
    );
    expect(await members.get("account-a", "2222222")).toMatchObject({
      joyClubMemberId: "2222222",
      nickname: "Synthetic_Owl2",
      createdAt: now,
      updatedAt: later,
    });
    expect(await nicknamesOf(members, "account-a")).toEqual(
      new Map([["2222222", "Synthetic_Owl2"]]),
    );
    expect(await nicknamesOf(members, "account-b")).toEqual(new Map());
  });

  it("stores names only for the active account, and checks every entry", async () => {
    const answer = await send({
      accountId: "account-a",
      names: [{ memberId: "2222222", nickname: "Synthetic_Owl" }],
    });
    expect(answer).toMatchObject({
      ok: true,
      payload: { status: "ok", changed: 1 },
    });
    // A page's names sent before an account switch never land in the new one.
    expect(
      await send({
        accountId: "account-b",
        names: [{ memberId: "3333333", nickname: "Synthetic_Heron" }],
      }),
    ).toMatchObject({ ok: true, payload: { status: "refused" } });
    expect(await repositories.joyClubMembers.list("account-b")).toEqual([]);
    for (const names of [
      [{ memberId: "not-a-number", nickname: "Synthetic_Owl" }],
      [{ memberId: "2222222", nickname: "" }],
      "not a list",
    ])
      expect(await send({ accountId: "account-a", names })).toMatchObject({
        ok: false,
      });
  });

  it("imports a member's nickname, and refuses one that is not text", () => {
    const file = (nickname: unknown) =>
      JSON.stringify({
        schemaVersion: DATABASE_VERSION,
        exportedAt: now,
        scope: "all",
        entities: Object.fromEntries(
          ENTITY_NAMES.map((name) => [
            name,
            name === "joyClubMembers"
              ? [
                  {
                    id: "2222222",
                    accountId: "account-a",
                    joyClubMemberId: "2222222",
                    nickname,
                    createdAt: now,
                    updatedAt: now,
                  },
                ]
              : [],
          ]),
        ),
        settings: {},
      });
    expect(() => parseImportFile(file("Synthetic_Owl"))).not.toThrow();
    expect(() => parseImportFile(file(7))).toThrow();
  });
});
