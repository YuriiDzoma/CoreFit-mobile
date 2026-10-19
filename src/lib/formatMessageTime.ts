// Ukrainian-only, same deliberate precedent as lib/lastActive.ts (and
// profile's own "Реєстрація: DD.MM.YYYY" line) -- date/time display in
// this app already hardcodes Ukrainian-locale formatting regardless of
// the selected app language, this follows that rather than introducing a
// separate i18n-aware formatter just for Messages.

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const timeFormatter = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });
const dayMonthFormatter = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' });
const fullDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** A chat bubble's own timestamp -- always just the time, the date divider
 * above it (see `formatDateDivider`) already carries the day. */
export function formatBubbleTime(isoString: string): string {
  return timeFormatter.format(new Date(isoString));
}

/** The conversation list's per-row timestamp -- today's time for a
 * message sent today, otherwise a date (year omitted unless it isn't the
 * current one), mirroring how most chat apps scale this down as a
 * message ages rather than always showing a full timestamp. */
export function formatConversationTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  if (isSameDay(date, now)) return timeFormatter.format(date);
  if (date.getFullYear() === now.getFullYear()) return dayMonthFormatter.format(date);
  return fullDateFormatter.format(date);
}

/** The day label shown once above the first message of each calendar day
 * in a chat thread -- "Сьогодні"/"Вчора" for the two recent, meaningfully
 * different cases, a full date otherwise. */
export function formatDateDivider(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  if (isSameDay(date, now)) return 'Сьогодні';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Вчора';

  return fullDateFormatter.format(date);
}
