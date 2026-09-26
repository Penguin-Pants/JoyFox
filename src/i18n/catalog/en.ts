/**
 * The English catalog. It is the source of truth for the message keys: the
 * German catalog is typed against it, so a missing key or a wrong parameter
 * shape fails `npm run typecheck` (docs/i18n-spec.md, Section 3.4).
 *
 * Keys are flat and dotted, grouped by the surface that shows them. A value
 * is a string, or a function of typed params. A function prints every
 * number through `f.number()`, never with a plain `${p.value}`.
 */

/** Locale-aware helpers that t() passes to every catalog function. */
export interface Format {
  /** de: 1.234,5 en: 1,234.5 */
  number(value: number): string;
  plural(value: number, forms: { one: string; other: string }): string;
}

/** A param that the translator fills with an already translated string. */
export type Translated = string & { readonly __translated: true };

type T = Translated;

export const en = {
  // Shared labels
  "placement.qualified": "Qualified",
  "placement.needs-review": "Needs Review",
  "placement.quarantined": "Quarantined",
  "condition.verified": "Verified by JoyClub",
  "condition.personallyKnown": "Personally known",
  "condition.minimumPhotos": "Minimum photos",
  "condition.minimumProfileWords": "Minimum profile words",
  "condition.minimumAccountAgeDays": "Minimum account age in days",
  "condition.notTemplateSpam": "Not flagged as template spam",
  "condition.minimumTrustScore": "Minimum local trust score",
  "condition.firstMessageContains": "First message contains",
  "field.accountAgeDays": "Account age in days",
  "field.photoCount": "Photo count",
  "field.profileWordCount": "Profile word count",
  "outcome.qualified": "Qualified",
  "outcome.partial-information": "Partial information",
  "outcome.does-not-meet-rule": "Does not meet rule",
  "common.close": "Close",
  "common.openOptions": "Open JoyFox options",
  "common.saveFailed":
    "JoyFox could not save that change. Nothing was changed.",
  "legacy.text": (p: { text: string }) => p.text,

  // Triage reasons (qualification engine, contact rule, triage service)
  "triage.reason.unknownValue": (p: { field: T }) =>
    `${p.field} is unknown, so it was not counted for or against.`,
  "triage.reason.atOrAbove": (
    p: { field: T; value: number; minimum: number },
    f: Format,
  ) =>
    `${p.field} is ${f.number(p.value)}, at or above the required ${f.number(p.minimum)}.`,
  "triage.reason.belowMinimum": (
    p: { field: T; value: number; minimum: number },
    f: Format,
  ) =>
    `${p.field} is ${f.number(p.value)}, below the required ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeAbove": (
    p: { min: number; max: number; minimum: number },
    f: Format,
  ) =>
    `Account age is between ${f.number(p.min)} and ${f.number(p.max)} days, at or above the required ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeBelow": (
    p: { min: number; max: number; minimum: number },
    f: Format,
  ) =>
    `Account age is between ${f.number(p.min)} and ${f.number(p.max)} days, below the required ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeCoarse": (
    p: { min: number; max: number; minimum: number },
    f: Format,
  ) =>
    `Account age is between ${f.number(p.min)} and ${f.number(p.max)} days, which is too coarse to compare with the required ${f.number(p.minimum)}, so it was not counted for or against.`,
  "triage.reason.verificationUnknown":
    "Verification status is unknown, so it was not counted for or against.",
  "triage.reason.verified": "The profile is verified, as the rule requires.",
  "triage.reason.notVerified":
    "The profile is not verified, which the rule requires.",
  "triage.reason.personallyKnownUnknown":
    "Whether you know this member personally is unknown, so it was not counted for or against.",
  "triage.reason.personallyKnown":
    "You marked this member as personally known, as the rule requires.",
  "triage.reason.notPersonallyKnown":
    "You have not marked this member as personally known, which the rule requires.",
  "triage.reason.noCriteria":
    "No qualification criteria are configured, so every sender qualifies.",
  "triage.reason.spamFlagged":
    "A message from this sender looks like a copied template.",
  "triage.reason.spamNotFlagged":
    "No message from this sender looks like a copied template.",
  "triage.reason.spamOverridden": "You marked this sender as not spam.",
  "triage.reason.spamUnknown":
    "JoyFox has not checked this sender's messages for templates, so spam status is unknown.",
  "triage.reason.phraseSeenNow": (p: { text: string }) =>
    `The latest message from this sender contains "${p.text}".`,
  "triage.reason.phraseSeenBefore": (p: { text: string }) =>
    `An earlier message from this sender, seen in your inbox, contains "${p.text}".`,
  "triage.reason.phraseNotInLatest": (p: { text: string }) =>
    `The latest message from this sender does not contain "${p.text}". The inbox shows only the latest message, so JoyFox cannot see if the first message contained it.`,
  "triage.reason.phraseNotSeen": (p: { text: string }) =>
    `JoyFox has not seen a message from this sender that contains "${p.text}". Only the inbox shows messages to JoyFox.`,
  "triage.reason.trustUnknown":
    "You have logged nothing about this member, so the local trust score is unknown.",
  "triage.reason.trustAtOrAbove": (
    p: { score: number; minimum: number },
    f: Format,
  ) =>
    `Your local trust score is ${f.number(p.score)}, at or above the required ${f.number(p.minimum)}.`,
  "triage.reason.trustBelow": (
    p: { score: number; minimum: number },
    f: Format,
  ) =>
    `Your local trust score is ${f.number(p.score)}, below the required ${f.number(p.minimum)}.`,
  "triage.reason.negatedMet": (p: { reason: T; condition: T }) =>
    `${p.reason} Your rule says "not ${p.condition}", so this counts as met.`,
  "triage.reason.negatedNotMet": (p: { reason: T; condition: T }) =>
    `${p.reason} Your rule says "not ${p.condition}", so this counts as not met.`,
  "triage.reason.unknownNeedsReview": (p: { reason: T }) =>
    `${p.reason} Your rule sends unknown values to Needs Review.`,
  "triage.reason.unknownMet": (p: { reason: T }) =>
    `${p.reason} Your rule counts an unknown value as met.`,
  "triage.reason.unknownNotMet": (p: { reason: T }) =>
    `${p.reason} Your rule counts an unknown value as not met.`,
  "triage.reason.numbered": (p: { number: number; reason: T }, f: Format) =>
    `Rule ${f.number(p.number)}: ${p.reason}`,
  "triage.reason.userMoved": (p: { placement: T }) =>
    `You moved this sender to ${p.placement}.`,
  "triage.headline.noConditions":
    "Your contact rule has no required conditions, so every sender qualifies.",
  "triage.headline.meets": "This sender meets your contact rule.",
  "triage.headline.undecided":
    "JoyFox could not decide, because some information is unknown.",
  "triage.headline.doesNotMeet": (p: { placement: T }) =>
    `This sender does not meet your contact rule, so it goes to ${p.placement}.`,

  // Trust score
  "trust.reason.positive": (p: { count: number }, f: Format) =>
    `You logged ${f.plural(p.count, {
      one: "1 positive outcome",
      other: `${f.number(p.count)} positive outcomes`,
    })}.`,
  "trust.reason.negative": (p: { count: number }, f: Format) =>
    `You logged ${f.plural(p.count, {
      one: "1 negative outcome",
      other: `${f.number(p.count)} negative outcomes`,
    })}.`,
  "trust.reason.neutral": (p: { count: number }, f: Format) =>
    `You logged ${f.plural(p.count, {
      one: "1 neutral outcome",
      other: `${f.number(p.count)} neutral outcomes`,
    })}, which count 0.`,
  "trust.reason.personallyKnown": "You marked this member as personally known.",
  "trust.reason.spamFlagged":
    "A message from this member looks like a copied template.",
  "trust.scopeNote":
    "Based only on what you logged and saw in this browser. It is not a JoyClub or community rating.",

  // Template spam detector
  "spam.detail.override":
    "You marked this sender as not spam, so their messages are never flagged.",
  "spam.detail.belowMinimum": (
    p: { words: number; minimum: number },
    f: Format,
  ) =>
    `The message has ${f.plural(p.words, {
      one: "1 word",
      other: `${f.number(p.words)} words`,
    })}, below the ${f.number(p.minimum)} needed before template matching runs.`,
  "spam.detail.duplicate": (p: { percent: number }, f: Format) =>
    `This message closely matches an earlier message you received (${f.number(p.percent)}% similar).`,
  "spam.detail.knownPhrase":
    "The message contains a phrase from your known-template list.",
  "spam.detail.phraseSimilar": (p: { percent: number }, f: Format) =>
    `The message closely matches a phrase from your known-template list (${f.number(p.percent)}% similar).`,
  "spam.detail.noMatch":
    "The message matched no earlier message and no known template phrase.",

  // Quick Ignore and Delete (M9): the report built from ActionLog steps
  "action.step.ignore": "Ignore",
  "action.step.delete": "Delete",
  "action.where.before": (p: { step: T }) => `before ${p.step}`,
  "action.where.during": (p: { step: T }) => `during ${p.step}`,
  "action.failure.control-missing": (p: { step: T }) =>
    `JoyFox could not find JoyClub's ${p.step} control.`,
  "action.failure.confirmation-missing": (p: { step: T }) =>
    `JoyClub's confirmation for ${p.step} did not appear.`,
  "action.failure.not-verified": (p: { step: T }) =>
    `JoyClub did not show that ${p.step} succeeded.`,
  "action.failure.unverifiable": (p: { step: T; where: T }) =>
    `JoyFox cannot see JoyClub's result for ${p.step} on this page, so it stopped ${p.where}.`,
  "action.failure.member-mismatch": (p: { where: T }) =>
    `The page showed another member, so JoyFox stopped ${p.where}.`,
  "action.failure.conversation-mismatch": (p: { where: T }) =>
    `The page showed another conversation, so JoyFox stopped ${p.where}.`,
  "action.failure.identity-unavailable": (p: { where: T }) =>
    `JoyFox could not confirm which member or conversation the page shows, so it stopped ${p.where}.`,
  "action.failure.account-changed": (p: { where: T }) =>
    `The active JoyFox account changed, so JoyFox stopped ${p.where}.`,
  "action.failure.turned-off": (p: { where: T }) =>
    `Ignore and Delete was turned off, so JoyFox stopped ${p.where}.`,
  "action.failure.superseded": (p: { where: T }) =>
    `A newer Ignore and Delete for this member started, so JoyFox stopped ${p.where}.`,
  "action.failure.log-unavailable": (p: { where: T }) =>
    `JoyFox could not write to its action log, so it stopped ${p.where}.`,
  "action.failure.handoff-failed": (p: { where: T }) =>
    `JoyFox could not move on to the member's profile, so it stopped ${p.where}.`,
  "action.failure.timeout": (p: { step: T }) =>
    `JoyClub did not respond in time during ${p.step}.`,
  "action.failure.step-error": (p: { where: T }) =>
    `An unexpected error stopped JoyFox ${p.where}.`,
  "action.stepText.ignore.done": "Ignore: done. JoyClub ignores this member.",
  "action.stepText.ignore.not-done": "Ignore: not done.",
  "action.stepText.ignore.unknown":
    "Ignore: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
  "action.stepText.delete.done":
    "Delete: done. JoyClub moved the conversation to the trash.",
  "action.stepText.delete.not-done": "Delete: not done.",
  "action.stepText.delete.unknown":
    "Delete: not confirmed. JoyFox started it but did not see JoyClub confirm it.",
  "action.next.ignore":
    "Next: open the member's profile and check whether they are ignored. If not, ignore them there yourself.",
  "action.next.delete":
    "Next: open the conversation and check whether it is in the trash. If not, move it there yourself with JoyClub's trash button.",
  "action.report.finished": "Ignore and Delete finished.",
  "action.report.running": "Ignore and Delete is running.",
  "action.report.stopped": "Ignore and Delete stopped.",
  "action.report.interrupted":
    "Ignore and Delete was interrupted, for example because the tab closed.",
  "action.report.nothingChanged": "Nothing was changed on JoyClub.",
  "action.report.notUndone": "JoyFox did not undo anything.",

  // Content script: the Ignore and Delete button and notice
  "quick.progress.Started": "Ignore and Delete is running. Checking the page.",
  "quick.progress.DeleteRequested": "Moving the conversation to the trash.",
  "quick.progress.DeleteConfirmed":
    "Delete done. Opening the member's profile to ignore them there.",
  "quick.progress.IgnoreRequested": "Ignoring the member on JoyClub.",
  "quick.button": "Ignore and Delete",
  "quick.region": "JoyFox Ignore and Delete",
  "quick.scope":
    "Experimental. One click moves this conversation to JoyClub's trash, then opens the member's profile and ignores them there. JoyFox stops at the first problem and tells you what was done. It never sends a message.",
  "quick.noProfile":
    "JoyFox cannot find this member's profile address, where Ignore is, so it did nothing.",
  "quick.resumed": "Ignore and Delete, continued from the conversation:",
  "quick.previous": "Your last Ignore and Delete for this member:",
  "quick.previousOther":
    "Your last Ignore and Delete for this member, in another conversation:",
  "quick.otherResult": "Your last Ignore and Delete, for another conversation:",
  "quick.otherRunning":
    "Ignore and Delete is still running for another conversation. Wait until it ends.",
  "quick.busy":
    "Another Ignore and Delete for this member is still running, for example in another tab. Nothing was done here.",
  "quick.unexpected":
    "Ignore and Delete stopped because of an unexpected error. JoyFox may have completed a step: check the member's profile and the conversation yourself.",

  // Content script: triage explanation, member bar and trust controls
  "triage.outcome.met": "Met",
  "triage.outcome.not-met": "Not met",
  "triage.outcome.needs-review": "Needs review",
  "triage.conditions.summary": (p: { count: number }, f: Format) =>
    `All conditions checked (${f.number(p.count)})`,
  "triage.condition.line": (p: { outcome: T; condition: T }) =>
    `${p.outcome}: ${p.condition}. `,
  "triage.condition.lineNegated": (p: { outcome: T; condition: T }) =>
    `${p.outcome}: not ${p.condition}. `,
  "triage.placementLine": (p: { placement: T; source: T }) =>
    `Placement: ${p.placement} (${p.source}).`,
  "triage.source.override": "your manual choice",
  "triage.source.rule": "your contact rule",
  "triage.movedOn": (p: { date: string; placement: T }) =>
    `You moved this sender on ${p.date}. Your rule alone would place it in ${p.placement}.`,
  "triage.move.group": "Move this sender",
  "triage.move.to": (p: { placement: T }) => `Move to ${p.placement}`,
  "triage.move.useRule": "Use my rule again",
  "triage.profileFact.minimumPhotos": "photo count",
  "triage.profileFact.minimumProfileWords": "profile word count",
  "triage.profileFact.minimumAccountAgeDays": "account age",
  "triage.unknownFacts.one": (p: { fact: T }) =>
    `The ${p.fact} is unknown. Open the profile and JoyFox reads it.`,
  "triage.unknownFacts.two": (p: { first: T; second: T }) =>
    `The ${p.first} and ${p.second} are unknown. Open the profile and JoyFox reads them.`,
  "triage.unknownFacts.three": (p: { first: T; second: T; third: T }) =>
    `The ${p.first}, ${p.second} and ${p.third} are unknown. Open the profile and JoyFox reads them.`,
  "trust.score.none": "Local trust score: no history yet.",
  "trust.score.value": (p: { score: number }, f: Format) =>
    `Local trust score: ${f.number(p.score)}.`,
  "trust.details.summary": "How the score adds up",
  "trust.contribution": (p: { points: number; reason: T }, f: Format) =>
    `${p.points > 0 ? "+" : ""}${f.number(p.points)}: ${p.reason}`,
  "trust.log.group": "Log an outcome with this member",
  "trust.log.positive": "Log positive",
  "trust.log.neutral": "Log neutral",
  "trust.log.negative": "Log negative",
  "trust.log.undo": "Undo last outcome",
  "bar.placementPrefix": "Placement: ",
  "bar.yourChoice": "(your choice)",
  "bar.openProfile": "Open profile",
  "bar.log": "Log:",
  "bar.positive": "Positive",
  "bar.neutral": "Neutral",
  "bar.negative": "Negative",
  "bar.undo": "Undo",
  "bar.whyAndMove": "Why and move",
  "bar.scoreDetails": "Score details",
  "panel.ruleOff.no-rule":
    "No contact rule is set, so JoyFox does not place this sender.",
  "panel.ruleOff.rule-disabled":
    "Your contact rule is turned off, so JoyFox does not place this sender.",
  "panel.ruleOff.other": "JoyFox does not place this sender.",

  // Content script: inbox triage
  "inbox.region": "JoyFox triage",
  "inbox.views": "Show messages",
  "inbox.view.default": "Inbox",
  "inbox.view.all": "Show all",
  "inbox.viewCount": (p: { view: T; count: number }, f: Format) =>
    `${p.view} (${f.number(p.count)})`,
  "inbox.about": "About these views",
  "inbox.aboutText":
    "Inbox hides Quarantined rows from this view only. Nothing is deleted, and JoyFox changes nothing on JoyClub.",
  "inbox.checking": "Checking",
  "inbox.badge": (p: { text: T }) => `JoyFox: ${p.text}. Show why.`,
  "inbox.why": "Why this placement",
  "inbox.whyNamed": (p: { name: string }) => `Why: ${p.name}`,
  "inbox.rowGone": "This row is no longer shown.",
  "inbox.unidentified":
    "JoyFox could not read this sender's profile number, so it could not check your rule. The row stays visible.",
  "inbox.stillChecking": "JoyFox is still checking this sender.",

  // Content script: notes and tags
  "notes.region": "JoyFox notes and tags",
  "notes.scope":
    "Private to JoyFox: stored only in this browser, under the active JoyFox account. JoyFox never sends it anywhere.",
  "notes.saved": "Note saved.",
  "notes.removed": "Note removed.",
  "notes.conflict":
    "This note changed in another tab or in the JoyFox data inspector, so JoyFox did not save your text. It is still in the box. Save again to replace the stored note, or discard your changes to see it.",
  "notes.refused":
    "The active JoyFox account changed, so nothing was stored. Text typed for the previous account was dropped.",
  "notes.emptyTag": "Type a tag first. Nothing was added.",
  "notes.emptyNote": "Type a note first. Nothing was saved.",
  "notes.tagAdded": "Tag added.",
  "notes.tagRemoved": "Tag removed.",
  "notes.privateNote": "Private note",
  "notes.discard": "Discard my changes",
  "notes.save": "Save note",
  "notes.tags": "Tags",
  "notes.noTags": "No tags yet.",
  "notes.remove": "Remove",
  "notes.removeTag": (p: { label: string }) => `Remove tag ${p.label}`,
  "notes.addTagLabel": "Add a tag",
  "notes.addTag": "Add tag",
  "notes.summary.none": "Your notes and tags (none yet)",
  "notes.summary.note": "Your notes and tags (a note)",
  "notes.summary.tags": (p: { count: number }, f: Format) =>
    `Your notes and tags (${f.plural(p.count, {
      one: "1 tag",
      other: `${f.number(p.count)} tags`,
    })})`,
  "notes.summary.noteAndTags": (p: { count: number }, f: Format) =>
    `Your notes and tags (a note and ${f.plural(p.count, {
      one: "1 tag",
      other: `${f.number(p.count)} tags`,
    })})`,

  // Content script: template picker
  "picker.toggle": "JoyFox templates",
  "picker.loading": "Loading templates…",
  "picker.readFailed":
    "JoyFox could not read your templates. Nothing was inserted.",
  "picker.empty": "No templates yet. Add them on the JoyFox options page.",
  "picker.noAccount":
    "No JoyFox account is active. Choose one on the JoyFox options page.",
  "picker.result.inserted":
    "Template inserted. Check the text, then click JoyClub's Send button yourself.",
  "picker.result.not-editable":
    "The message field cannot be edited right now. Nothing was inserted.",
  "picker.result.too-long":
    "The template does not fit in the message field. Nothing was inserted; the template was not shortened.",
  "picker.result.altered":
    "JoyClub changed the text after insertion. Check the message field before you send.",
  "templates.folder.general": "General",
  "templates.folder.eventConfirmation": "Event confirmation",
  "templates.folder.eventCancellation": "Event cancellation",

  // Options page: shell and tabs
  "options.title": "JoyFox options",
  "options.intro":
    "JoyFox stores everything locally in this browser profile. Inbox triage stays off until you save a contact rule.",
  "options.tabs.start": "Get started",
  "options.tabs.accounts": "Accounts",
  "options.tabs.rule": "Contact rule",
  "options.tabs.templates": "Templates",
  "options.tabs.data": "Your data",
  "options.importRegion": "Import JoyFox data",

  // Options page: Get started
  "start.state.done": "Done",
  "start.state.off": "Saved, but turned off",
  "start.state.todo": "Not done yet",
  "start.ready": "JoyFox is set up. Open your JoyClub inbox to see it sorted.",
  "start.intro":
    "Three steps, a few minutes. Everything stays in this browser.",
  "start.step.account":
    "Add your JoyClub account under [Accounts](#accounts). JoyFox makes the first one active.",
  "start.step.rule":
    "Save a contact rule under [Contact rule](#rule). Inbox triage stays off until a rule is saved and turned on.",
  "start.step.inbox":
    "Open your JoyClub inbox (www.joyclub.de, ClubMail). JoyFox adds its tabs above the list.",

  // Options page: accounts
  "accounts.readFailed":
    "JoyFox could not read its stored accounts. No account was changed.",
  "accounts.hint":
    "JoyFox cannot read which JoyClub login a tab uses. The active account is the one selected here, and all notes, tags and rules are stored under it.",
  "accounts.activeLabel": "Active account:",
  "accounts.noneSelected": "None selected",
  "accounts.empty":
    "No accounts yet. Add one below to start storing notes and tags.",
  "accounts.list": "Stored accounts",
  "accounts.active": "Active",
  "accounts.inactive": "Not active",
  "accounts.use": "Use this account",
  "accounts.useLabel": (p: { name: string }) => `Use account ${p.name}`,
  "accounts.nowActive": (p: { name: string }) =>
    `Active account is now ${p.name}.`,
  "accounts.remove": "Remove",
  "accounts.confirmRemove": "Confirm removal",
  "accounts.removeLabel": (p: { name: string }) => `Remove account ${p.name}`,
  "accounts.confirmRemoveLabel": (p: { name: string }) =>
    `Confirm removal of account ${p.name} and all of its data`,
  "accounts.removePrompt": (p: { name: string }) =>
    `Removing ${p.name} also deletes its notes, tags and rules. Click again to confirm.`,
  "accounts.removed": (p: { name: string }) =>
    `Removed ${p.name} and its stored data.`,
  "accounts.addForm": "Add an account",
  "accounts.identifier": "JoyClub account identifier",
  "accounts.label": "Display label (optional)",
  "accounts.add": "Add account",
  "accounts.added": (p: { name: string }) => `Added ${p.name}.`,
  "accounts.saveFailed": "That change could not be saved. Nothing was changed.",

  // Options page: contact rule
  "rule.readFailed":
    "JoyFox could not read the contact rule. No rule was changed.",
  "rule.hint":
    "The rule only changes how JoyFox groups your own inbox into Qualified, Needs Review and Quarantined. It never stops a message, never deletes anything, and the sender sees nothing.",
  "rule.noAccount":
    "Select or add an account first. Each account has its own rule.",
  "rule.newer":
    "This rule was made in a newer version of JoyFox and cannot be edited here. Delete it to start a new one.",
  "rule.note.saved": "A rule is saved for the active account.",
  "rule.note.none":
    "No rule is saved for the active account, so JoyFox does not sort the inbox.",
  "rule.enabled": "Sort my JoyClub inbox with this rule",
  "rule.placementLabel": "A sender who does not meet the rule goes to",
  "rule.spamHint":
    'Spam status is unknown for now: JoyFox does not check messages for templates yet. Only your own "not spam" corrections count. The inbox shows only the verification shield; photos, profile words and account age come from profiles you opened before.',
  "rule.autosaveHint":
    "Changes are saved automatically: a box or choice at once, a number or text when you leave its field.",
  "rule.firstMessageHint":
    '"First message contains" reads the message preview in your inbox, ignoring upper and lower case. The inbox shows only the latest message, so when a sender sent more than one, the preview may not be the first. If the preview does not contain your text, the condition counts as your "If JoyFox cannot see this" choice. Once JoyFox sees your text, it stays met.',
  "rule.editor": "Editor:",
  "rule.simple": "Simple",
  "rule.advanced": "Advanced",
  "rule.match.all": "ALL",
  "rule.match.any": "ANY",
  "rule.box.all": "A sender qualifies when ALL of these are met",
  "rule.box.any": "Or a sender qualifies when ANY of these is met",
  "rule.unknown.needs-review": "Send to Needs Review",
  "rule.unknown.met": "Count as met",
  "rule.unknown.not-met": "Count as not met",
  "rule.unknownPrompt": "If JoyFox cannot see this:",
  "rule.unknownLabel": (p: { condition: T }) =>
    `${p.condition}: if JoyFox cannot see this`,
  "rule.valueLabel": (p: { condition: T }) => `${p.condition} value`,
  "rule.numberProblem": (
    p: { minimum: number; maximum: number; condition: T },
    f: Format,
  ) =>
    `Enter a whole number from ${f.number(p.minimum)} to ${f.number(p.maximum)} for "${p.condition}".`,
  "rule.textPlaceholder": "Word, phrase or emoji",
  "rule.textLabel": (p: { condition: T }) =>
    `${p.condition}: word, phrase or emoji`,
  "rule.textProblem": (p: { maximum: number; condition: T }, f: Format) =>
    `Enter a word, phrase or emoji of up to ${f.number(p.maximum)} characters for "${p.condition}".`,
  "rule.combine.label": "How the rules combine",
  "rule.combine.prefix": "A sender is qualified if ",
  "rule.combine.suffix": " of these rules match.",
  "rule.advancedHint":
    'Each rule is met when ALL or ANY of its conditions are met, as you choose. Tick "not" to turn a condition around: "not Minimum photos 3" means fewer than 3 photos. A rule without conditions is not saved.',
  "rule.addRule": "+ Add rule",
  "rule.removeRule": "Remove rule",
  "rule.ruleSuffix": " of these are met",
  "rule.noConditions": "No conditions yet. Add one below.",
  "rule.removeCondition": "Remove condition",
  "rule.removeConditionLabel": (p: { condition: T }) => `Remove ${p.condition}`,
  "rule.not": "not",
  "rule.notTitle": "Turn this condition around",
  "rule.notLabel": (p: { condition: T }) => `not: turn "${p.condition}" around`,
  "rule.joiner.all": "AND",
  "rule.joiner.any": "OR",
  "rule.ruleTitle": (p: { number: number }, f: Format) =>
    `Rule ${f.number(p.number)}: met if `,
  "rule.ruleMatchLabel": (p: { number: number }, f: Format) =>
    `How rule ${f.number(p.number)} combines its conditions`,
  "rule.removeRuleLabel": (p: { number: number }, f: Format) =>
    `Remove rule ${f.number(p.number)}`,
  "rule.addConditionLabel": (p: { number: number }, f: Format) =>
    `Add a condition to rule ${f.number(p.number)}`,
  "rule.addCondition": "+ Add condition…",
  "rule.ruleCount": (p: { count: number; maximum: number }, f: Format) =>
    `${f.number(p.count)} of ${f.number(p.maximum)} rules`,
  "rule.simpleUnavailable.all":
    "Simple view is not available: the rules combine with ALL.",
  "rule.simpleUnavailable.not":
    'Simple view is not available: the rule uses "not".',
  "rule.simpleUnavailable.severalAll":
    "Simple view is not available: more than one rule needs ALL of several conditions.",
  "rule.simpleUnavailable.duplicate":
    "Simple view is not available: a condition appears in more than one rule.",
  "rule.savedNoConditions":
    "Rule saved. It has no conditions yet, so every sender qualifies.",
  "rule.savedVacuous":
    "Rule saved. With nothing in the ALL box, every sender qualifies, so the ANY box has no effect.",
  "rule.saved": "Rule saved. Open JoyClub tabs update at once.",
  "rule.notSaved": (p: { problem: T }) =>
    `${p.problem} The rule was not saved.`,
  "rule.saveFailed": "JoyFox could not save the rule. Nothing was changed.",
  "rule.deleteAll": "Delete whole contact rule",
  "rule.removed":
    "Rule removed. JoyFox no longer sorts the inbox for this account.",
  "rule.removeFailed": "JoyFox could not remove the rule. Nothing was changed.",
  "rule.stale.account.saved":
    "The active account changed. The rule was not saved. Check the form and try again.",
  "rule.stale.account.removed":
    "The active account changed. The rule was not removed. Check the form and try again.",
  "rule.stale.rule.saved":
    "The rule was changed in another tab. It was not saved. The form now shows the saved rule.",
  "rule.stale.rule.removed":
    "The rule was changed in another tab. It was not removed. The form now shows the saved rule.",
  "rule.changedElsewhere":
    "The rule was changed in another tab. The form now shows the saved rule.",

  // Options page: templates
  "templates.readFailed":
    "JoyFox could not read your templates. No template was changed.",
  "templates.heading": "Message templates",
  "templates.hint":
    'On a JoyClub conversation, the "JoyFox templates" button below the message field inserts a template at the cursor. You can still edit the text, and you always click JoyClub\'s Send button yourself. JoyFox never sends a message.',
  "templates.noAccount": "Choose an active account above to store templates.",
  "templates.empty": "No templates yet. Add one below.",
  "templates.inFolder": (p: { folder: string }) => `Templates in ${p.folder}`,
  "templates.edit": "Edit",
  "templates.editLabel": (p: { name: string }) => `Edit template ${p.name}`,
  "templates.editing": (p: { name: string }) => `Editing ${p.name}.`,
  "templates.delete": "Delete",
  "templates.confirmDelete": "Confirm delete",
  "templates.deleteLabel": (p: { name: string }) => `Delete template ${p.name}`,
  "templates.confirmDeleteLabel": (p: { name: string }) =>
    `Confirm deleting template ${p.name}`,
  "templates.deletePrompt": (p: { name: string }) =>
    `Click "Confirm delete" to delete ${p.name}.`,
  "templates.deleted": (p: { name: string }) => `Deleted ${p.name}.`,
  "templates.addForm": "Add a template",
  "templates.name": "Name",
  "templates.folder": "Folder (optional, General if empty)",
  "templates.text": "Text",
  "templates.saveChanges": "Save changes",
  "templates.add": "Add template",
  "templates.cancel": "Cancel editing",
  "templates.saved": (p: { name: string }) => `Saved ${p.name}.`,
  "templates.added": (p: { name: string }) => `Added ${p.name}.`,
  "templates.accountChanged":
    "The active account changed. Nothing was changed.",

  // Options page: your data
  "entity.extensionAccounts": "Account record",
  "entity.joyClubMembers": "Members",
  "entity.profileSnapshots": "Profile snapshots",
  "entity.userNotes": "Notes",
  "entity.userTags": "Tags",
  "entity.trustSignals": "Trust outcomes",
  "entity.contactRules": "Contact rules",
  "entity.conversationClassifications": "Manual placements",
  "entity.savedSearches": "Saved searches",
  "entity.eventMetadata": "Event notes",
  "entity.spendLogEntries": "Spending log",
  "entity.syncConfigs": "Sync settings",
  "entity.extensionPreferences": "Preferences",
  "entity.messageTemplates": "Message templates",
  "entity.spamPhrases": "Spam phrases",
  "entity.messageObservations": "Cached message text (normalized)",
  "entity.senderSpamOverrides": "Not-spam corrections",
  "entity.actionLogs": "Action log",
  "entity.messagePhraseMatches": "Message phrase matches",
  "data.readFailed":
    "JoyFox could not read its stored data. Nothing was changed.",
  "data.hint":
    "Everything JoyFox stores stays in this browser profile. You can inspect it, save it as a JSON file and delete it here. Deleting here never changes anything on JoyClub.",
  "data.noAccounts": "No accounts yet.",
  "data.accountPicker": "Account to inspect",
  "data.caption": "Stored records for this account",
  "data.col.type": "Data type",
  "data.col.records": "Records",
  "data.col.actions": "Actions",
  "data.show": "Show",
  "data.hide": "Hide",
  "data.showLabel": (p: { label: T }) => `Show ${p.label}`,
  "data.hideLabel": (p: { label: T }) => `Hide ${p.label}`,
  "data.deleteAll": "Delete all",
  "data.deleteAllLabel": (p: { label: T }) => `Delete all ${p.label}`,
  "data.deleteAllPrompt": (p: { count: number; label: T }, f: Format) =>
    `Click "Confirm" to delete all ${f.number(p.count)} ${p.label} records of this account.`,
  "data.deletedAll": (p: { label: T }) =>
    `Deleted all ${p.label} of this account.`,
  "data.recordsTitle": (p: { label: T; count: number }, f: Format) =>
    `${p.label} (${f.number(p.count)})`,
  "data.accountRecordHint":
    "The account record is removed only with the whole account, in Accounts above.",
  "data.recordSummary": (p: { id: string; updated: string }) =>
    `${p.id} (updated ${p.updated})`,
  "data.valueYes": "yes",
  "data.valueNo": "no",
  "data.valueEmpty": "(empty)",
  "data.rawJson": "Stored JSON",
  "data.moreCharacters": (p: { count: number }, f: Format) =>
    `…and ${f.number(p.count)} more characters (see "Stored JSON")`,
  "data.moreValues": (p: { count: number }, f: Format) =>
    `…and ${f.number(p.count)} more (see "Stored JSON")`,
  "data.delete": "Delete",
  "data.deleteRecordLabel": (p: { id: string }) => `Delete record ${p.id}`,
  "data.deleteRecordPrompt": (p: { id: string }) =>
    `Click "Confirm" to delete record ${p.id}.`,
  "data.deletedRecord": (p: { id: string }) => `Deleted record ${p.id}.`,
  "data.showMore": (p: { count: number }, f: Format) =>
    `Show ${f.number(p.count)} more`,
  "data.exportAccount": "Export this account (JSON)",
  "data.exportedAccount": "Export of this account created.",
  "data.deleteAccountData": "Delete this account's data",
  "data.deleteAccountDataLabel": "Delete all data of this account",
  "data.deleteAccountDataPrompt":
    'Click "Confirm" to delete every record of this account. The account itself stays in Accounts.',
  "data.deletedAccountData":
    "Deleted all data of this account. The account itself is kept.",
  "data.allAccounts": "All accounts",
  "data.retentionLabel": "Profile snapshots kept per member",
  "data.retentionHint": (
    p: { minimum: number; maximum: number; default: number },
    f: Format,
  ) =>
    `JoyFox keeps the newest snapshots of each member's profile facts, always at least the latest one. Lowering the number deletes older snapshots at once, in every account. From ${f.number(p.minimum)} to ${f.number(p.maximum)}; the default is ${f.number(p.default)}.`,
  "data.retentionSave": "Save",
  "data.retentionSaved": (p: { deleted: number }, f: Format) =>
    p.deleted === 0
      ? "Saved. No snapshot needed deleting."
      : `Saved. ${f.plural(p.deleted, {
          one: "1 older snapshot was",
          other: `${f.number(p.deleted)} older snapshots were`,
        })} deleted.`,
  "data.retentionInvalid": (
    p: { minimum: number; maximum: number },
    f: Format,
  ) =>
    `Enter a whole number from ${f.number(p.minimum)} to ${f.number(p.maximum)}. Nothing was changed.`,
  "data.exportAll": "Export all JoyFox data (JSON)",
  "data.exportedAll": "Export of all JoyFox data created.",
  "data.deleteEverything": "Delete all JoyFox data",
  "data.deleteEverythingLabel": "Delete all JoyFox data in this browser",
  "data.deleteEverythingPrompt":
    'Click "Confirm" to delete every account, every record and every JoyFox setting in this browser. This cannot be undone.',
  "data.deletedEverything": "Deleted all JoyFox data in this browser.",
  "data.confirm": "Confirm",
  "data.confirmLabel": (p: { label: T }) => `Confirm: ${p.label}`,
  "data.actionFailed":
    "That action could not be completed. The counts shown now are what is stored.",
  "data.import.title": "Import",
  "data.import.hint":
    "Import a JoyFox export file: everything, or one account. It is merged into what is stored here. An account with the same JoyClub identifier is merged into the existing one. For the same note, rule or placement the newer version wins; existing tags and corrections are kept. The import starts when you choose the file, and you then see what changed.",
  "data.import.fileLabel": "JoyFox export file (JSON)",
  "data.import.summary.all": (
    p: { matched: number; added: number; total: number },
    f: Format,
  ) =>
    `This full export holds ${f.number(p.total)} account(s): ${f.number(p.matched)} merged into an existing account, ${f.number(p.added)} added as new.`,
  "data.import.summary.account": (
    p: { matched: number; added: number; total: number },
    f: Format,
  ) =>
    `This single-account export holds ${f.number(p.total)} account(s): ${f.number(p.matched)} merged into an existing account, ${f.number(p.added)} added as new.`,
  "data.import.caption": "What the import changed",
  "data.import.col.added": "Added",
  "data.import.col.replaced": "Replaced (newer)",
  "data.import.col.kept": "Kept",
  "data.import.col.duplicates": "Skipped duplicates",
  "data.import.noRecords": "The file holds no records.",
  "data.import.settingsSkipped": (p: { keys: string }) =>
    `Settings in the file that are never imported (they switch features on): ${p.keys}.`,
  "data.import.settingsNotSaved": (p: { keys: string }) =>
    `Settings that could not be saved: ${p.keys}.`,
  "data.import.settingsAdded": (p: { keys: string }) =>
    `Settings added (only those not set here): ${p.keys}.`,
  "data.import.running": "Importing the file.",
  "data.import.nothing":
    "Everything in this file is already stored. Nothing was changed.",
  "data.import.complete": (p: { added: number; replaced: number }, f: Format) =>
    `Import complete: ${f.number(p.added)} record(s) added, ${f.number(p.replaced)} replaced by a newer version.`,
  "data.import.completeSettingsFailed": (
    p: { added: number; replaced: number },
    f: Format,
  ) =>
    `Import complete: ${f.number(p.added)} record(s) added, ${f.number(p.replaced)} replaced by a newer version. Some settings could not be saved; check the active account.`,
  "data.import.incomplete":
    "The import could not be completed. The counts shown now are what is stored.",
  "data.import.unreadable":
    "JoyFox could not read that file. Nothing was imported.",

  // Errors the UI shows (ExtensionError.display). No final full stop: the
  // panels add a suffix such as "Nothing was changed."
  "error.withSuffix.nothingChanged": (p: { error: T }) =>
    `${p.error}. Nothing was changed.`,
  "error.withSuffix.nothingImported": (p: { error: T }) =>
    `${p.error}. Nothing was imported.`,
  "error.withSuffix.nothingDeleted": (p: { error: T }) =>
    `${p.error}. Nothing was deleted.`,
  "error.code.SelectorUnavailable":
    "JoyFox cannot find the expected element on the page",
  "error.code.ExtractionInvalid": "The data is not valid",
  "error.code.IdentityMismatch": "The account or member does not match",
  "error.code.StorageError": "JoyFox could not read or write its stored data",
  "error.code.RuleEvaluationError": "The contact rule could not be checked",
  "error.code.ActionStepFailed": "A step on JoyClub did not complete",
  "error.code.NavigationTimeout": "The page did not load in time",
  "error.code.UnsupportedPage": "JoyFox does not support this page",
  "error.account.emptyIdentifier": "An account needs a non-empty identifier",
  "error.account.duplicate": "That account identifier is already registered",
  "error.account.notRegistered":
    "Cannot activate an account that is not registered",
  "error.account.gone": "That account no longer exists",
  "error.account.changed": "The active account changed",
  "error.template.noName": "A template needs a name",
  "error.template.nameTooLong": (p: { maximum: number }, f: Format) =>
    `A template name can have at most ${f.number(p.maximum)} characters`,
  "error.template.folderTooLong": (p: { maximum: number }, f: Format) =>
    `A folder name can have at most ${f.number(p.maximum)} characters`,
  "error.template.noText": "A template needs some text",
  "error.template.tooLong": (p: { maximum: number }, f: Format) =>
    `A template can have at most ${f.number(p.maximum)} characters`,
  "error.template.deleted": "That template was deleted meanwhile",
  "error.data.changedDuringCheck":
    "Stored data changed while the file was checked. Choose the file again",
  "error.data.unknownType": "Unknown data type",
  "error.data.accountRecord":
    "The account record is removed only with the whole account",
  "error.import.tooLarge": "The file is too large to be a JoyFox export",
  "error.import.notJson": "The file is not a JoyFox export (not valid JSON)",
  "error.import.notExport": "The file is not a JoyFox export",
  "error.import.noVersion": "The file has no valid schema version",
  "error.import.newerVersion":
    "The file comes from a newer JoyFox version. Update JoyFox first",
  "error.import.noScope": "The file has no valid export scope",
  "error.import.noAccountNamed": "The account export names no account",
  "error.import.unknownType": (p: { name: string }) =>
    `The file holds an unknown data type (${p.name})`,
  "error.import.notList": (p: { entity: T }) =>
    `The file's ${p.entity} list is not a list`,
  "error.import.notRecord": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} is not a record`,
  "error.import.forbiddenKey": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} holds a forbidden key`,
  "error.import.unknownField": (
    p: { index: number; entity: T; field: string },
    f: Format,
  ) =>
    `Record ${f.number(p.index)} of ${p.entity} holds an unknown field (${p.field})`,
  "error.import.tooLong": (
    p: { index: number; entity: T; field: string; maximum: number },
    f: Format,
  ) =>
    `Record ${f.number(p.index)} of ${p.entity} is invalid: ${p.field} is longer than ${f.number(p.maximum)} characters`,
  "error.import.invalid": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} is invalid`,
  "error.import.future": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} is dated in the future`,
  "error.import.otherAccount": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} belongs to another account`,
  "error.import.notOwnScope": (p: { index: number }, f: Format) =>
    `Account record ${f.number(p.index)} is not its own scope`,
  "error.import.twice": (p: { index: number; entity: T }, f: Format) =>
    `Record ${f.number(p.index)} of ${p.entity} appears twice`,
  "error.import.sameIdentifier":
    "Two accounts in the file have the same identifier",
  "error.import.noAccountRecord": "The account export holds no account record",
  "error.import.settingsInvalid": "The file's settings are invalid",
  "error.import.settingsForbidden": "The file's settings hold a forbidden key",
  "error.import.unknownSetting": (p: { key: string }) =>
    `The file holds a setting JoyFox does not use (${p.key})`,
  "error.import.orphans":
    "Some records in the file belong to an account the file does not hold",
  "error.import.sameRecordTwice":
    "The file holds the same record twice after merging accounts",
} as const;

export type MessageKey = keyof typeof en;

/**
 * The params a key's function takes, or undefined for a plain string.
 * Distributive, so a union of keys never loses a key's params.
 */
export type ArgsOf<K extends MessageKey> = K extends MessageKey
  ? (typeof en)[K] extends (p: infer A, f: Format) => string
    ? A
    : undefined
  : never;

/** Keys whose value is a plain string. */
export type PlainKey = {
  [K in MessageKey]: ArgsOf<K> extends undefined ? K : never;
}[MessageKey];

/** Keys whose value is a function of params. */
export type ParamKey = Exclude<MessageKey, PlainKey>;

/** The shape every other catalog has: the same keys and param types. */
export type Catalog = {
  [K in MessageKey]: (typeof en)[K] extends string ? string : (typeof en)[K];
};
