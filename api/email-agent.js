/**
 * POST /api/email-agent
 *
 * Handles "Email an Agent" submissions:
 *  1. Emails the lead details to the Reffie ingestion inbox + the BCGK team.
 *  2. Writes a lead record to Attio.
 *
 * Body: { firstName, lastName, email, phone, hearAboutUs, message, website }
 * ("website" is the honeypot field — see lib/validate.js.)
 */

const config = require('../lib/config');
const { sendEmail } = require('../lib/email');
const { createLeadRecord } = require('../lib/attio');
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
  const validationError = validateLeadPayload(body, {
    requireFields: ['firstName', 'lastName', 'email', 'phone'],
  });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const { firstName, lastName, email, phone, hearAboutUs, message } = body;

  const summaryLines = [
    `New "Email an Agent" lead — ${config.property.name}`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    hearAboutUs ? `How they heard about us: ${hearAboutUs}` : null,
    message ? `Message: ${message}` : null,
  ].filter(Boolean);

  const results = await Promise.allSettled([
    sendEmail({
      to: config.detailsEmailRecipients,
      subject: 'The Grove Website Lead',
      text: summaryLines.join('\n'),
    }),
    createLeadRecord({
      firstName,
      lastName,
      email,
      phone,
      message,
      hearAboutUs,
      leadSource: 'Email an Agent',
      property: config.property.name,
    }),
  ]);

  const [emailResult, attioResult] = results;

  // Log failures loudly so a lead is never silently dropped — replace this
  // with real alerting (e.g. a Slack webhook or an error-tracking service)
  // before going live. We still return success to the visitor if at least
  // one of the two integrations succeeded, since the lead was captured.
  if (emailResult.status === 'rejected') {
    console.error('email-agent: failed to send email', emailResult.reason);
  }
  if (attioResult.status === 'rejected') {
    console.error('email-agent: failed to write to Attio', attioResult.reason);
  }

  if (emailResult.status === 'rejected' && attioResult.status === 'rejected') {
    res.status(502).json({
      error: 'We could not process your request right now. Please call or text us instead.',
    });
    return;
  }

  res.status(200).json({ ok: true });
};
