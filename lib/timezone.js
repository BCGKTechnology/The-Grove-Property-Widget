/**
 * Converts a "wall clock" date + time in a given IANA time zone (e.g. the
 * property's local time, America/Los_Angeles) into a correct UTC Date —
 * without a third-party dependency, using the platform's Intl API.
 *
 * This matters because Vercel/Netlify serverless functions typically run
 * with the server's clock in UTC. Naively doing `new Date("2026-09-10T14:30:00")`
 * would be interpreted in the *server's* zone, not the property's, silently
 * producing a calendar invite at the wrong time (off by the UTC offset,
 * currently 7 hours for Pacific Daylight Time).
 */

function getTimeZoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

/**
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:MM" (24h)
 * @param {string} timeZone - IANA zone, e.g. "America/Los_Angeles"
 * @returns {Date}
 */
function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (isNaN(naiveUtc.getTime())) return naiveUtc; // caller checks isNaN
  const offset = getTimeZoneOffsetMs(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offset);
}

/**
 * Formats a Date as an ISO-8601 string with the given zone's UTC offset
 * (e.g. "2026-09-02T15:50:16-07:00"), matching the format EliseAI's
 * platformApi expects for `timestamp_initially_logged`. Not the same as
 * `date.toISOString()`, which always renders in "Z" (UTC).
 *
 * @param {Date} date
 * @param {string} timeZone - IANA zone, e.g. "America/Los_Angeles"
 */
function formatOffsetISOString(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;

  const offsetMs = getTimeZoneOffsetMs(date, timeZone);
  const offsetMinutesTotal = Math.round(offsetMs / 60000);
  const sign = offsetMinutesTotal <= 0 ? '-' : '+';
  const absMinutes = Math.abs(offsetMinutesTotal);
  const offsetH = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const offsetM = String(absMinutes % 60).padStart(2, '0');

  return (
    `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}` +
    `${sign}${offsetH}:${offsetM}`
  );
}

module.exports = { zonedTimeToUtc, formatOffsetISOString };
