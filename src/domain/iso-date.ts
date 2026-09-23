const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

/**
 * Accept only an ISO 8601 date or date-time with a real calendar date and
 * clock time. `Date.parse` alone repairs `2026-02-30` to 2 March and accepts
 * trailing text, which would turn an extraction error into a known fact.
 */
export function isStrictIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d, hh, mm, ss, oh, om] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return false;
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59)) return false;
  if (ss !== undefined && Number(ss) > 59) return false;
  if (oh !== undefined && (Number(oh) > 23 || Number(om) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}
