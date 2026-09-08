/**
 * POST /api/book-tour
 *
 * Handles "Book a Tour" submissions:
 *  1. Emails the lead details, with the calendar invite (.ics) attached, to
 *     the same 4 recipients as every other workflow (config.emailRecipients).
 *  2. Writes a lead record to Attio.
 *
 * Body: {
 *   firstName, lastName, email, phone, bedroomPreference, hearAboutUs,
 *   tourDate (YYYY-MM-DD), tourTime (HH:MM, 24h, community-local time),
 *   website (honeypot)
 * }
 *
 * NOTE ON TIME SLOTS: this assumes a static list of available times (no
 * live conflict-check against agents' calendars) per the assumption flagged
 * in the requirements doc — confirm with BCGK before launch.
 */

const config = require('../lib/config');
const { sendEmail } = require('../lib/email');
const { createLeadRecord } = require('../lib/attio');
const { buildTourInvite } = require('../lib/ics');
const { validateLeadPayload } = require('../lib/validate');
const { isRateLimited, getClientIp } = require('../lib/ratelimit');
const { applyCors } = require('../lib/cors');
const { zonedTimeToUtc } = require('../lib/timezone');

function parseTourDateTime(tourDate, tourTime) {
  return zonedTimeToUtc(tourDate, tourTime, config.property.timezone);
}

// tourTime arrives as 24-hour "HH:MM" (that's what the <select> submits —
// see public/widget.js's own formatTime, which only reformats the dropdown
// LABEL, not the value). Without this, the email summary below showed the
// raw value ("14:00") instead of a human-readable time ("2:00 PM").
function formatTourTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests, please try again shortly.' });
    return;
  }

  const body = req.body || {};
  const validationError = validateLeadPayload(body, {
    requireFields: ['firstName', 'lastName', 'email', 'phone', 'tourDate', 'tourTime'],
  });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    bedroomPreference,
    hearAboutUs,
    tourDate,
    tourTime,
  } = body;

  const start = parseTourDateTime(tourDate, tourTime);
  if (isNaN(start.getTime())) {
    res.status(400).json({ error: 'Invalid tour date/time.' });
    return;
  }

  const summaryLines = [
    `New "Book a Tour" lead — ${config.property.name}`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Requested tour: ${tourDate} at ${formatTourTime(tourTime)} (community local time)`,
    bedroomPreference ? `Bedroom preference: ${bedroomPreference}` : null,
    hearAboutUs ? `How they heard about us: ${hearAboutUs}` : null,
  ].filter(Boolean);

  const icsContent = buildTourInvite({
    uid: `grove-tour-${Date.now()}@thegrove.example.com`,
    summary: `Tour: ${firstName} ${lastName} — ${config.property.name}`,
    description: [
      `Guided tour with an agent for ${firstName} ${lastName}.`,
      `Prospect email: ${email}`,
      `Prospect phone: ${phone}`,
      bedroomPreference ? `Bedroom preference: ${bedroomPreference}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: config.property.address,
    start,
    durationMinutes: 30,
    organizerEmail: config.fromEmail,
    attendeeEmails: config.emailRecipients,
  });

  const icsBase64 = Buffer.from(icsContent, 'utf-8').toString('base64');

  const results = await Promise.allSettled([
    // One email — lead details + calendar invite together — to all 4
    // recipients. This used to be two separate emails to two different
    // lists; consolidated into one send since both lists became the same
    // 4 people.
    sendEmail({
      to: config.emailRecipients,
      subject: 'The Grove Tour Request',
      text: summaryLines.join('\n'),
      attachments: [
        {
          filename: 'tour-invite.ics',
          content: icsBase64,
          type: 'text/calendar',
        },
      ],
    }),
    createLeadRecord({
      firstName,
      lastName,
      email,
      phone,
      bedroomPreference,
      hearAboutUs,
      tourDate,
      tourTime: formatTourTime(tourTime),
      leadSource: 'Book a Tour',
      property: config.property.name,
    }),
  ]);

  const [emailResult, attioResult] = results;

  if (emailResult.status === 'rejected') {
    console.error('book-tour: failed to send email', emailResult.reason);
  }
  if (attioResult.status === 'rejected') {
    console.error('book-tour: failed to write to Attio', attioResult.reason);
  }

  const allFailed = results.every((r) => r.status === 'rejected');
  if (allFailed) {
    res.status(502).json({
      error: 'We could not process your request right now. Please call or text us instead.',
    });
    return;
  }

  res.status(200).json({ ok: true });
};
