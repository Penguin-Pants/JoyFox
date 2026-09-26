const MONTHS: Readonly<Record<string, number>> = {
  januar: 1,
  jänner: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const pad = (value: number) => String(value).padStart(2, "0");

function validDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * An event's start as JoyClub shows it (14-events.md), in the event's own
 * local time: "Samstag, 27. September 2026 - ab 21:00" gives
 * `2026-09-27T21:00`, and a date without a time gives `2026-09-27`. A
 * numeric date ("27.09.2026") is read too. Anything else, or a date that
 * does not exist, gives `undefined`: JoyFox never guesses a date.
 */
export function parseEventStart(text: string): string | undefined {
  const clean = text.replace(/\s+/gu, " ").trim();
  let year: number;
  let month: number;
  let day: number;
  const named = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})/u.exec(clean);
  const numeric = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/u.exec(clean);
  if (named) {
    const found = MONTHS[named[2]!.toLowerCase()];
    if (!found) return undefined;
    day = Number(named[1]);
    month = found;
    year = Number(named[3]);
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else return undefined;
  if (!validDay(year, month, day)) return undefined;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const time = /\b(\d{1,2}):(\d{2})\b/u.exec(clean);
  if (!time) return date;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return date;
  return `${date}T${pad(hour)}:${pad(minute)}`;
}
