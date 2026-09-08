// Ukrainian-only, deliberately not threaded through the app's i18n system --
// every other date/time display in this app (training history dates, the
// profile "Реєстрація" line) already hardcodes Ukrainian-locale formatting
// regardless of the selected app language. This follows that precedent.

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_WEEK = 7 * ONE_DAY;

function pluralUk(n: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];

  return forms[2];
}

export type LastActive = { text: string; isOnline: boolean };

export function formatLastActive(lastActiveAt: string | null): LastActive | null {
  if (!lastActiveAt) return null;

  const diffSeconds = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (diffSeconds < 0) return { text: 'Онлайн', isOnline: true };

  if (diffSeconds < ONE_MINUTE) {
    return { text: 'Онлайн', isOnline: true };
  }

  if (diffSeconds < ONE_HOUR) {
    const minutes = Math.floor(diffSeconds / ONE_MINUTE);
    return {
      text: `${minutes} ${pluralUk(minutes, ['хвилину', 'хвилини', 'хвилин'])} тому`,
      isOnline: false,
    };
  }

  if (diffSeconds < ONE_DAY) {
    const hours = Math.floor(diffSeconds / ONE_HOUR);
    const minutes = Math.floor((diffSeconds % ONE_HOUR) / ONE_MINUTE);
    return {
      text: `${hours} ${pluralUk(hours, ['годину', 'години', 'годин'])} ${minutes} ${pluralUk(minutes, ['хвилину', 'хвилини', 'хвилин'])} тому`,
      isOnline: false,
    };
  }

  if (diffSeconds < ONE_WEEK) {
    const days = Math.floor(diffSeconds / ONE_DAY);
    return {
      text: `${days} ${pluralUk(days, ['день', 'дні', 'днів'])} тому`,
      isOnline: false,
    };
  }

  const date = new Date(lastActiveAt);
  const datePart = date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return { text: `${datePart}, ${timePart}`, isOnline: false };
}
