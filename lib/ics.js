/**
 * Hand-rolled .ics (iCalendar) generator — no external dependency needed for
 * a single VEVENT invite.
 */

function toICSDate(date) {
  // date is a JS Date in UTC; format as YYYYMMDDTHHMMSSZ
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeICSText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * @param {Object} opts
 * @param {string} opts.uid - a globally unique id for this event
 * @param {string} opts.summary
 * @param {string} opts.description
 * @param {string} opts.location
 * @param {Date} opts.start
 * @param {number} opts.durationMinutes
 * @param {string} opts.organizerEmail
 * @param {string[]} opts.attendeeEmails
 * @returns {string} the full .ics file content
 */
function buildTourInvite({
  uid,
  summary,
  description,
  location,
  start,
  durationMinutes = 30,
  organizerEmail,
  attendeeEmails = [],
}) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Grove Lead Widget//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICSText(summary)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(location)}`,
    `ORGANIZER:mailto:${organizerEmail}`,
    ...attendeeEmails.map(
      (email) =>
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`
    ),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // iCalendar requires CRLF line endings.
  return lines.join('\r\n');
}

module.exports = { buildTourInvite };
