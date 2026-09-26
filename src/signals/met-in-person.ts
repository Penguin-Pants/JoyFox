/**
 * V1-10 (owner, 2026-09-26): the viewer's own "met in person" mark (the green
 * shield, code 3), as the member's profile page last showed it. A guest-list
 * entry shows no shield (`14-events.md`), so its card signals read this record
 * instead; every other surface reads the shield it shows, and triage reads the
 * live mark only.
 *
 * One `ExtensionPreference` per member, updated in place: it exists while the
 * profile page shows the mark and is deleted when a profile read shows none,
 * so removing the mark on JoyClub clears it on the next profile visit.
 */
export const MET_IN_PERSON_KEY = "metInPerson";
export const metInPersonId = (memberId: string) => `met-in-person:${memberId}`;
