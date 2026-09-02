/**
 * Stand-alone script to confirm your Postmark server token actually works,
 * before wiring anything up to Vercel or RentCafe.
 *
 * Usage (from this project's folder):
 *   POSTMARK_SERVER_TOKEN=xxxxxxxx FROM_EMAIL=you@yourdomain.com TO_EMAIL=you@yourdomain.com node scripts/test-postmark.js
 *
 * - POSTMARK_SERVER_TOKEN: the real "Server API token" from Postmark
 *   (Servers -> [your server] -> API Tokens).
 * - FROM_EMAIL: must be an address/domain you've verified as a Postmark
 *   Sender Signature (or on a verified sending domain) — Postmark will
 *   reject the send otherwise.
 * - TO_EMAIL: where the test email should land — use an inbox you can
 *   check right away.
 *
 * If this script prints "Sent!", your token and sender are both good and
 * ready to put into Vercel's environment variables.
 */

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email';

async function main() {
  const apiToken = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.FROM_EMAIL;
  const to = process.env.TO_EMAIL;

  if (!apiToken || !from || !to) {
    console.error(
      'Usage: POSTMARK_SERVER_TOKEN=... FROM_EMAIL=... TO_EMAIL=... node scripts/test-postmark.js'
    );
    process.exit(1);
  }

  const res = await fetch(POSTMARK_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': apiToken,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: 'Test email from The Grove widget setup',
      TextBody: 'If you are reading this, your Postmark server token and sender are both working.',
      MessageStream: 'outbound',
    }),
  });

  if (res.ok) {
    console.log('Sent! Check the inbox for', to);
  } else {
    const body = await res.text().catch(() => '');
    console.error(`Postmark rejected the request (HTTP ${res.status}):`);
    console.error(body);
    console.error(
      '\nCommon causes: FROM_EMAIL is not yet a verified Sender Signature/domain in Postmark ' +
        '(Sender Signatures in your Postmark account), or the server token is wrong or ' +
        'belongs to a different Postmark server than you expect.'
    );
    process.exit(1);
  }
}

main();
