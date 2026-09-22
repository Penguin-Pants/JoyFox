import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  knownMemberIdentity,
  type MemberIdentity,
} from "../../src/identity/member-identity";
import { UNKNOWN_FACTS } from "../../src/qualification/qualification-engine";
import { QualificationService } from "../../src/qualification/qualification-service";
import {
  PROFILE_SNAPSHOT_RETENTION,
  repositories,
} from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const ACCOUNT = "account-a";
const identity = knownMemberIdentity("synthetic-member-1", "test");
const unresolved: MemberIdentity = {
  status: "unresolved",
  reason: "selector-unverified",
};
let clock: number;
let service: QualificationService;
const tick = () =>
  new Date(Date.UTC(2026, 5, 1) + clock++ * 1000).toISOString();

beforeEach(async () => {
  await freshDatabase();
  clock = 0;
  service = new QualificationService(
    repositories.profileSnapshots,
    repositories.joyClubMembers,
    tick,
  );
});

describe("M1 qualification service", () => {
  it("refuses to store a snapshot without a stable member identity", async () => {
    const outcome = await service.recordSnapshot(ACCOUNT, unresolved, {
      ...UNKNOWN_FACTS,
      photoCount: 3,
    });
    expect(outcome).toMatchObject({
      status: "disabled",
      reason: "selector-unverified",
    });
    expect(await repositories.profileSnapshots.list(ACCOUNT)).toEqual([]);
  });

  it("does not store a snapshot that knows nothing", async () => {
    const outcome = await service.recordSnapshot(
      ACCOUNT,
      identity,
      UNKNOWN_FACTS,
    );
    expect(outcome).toEqual({ status: "ok", value: undefined });
    expect(await repositories.profileSnapshots.list(ACCOUNT)).toEqual([]);
  });

  it("stores a snapshot and registers its member", async () => {
    const outcome = await service.recordSnapshot(ACCOUNT, identity, {
      ...UNKNOWN_FACTS,
      verification: true,
      photoCount: 4,
    });
    expect(outcome.status).toBe("ok");
    const [stored] = await repositories.profileSnapshots.list(ACCOUNT);
    expect(stored).toMatchObject({
      memberId: "synthetic-member-1",
      verification: true,
      photoCount: 4,
      profileWordCount: "unknown",
    });
    expect(
      await repositories.joyClubMembers.get(ACCOUNT, "synthetic-member-1"),
    ).toBeDefined();
  });

  it("uses cached snapshot facts when the surface does not show them", async () => {
    await service.recordSnapshot(ACCOUNT, identity, {
      ...UNKNOWN_FACTS,
      verification: true,
      photoCount: 5,
    });
    const result = await service.qualify(
      ACCOUNT,
      identity,
      {},
      { requireVerification: true, minimumPhotoCount: 3 },
    );
    expect(result.cache).toBe("used");
    expect(result.overall).toBe("qualified");
    expect(result.criteria.every((c) => c.source.kind === "snapshot")).toBe(
      true,
    );
  });

  it("scores an unresolved identity from the surface alone", async () => {
    await service.recordSnapshot(ACCOUNT, identity, {
      ...UNKNOWN_FACTS,
      verification: true,
    });
    const result = await service.qualify(
      ACCOUNT,
      unresolved,
      {},
      { requireVerification: true },
    );
    expect(result).toMatchObject({ cache: "unavailable", overall: "partial" });
  });

  it("never reads another account's snapshots", async () => {
    await service.recordSnapshot("account-b", identity, {
      ...UNKNOWN_FACTS,
      verification: true,
    });
    const result = await service.qualify(
      ACCOUNT,
      identity,
      {},
      { requireVerification: true },
    );
    expect(result.overall).toBe("partial");
  });

  it("keeps snapshot storage bounded per member", async () => {
    for (let i = 0; i <= PROFILE_SNAPSHOT_RETENTION; i++)
      await service.recordSnapshot(ACCOUNT, identity, {
        ...UNKNOWN_FACTS,
        photoCount: i,
      });
    const stored = await repositories.profileSnapshots.list(ACCOUNT);
    expect(stored).toHaveLength(PROFILE_SNAPSHOT_RETENTION);
    const result = await service.qualify(
      ACCOUNT,
      identity,
      {},
      { minimumPhotoCount: PROFILE_SNAPSHOT_RETENTION },
    );
    expect(result.overall).toBe("qualified");
  });

  it("keeps two observations captured in the same millisecond", async () => {
    const frozen = new QualificationService(
      repositories.profileSnapshots,
      repositories.joyClubMembers,
      () => "2026-06-01T00:00:00.000Z",
    );
    await frozen.recordSnapshot(ACCOUNT, identity, {
      ...UNKNOWN_FACTS,
      verification: true,
    });
    await frozen.recordSnapshot(ACCOUNT, identity, {
      ...UNKNOWN_FACTS,
      photoCount: 4,
    });
    expect(await repositories.profileSnapshots.list(ACCOUNT)).toHaveLength(2);
    const result = await frozen.qualify(
      ACCOUNT,
      identity,
      {},
      { requireVerification: true, minimumPhotoCount: 3 },
    );
    expect(result.overall).toBe("qualified");
  });

  it("requires an explicit active account", async () => {
    await expect(service.qualify(" ", identity, {}, {})).rejects.toThrow(
      "explicit active account",
    );
  });
});
