# 0013: "First message contains" rule condition

## Status

Accepted (project owner, 2026-09-25, in the session that built it).

## Context

Many members hide an instruction in their profile text, such as "start your
first message with the word X" or with an emoji. A sender who does not use it
did not read the profile. The owner wants a contact rule condition for this: the
first message must contain a word, phrase or emoji the owner types.

Two constraints limit what JoyFox can see:

- DOM only (codex.md, PRD): JoyFox must not fetch, crawl or open a conversation
  by itself.
- The inbox row shows one message preview, the **latest** message
  (`01-inbox.md`). No unread count was found. The owner reported on 2026-09-25
  that an unread row is brighter and has a red dot, with no count.

So when a sender sends two or three messages between two inbox visits, JoyFox
sees only the last one. Reading the conversation page would need the owner to
open each conversation, which defeats the filter. Loading conversations in the
background was rejected: it breaks the DOM-only constraint and risks JoyClub
treating the account as automated. "Keep the first preview JoyFox saw" was
rejected too: it fails in the same case.

## Decision

1. **Condition.** New kind `firstMessageContains`, shown as "First message
   contains", with a text field for a word, phrase or emoji (1 to 100
   characters, trimmed). It is offered in both editors, supports "not" and has
   the usual "If JoyFox cannot see this" choice.
2. **Matching.** Anywhere in the message. Upper and lower case and extra spaces
   do not matter; case is folded so "Straße" matches "STRASSE". NFKC
   normalization, and the emoji variation selectors U+FE0E/U+FE0F are ignored,
   so "❤" matches "❤️". Punctuation and skin tone modifiers must match. A
   phrase must fit 400 characters after normalization too, so every stored match
   can be exported and imported again.
3. **Outcome** (owner's choice):
   - The preview contains the text: met.
   - A preview JoyFox saw earlier contained it: met (stored match).
   - The preview does not contain it: **unknown**, never failed, because the
     first message may still have held it. The condition's "If JoyFox cannot see
     this" choice decides. "Count as not met" filters hard; "Send to Needs
     Review" is the safe default.
   - No preview (conversation and profile pages) and no stored match: unknown.
4. **Storage: result only** (owner's choice). A new entity `MessagePhraseMatch`
   (`phrase-match:<member>:<phrase>`) stores the member ID, the rule's
   normalized phrase and the time, only when a preview holds a phrase. The
   preview text is compared in the background and dropped; it is never stored or
   logged. A stored match keeps the condition met after the sender's later
   messages hide the one that held the phrase. Database version 3 adds the
   store.
5. **Rule schema version 3.** The new kind and its `text` field need version 3.
   A rule is still written with the lowest version that holds it, so a rule
   without the new kind keeps version 1 or 2 and older builds can read it.
6. **Reading.** The inbox reads `.cm-conversation-list-item__text` (verified,
   `01-inbox.md`), cut at 2,000 characters. A new preview is a new triage
   request, so a new message is checked at once.

## Consequences

- The condition reads "first message" but checks the messages JoyFox can see. A
  sender who adds the phrase only in a later message also meets it.
- The owner chose "met" when the preview is the owner's own reply. JoyFox cannot
  yet tell who wrote the preview, so that case reads as unknown. The read-status
  icon may tell (`manual-verification-needed.md`).
- If JoyClub cuts long previews, a phrase at the end of a long first message is
  not seen and reads as unknown (`manual-verification-needed.md`).
- Message text now crosses from the content script to the background in memory.
  The privacy model and selector map say so.
- Import accepts the new entity and refuses a phrase that is not in normalized
  form. Export, deletion and the data inspector include it through the entity
  list.
