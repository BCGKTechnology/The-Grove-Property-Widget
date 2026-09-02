/**
 * Hands a phone number to EliseAI's "textMe" endpoint so their AI texts the
 * prospect back and starts the conversation — the behavior BCGK wants for
 * "Call or Text Us."
 *
 * Endpoint and payload shape provided directly by BCGK (Chuck), captured
 * from the network request their own site's existing EliseAI widget makes:
 *
 *   POST https://app.meetelise.com/platformApi/state/create/textMe
 *   {
 *     building_id: 634358,                       // numeric — see TODO below
 *     lead_sources: ["property-website"],
 *     phone_number: "+14157220181",               // E.164
 *     referrer: "",
 *     conversation_tracking_id: "webchat_lead_<uuid>",
 *     lead_sources_with_timestamps: [{
 *       lead_source_value: "property-website",
 *       timestamp_initially_logged: "2026-09-02T15:50:16-07:00",
 *     }],
 *     query_params: {},
 *   }
 *
 * config.eliseAI.buildingId (634358) is now CONFIRMED — verified against a
 * screenshot of an actual "textMe" request captured from The Grove's own
 * live site's Network tab, not just the earlier example value.
 *
 * Still TODO before relying on this in production:
 *  1. This is an internal EliseAI platform API, not publicly documented.
 *     It may enforce checks we can't see from the payload alone (e.g. a
 *     Referer/Origin allowlist tied to the requesting domain, or session
 *     state established by first loading the widget/page). If server-to-
 *     server calls from our backend get rejected, the likely next step is
 *     setting an Origin/Referer header matching the real RentCafe domain
 *     once it's known (see requirements doc), or asking BCGK's EliseAI rep
 *     to confirm this call is supported from a non-browser context.
 *  2. This has not yet been fired against EliseAI's real endpoint — doing
 *     that sends a real text to a real phone number, which needs the
 *     account holder's explicit go-ahead and ideally a test number they
 *     control, not something to trigger unilaterally.
 */

const config = require('./config');
const { formatOffsetISOString } = require('./timezone');

const TEXT_ME_ENDPOINT = 'https://app.meetelise.com/platformApi/state/create/textMe';

/** Normalizes a US phone number (any common formatting) to E.164 (+1XXXXXXXXXX). */
function toE164(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  throw new Error(`Cannot normalize phone number to E.164: ${phone}`);
}

function randomTrackingId() {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : require('crypto').randomUUID();
  return `webchat_lead_${uuid}`;
}

/**
 * @param {Object} opts
 * @param {string} opts.phone - raw phone number as entered by the visitor
 * @param {string} [opts.referrer] - document.referrer from the widget, if any
 * @param {Object} [opts.queryParams] - the page's query params, if any
 */
async function notifyEliseAI({ phone, referrer = '', queryParams = {} }) {
  const buildingId = config.eliseAI.buildingId;
  if (!buildingId) {
    console.warn('eliseai.notifyEliseAI: skipped — config.eliseAI.buildingId is not set.');
    return { skipped: true };
  }

  const phoneE164 = toE164(phone);
  const now = formatOffsetISOString(new Date(), config.property.timezone);

  const payload = {
    building_id: buildingId,
    lead_sources: ['property-website'],
    phone_number: phoneE164,
    referrer,
    conversation_tracking_id: randomTrackingId(),
    lead_sources_with_timestamps: [
      { lead_source_value: 'property-website', timestamp_initially_logged: now },
    ],
    query_params: queryParams || {},
  };

  const res = await fetch(TEXT_ME_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EliseAI textMe error ${res.status}: ${body}`);
  }

  return res.json().catch(() => ({}));
}

module.exports = { notifyEliseAI, toE164 };
