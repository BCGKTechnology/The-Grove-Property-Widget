/**
 * POST /api/call-text
 *
 * Handles "Call or Text Us" submissions (the single-field phone-number form
 * on the "Contact Our Leasing Team" view):
 *  1. Emails the lead details to the Reffie ingestion inbox + the BCGK team
 *     (same recipients/pattern as the other two forms).
 *  2. Writes a lead record to Attio.
 *  3. Hands the phone number to EliseAI's textMe endpoint so its AI can
 *     text the prospect back and start the conversation. See
 *     lib/eliseai.js for the payload shape (provided by BCGK) and, in
 *     particular, the TODO on `config.eliseAI.buildingId` — this step is a
 *     safe no-op until that's confirmed and set.
 *
 * Body: { phone, referrer, queryParams, website (honeypot) }
 * ("referrer"/"queryParams" are optional context the widget can pass along
 * for EliseAI's lead-attribution fields — see public/widget.js.)
 */

const config = require('../lib/config');
const { sendEmail } = require('../lib/email');
const { createLeadRecord } = require('../lib/attio');
const { notifyEliseAI } = require('../lib/eliseai');
const { validateLeadPayload } = require('../lib/validate');
const { isRateLimited, getClientIp } = require('../lib/ratelimit');
const { applyCors } = require('../lib/cors');

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
  const validationError = validateLeadPayload(body, { requireFields: ['phone'] });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const { phone, referrer, queryParams } = body;

  const summaryLines = [
    `New "Call or Text Us" lead — ${config.property.name}`,
    '',
    `Phone: ${phone}`,
    'Source: widget "Send Us a Text" form (no name/email collected on this form).',
  ];

  const results = await Promise.allSettled([
    sendEmail({
      to: config.detailsEmailRecipients,
      subject: `New lead: ${phone} — Call or Text Us (${config.property.name})`,
      text: summaryLines.join('\n'),
    }),
    createLeadRecord(
      {
        phone,
        leadSource: 'Call or Text Us',
        property: config.property.name,
      },
      'phone' // no email collected on this form — de-dupe on phone instead
    ),
    notifyEliseAI({ phone, referrer, queryParams }),
  ]);

  const [emailResult, attioResult, eliseResult] = results;

  if (emailResult.status === 'rejected') {
    console.error('call-text: failed to send email', emailResult.reason);
  }
  if (attioResult.status === 'rejected') {
    console.error('call-text: failed to write to Attio', attioResult.reason);
  }
  if (eliseResult.status === 'rejected') {
    // Not fatal to the request — see lib/eliseai.js. Logged so it's visible
    // in Vercel's function logs once this is wired up for real.
    console.error('call-text: EliseAI hand-off failed', eliseResult.reason);
  }

  // The visitor-facing outcome only depends on email + Attio; the EliseAI
  // hand-off (still unimplemented, see lib/eliseai.js) never blocks success.
  if (emailResult.status === 'rejected' && attioResult.status === 'rejected') {
    res.status(502).json({
      error: `We could not process that. Please call us directly at ${config.contactPhoneDisplay || 'the number listed above'}.`,
    });
    return;
  }

  res.status(200).json({ ok: true });
};
