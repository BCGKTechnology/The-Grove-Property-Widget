/**
 * Minimal Postmark wrapper using their REST API directly via fetch, so we
 * don't need the `postmark` npm package in a small serverless function.
 *
 * Requires env var POSTMARK_SERVER_TOKEN — Postmark calls this a "Server API
 * token" (see README.md "Setting up Postmark").
 */

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email';

/**
 * @param {Object} opts
 * @param {string[]} opts.to - recipient email addresses
 * @param {string} opts.subject
 * @param {string} opts.text - plain-text body
 * @param {string} [opts.html] - optional HTML body
 * @param {{filename: string, content: string, type: string}[]} [opts.attachments]
 *   content must be base64-encoded.
 */
async function sendEmail({ to, subject, text, html, attachments }) {
  const apiToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!apiToken) {
    throw new Error('POSTMARK_SERVER_TOKEN is not set');
  }

  const config = require('./config');

  const payload = {
    From: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
    // Postmark takes recipients as a single comma-separated string, not an
    // array (unlike SendGrid) — see docs at postmarkapp.com/developer/api/email-api.
    To: to.join(','),
    Subject: subject,
    TextBody: text,
    ...(html ? { HtmlBody: html } : {}),
    MessageStream: 'outbound',
  };

  if (attachments && attachments.length) {
    payload.Attachments = attachments.map((a) => ({
      Name: a.filename,
      Content: a.content,
      ContentType: a.type,
    }));
  }

  const res = await fetch(POSTMARK_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': apiToken,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Postmark error ${res.status}: ${body}`);
  }
}

module.exports = { sendEmail };
