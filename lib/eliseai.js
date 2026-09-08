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
 *       type: "default",
 *     }],
 *     query_params: {},
 *   }
 *
 * `type: "default"` was missing from the first version of this payload (an
 * earlier, incomplete capture) and caused a real 422 "field required"
 * rejection in production on 2026-09-07 — re-confirmed 2026-09-08 against a
 * fresh capture of the live widget's actual request.
 *
 * config.eliseAI.buildingId (634358) is now CONFIRMED — verified against a
 * screenshot of an actual "textMe" request captured from The Grove's own
 * live site's Network tab, not just the earlier example value.
 *
 * AUTH (confirmed 2026-09-08): a server-to-server call with just the JSON
 * body above gets 401 Unauthorized. Capturing the real request headers from
 * The Grove's own live widget (Chrome DevTools -> Network -> textMe ->
 * Request Headers) showed four things the browser sends that we weren't:
 *   - `building-slug` header = config.eliseAI.building (the UUID, not the
 *     numeric building_id used in the body)
 *   - `org-slug` header = config.eliseAI.organization
 *   - `x-securitykey` header = a static key (env var ELISEAI_SECURITY_KEY —
 *     see .env.example). Looks like a publishable/widget-scoped key rather
 *     than a per-session token (no expiry/user binding visible), which is
 *     why a plain static header works from our backend too.
 *   - `origin` / `referer` headers = the live site's real URL
 *     (config.eliseAI.siteUrl) — apparently also allowlist-checked.
 * All four are now sent below. If EliseAI ever rotates the security key,
 * recapture a fresh "textMe" request the same way to get the new value.
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

  const securityKey = process.env.ELISEAI_SECURITY_KEY;
  if (!securityKey) {
    console.warn('eliseai.notifyEliseAI: skipped — ELISEAI_SECURITY_KEY is not set.');
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
    // `type: 'default'` is required by EliseAI's textMe endpoint (confirmed
    // 2026-09-08 by capturing the real request their own live widget sends
    // via the browser Network tab) — it's not documented anywhere, and our
    // first attempt at this payload (built from an earlier, incomplete
    // screenshot) omitted it, causing a 422 "field required" rejection.
    lead_sources_with_timestamps: [
      {
        lead_source_value: 'property-website',
        timestamp_initially_logged: now,
        type: 'default',
      },
    ],
    query_params: queryParams || {},
  };

  const res = await fetch(TEXT_ME_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'building-slug': config.eliseAI.building,
      'org-slug': config.eliseAI.organization,
      'x-securitykey': securityKey,
      Origin: config.eliseAI.siteUrl,
      Referer: `${config.eliseAI.siteUrl}/`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EliseAI textMe error ${res.status}: ${body}`);
  }

  return res.json().catch(() => ({}));
}

module.exports = { notifyEliseAI, toE164 };
