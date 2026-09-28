/**
 * Invented demo data for store screenshots: one account, one contact rule,
 * and the members, notes, events and messages the views show. No real
 * person, account or message. Every write goes through JoyFox's own
 * services, so the data passes the same checks as a user's.
 */
import { AccountService } from "../../src/accounts/account-service";
import { EventTrackerService } from "../../src/events/event-service";
import type { MemberIdentity } from "../../src/identity/member-identity";
import { MessageCacheService } from "../../src/messages/message-cache-service";
import type { ProfileFacts } from "../../src/qualification/facts";
import { fromBuilderForm } from "../../src/rules/rule-builder";
import { RuleService } from "../../src/rules/rule-service";
import { SavedSearchService } from "../../src/search/saved-search-service";
import { runtimeSettingsArea } from "../../src/storage/local-settings";
import { NotesService } from "../../src/notes/notes-service";
import { TemplateService } from "../../src/templates/template-service";
import { TriageService } from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";

/** The viewer's own profile, and the members the demo inbox shows. */
export const OWN_PROFILE = "1000001";

const unknownAt = { whenUnknown: "needs-review" } as const;

/** `YYYY-MM-DDTHH:mm`, `offset` days from today. */
const day = (offset: number, time: string) =>
  `${new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)}T${time}`;

const who = (memberId: string): MemberIdentity => ({
  status: "resolved",
  memberId,
  source: "demo",
});

const messageId = (n: number) =>
  `cm-message-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const snapshots: Array<
  [
    string,
    Partial<ProfileFacts>,
    { preferences?: string[]; ownProfile?: boolean }?,
  ]
> = [
  [
    OWN_PROFILE,
    { verification: true, photoCount: 6, profileWordCount: 180 },
    {
      ownProfile: true,
      preferences: [
        "Board games",
        "Cooking",
        "Dancing",
        "Hiking",
        "Jazz",
        "Photography",
        "Travel",
      ],
    },
  ],
  [
    "2000001",
    { verification: true, photoCount: 8, profileWordCount: 240 },
    { preferences: ["Dancing", "Gardening", "Jazz", "Travel"] },
  ],
  [
    "2000003",
    { verification: true, photoCount: 5, profileWordCount: 120 },
    { preferences: ["Cooking", "Dancing", "Yoga"] },
  ],
];

async function seed(): Promise<void> {
  const accounts = new AccountService();
  const account = await accounts.createAccount({
    joyClubAccountId: "demo_member",
    label: "Demo account",
  });
  await accounts.setActiveAccount(account.id);
  const id = account.id;

  // Verified, at least 3 photos and 50 words; a sender who fails goes to
  // Quarantined, one JoyFox cannot check yet to Needs Review.
  await new RuleService().saveGlobalRule(
    id,
    fromBuilderForm({
      enabled: true,
      defaultPlacement: "quarantined",
      all: {
        verified: unknownAt,
        minimumPhotos: { value: 3, ...unknownAt },
        minimumProfileWords: { value: 50, ...unknownAt },
      },
      any: {},
    }),
  );

  const triage = new TriageService();
  for (const [member, facts, extras] of snapshots)
    await triage.captureSnapshot(id, member, facts, extras);

  const notes = new NotesService();
  await notes.saveNote(
    id,
    who("2000001"),
    "Met at the summer picnic. Prefers Sunday afternoons.",
  );
  for (const tag of ["dancing", "garden social"])
    await notes.addTag(id, who("2000001"), tag);
  await notes.addTag(id, who("2000005"), "tango");

  const trust = new TrustService();
  await trust.logOutcome(id, "2000001", "positive");
  await trust.logOutcome(id, "2000001", "positive");
  await trust.logOutcome(id, "2000003", "positive");

  const templates = new TemplateService();
  await templates.save(id, {
    name: "Friendly first reply",
    folder: "Replies",
    body: "Hi, thanks for your message! I read your profile and would be glad to talk more.",
  });
  await templates.save(id, {
    name: "Event question",
    folder: "Events",
    body: "Hi, are you going to the event on Saturday? I would like to say hello there.",
  });
  await templates.save(id, {
    name: "Polite no",
    folder: "Replies",
    body: "Thank you for writing. I do not think we are a match, but I wish you all the best.",
  });

  const events = new EventTrackerService();
  await events.save(
    id,
    "event",
    "900101",
    {
      note: "Bring a friend. Doors open at 8 pm.",
      tags: ["social", "dancing"],
      attendance: "attending",
    },
    {
      title: "Summer Garden Social",
      startLocal: day(5, "20:00"),
      path: "/event/900101.summer_garden_social.html",
      venueName: "Example Garden Club",
    },
    null,
  );
  await events.save(
    id,
    "event",
    "900102",
    { note: "", tags: ["workshop"], attendance: "interested" },
    {
      title: "Tango for Beginners",
      startLocal: day(12, "19:00"),
      path: "/event/900102.tango_for_beginners.html",
      venueName: "Demo Dance Studio",
    },
    null,
  );
  await events.save(
    id,
    "event",
    "900103",
    {
      note: "Great music. Go again next year.",
      tags: ["music"],
      attendance: "attended",
    },
    {
      title: "Autumn Jazz Night",
      startLocal: day(-20, "21:00"),
      path: "/event/900103.autumn_jazz_night.html",
      venueName: "Sample Hall",
    },
    null,
  );

  const messages = new MessageCacheService(runtimeSettingsArea);
  await messages.store(id, "personal-1000001-2000001", "2000001", [
    {
      messageId: messageId(1),
      direction: "received",
      sentAt: `${day(-3, "18:10")}:00Z`,
      text: "Hi! I saw you are going to the Summer Garden Social too. Shall we meet at the entrance?",
    },
    {
      messageId: messageId(2),
      direction: "sent",
      sentAt: `${day(-3, "18:40")}:00Z`,
      text: "Good idea! I will be there at 8 pm, near the fountain.",
    },
  ]);

  await new SavedSearchService().save(id, {
    name: "Nearby, verified",
    url: "https://www.joyclub.de/member/?verified=1&distance=50",
  });
}

(globalThis as { seedReady?: Promise<void> }).seedReady = seed();
