import { knownMemberIdentity } from "../identity/member-identity";
import type { MessageRouter } from "../messaging/router";
import type { SettingsArea } from "../storage/local-settings";
import { bumpNotesRevision } from "../storage/notes-revision";
import {
  MAX_NOTE_LENGTH,
  MAX_TAG_LENGTH,
  normalizeTagLabel,
  type NotesService,
} from "../notes/notes-service";
import {
  invalid,
  lockedWrite,
  memberId,
  type ActiveAccountSource,
} from "./handler-guards";

export interface NotesHandlerDeps extends ActiveAccountSource {
  notes: NotesService;
  /** Where the notes revision is set; `storage.local` by default. */
  settings?: SettingsArea;
}

/**
 * The member ID reaches the background only from a content script that
 * resolved it through `resolveMemberIdentity` on a verified page (the member
 * panel sends nothing otherwise). Here it is checked again for shape.
 */
const identityOf = (value: unknown) =>
  knownMemberIdentity(memberId(value), "page");

function noteBody(value: unknown): string {
  if (typeof value !== "string" || value.trim().length > MAX_NOTE_LENGTH)
    throw invalid("note");
  return value;
}

function expectedBody(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw invalid("expected note");
  return value;
}

function tagLabel(value: unknown): string {
  if (typeof value !== "string") throw invalid("tag");
  const label = normalizeTagLabel(value);
  if (label.length === 0 || label.length > MAX_TAG_LENGTH) throw invalid("tag");
  return label;
}

/**
 * Register the M5 note and tag handlers for the member panel. Reads use the
 * active account; every write names the account its data came from and runs
 * under that account's lock, and is refused if it is no longer active.
 */
export function registerNotesHandlers(
  router: MessageRouter,
  deps: NotesHandlerDeps,
): void {
  router.register("note.get", async (payload) => {
    const identity = identityOf(payload?.memberId);
    const accountId = await deps.activeAccountId();
    if (!accountId) return { status: "no-account" };
    const note = await deps.notes.readNote(accountId, identity);
    const tags = await deps.notes.listTags(accountId, identity);
    if (note.status !== "ok" || tags.status !== "ok")
      throw invalid("member ID");
    return {
      status: "ok",
      accountId,
      note: note.value?.body ?? null,
      tags: tags.value.map((tag) => tag.label),
    };
  });
  // Set after a committed write only, so other open tabs reload the note.
  const changed = () => bumpNotesRevision(deps.settings);
  router.register("note.save", async (payload) => {
    const identity = identityOf(payload?.memberId);
    const body = noteBody(payload?.body);
    const expected = expectedBody(payload?.expectedBody);
    const answer = await lockedWrite<
      | { status: "saved" | "conflict"; current: string | null }
      | { status: "refused" }
    >(deps, payload?.accountId, { status: "refused" }, async (accountId) => {
      const outcome = await deps.notes.saveNoteIfUnchanged(
        accountId,
        identity,
        body,
        expected,
      );
      if (outcome.status !== "ok") throw invalid("member ID");
      return outcome.value;
    });
    if (answer.status === "saved") await changed();
    return answer;
  });
  router.register("tag.add", async (payload) => {
    const identity = identityOf(payload?.memberId);
    const label = tagLabel(payload?.label);
    const answer = await lockedWrite<{ done: boolean }>(
      deps,
      payload?.accountId,
      { done: false },
      async (accountId) => ({
        done:
          (await deps.notes.addTag(accountId, identity, label)).status === "ok",
      }),
    );
    if (answer.done) await changed();
    return answer;
  });
  router.register("tag.remove", async (payload) => {
    const identity = identityOf(payload?.memberId);
    const label = tagLabel(payload?.label);
    const answer = await lockedWrite<{ done: boolean }>(
      deps,
      payload?.accountId,
      { done: false },
      async (accountId) => ({
        done:
          (await deps.notes.removeTag(accountId, identity, label)).status ===
          "ok",
      }),
    );
    if (answer.done) await changed();
    return answer;
  });
}
