import type { MessageRouter } from "../messaging/router";
import { cleanNickname, rememberNicknames } from "../storage/member-directory";
import { JoyClubMemberRepository } from "../storage/repositories";
import {
  invalid,
  lockedWrite,
  memberId,
  type ActiveAccountSource,
} from "./handler-guards";

/** A page shows at most a few dozen cards; this bounds one request. */
export const MAX_NAMES_PER_REQUEST = 200;

export interface MemberHandlerDeps extends ActiveAccountSource {
  members?: JoyClubMemberRepository;
  now?: () => string;
}

/**
 * Keep the nicknames the cards on a page show. A nickname is display only:
 * the member ID beside it is the identity, and the nickname is never logged.
 */
export function registerMemberHandlers(
  router: MessageRouter,
  deps: MemberHandlerDeps,
): void {
  const members = deps.members ?? new JoyClubMemberRepository();
  const now = deps.now ?? (() => new Date().toISOString());
  router.register("member.names", async (payload) => {
    const list: unknown = payload?.names;
    if (!Array.isArray(list) || list.length > MAX_NAMES_PER_REQUEST)
      throw invalid("name list");
    const names = list.map((item: unknown) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const nickname = cleanNickname(entry.nickname);
      if (!nickname) throw invalid("nickname");
      return { memberId: memberId(entry.memberId), nickname };
    });
    return lockedWrite<
      { status: "ok"; changed: number } | { status: "refused" }
    >(deps, payload?.accountId, { status: "refused" }, async (accountId) => ({
      status: "ok",
      changed: await rememberNicknames(members, accountId, names, now()),
    }));
  });
}
