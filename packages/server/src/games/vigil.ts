/** Offset IANA no instante explícito do servidor; fica fixo até mudar a preferência. */
export function resolveVigilTimezone(
  timezone: string,
  at: Date,
): {
  utcOffsetMinutes: number;
  timezoneResolved: boolean;
} {
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (offset === 'GMT') return { utcOffsetMinutes: 0, timezoneResolved: true };
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset ?? '');
    if (match !== null) {
      const minutes = Number(match[2]) * 60 + Number(match[3]);
      return {
        utcOffsetMinutes: match[1] === '-' ? -minutes : minutes,
        timezoneResolved: true,
      };
    }
  } catch {
    // Fusos antigos que esta versão de ICU não conhece entram em UTC, com aviso na visão.
  }
  return { utcOffsetMinutes: 0, timezoneResolved: false };
}
