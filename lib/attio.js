/**
 * Minimal Attio API wrapper (v2 REST API) using fetch.
 *
 * Requires env var ATTIO_API_KEY — a workspace API key with these scopes:
 *   - object_configuration:read
 *   - record_permission:read-write
 * (see README.md "Configuring Attio" for how to create one and where the
 * TheGroveCustomWidget object's real attribute slugs come from).
 *
 * Uses the "upsert" endpoint (PUT, with a `matching_attribute`) rather than
 * plain create (POST), so a person who submits twice — e.g. emails an
 * agent, then later books a tour with the same email — updates one Attio
 * record instead of creating a duplicate. See docs.attio.com/rest-api for
 * the underlying API this wraps.
 */

const config = require('./config');

const ATTIO_BASE = 'https://api.attio.com/v2';

/**
 * Creates or updates a record in the TheGroveCustomWidget object.
 *
 * @param {Object} fields - keys matching config.attio.attributeMap's keys
 *   (e.g. { firstName, lastName, email, phone, message, leadSource, ... }).
 *   Only keys present in attributeMap and with a defined value are sent.
 * @param {'email'|'phone'} [matchOn='email'] - which field to de-duplicate
 *   on. Use 'phone' when the submission has no email (e.g. the Call/Text
 *   form). Falls back to a plain create if the chosen field has no value.
 */
async function createLeadRecord(fields, matchOn = 'email') {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    throw new Error('ATTIO_API_KEY is not set');
  }

  const values = {};
  for (const [ourKey, attioSlug] of Object.entries(config.attio.attributeMap)) {
    const value = fields[ourKey];
    if (value === undefined || value === null || value === '') continue;
    // Attio's create/upsert API takes plain values for single-value
    // attributes (a string for text/email/phone, NOT an array of
    // {value: ...} objects) — see docs.attio.com/rest-api/endpoint-
    // reference/records/create-a-record for the exact shape.
    values[attioSlug] = String(value);
  }

  const matchField = config.attio.attributeMap[matchOn];
  const matchValue = fields[matchOn];
  const useUpsert = matchField && matchValue;

  const url = useUpsert
    ? `${ATTIO_BASE}/objects/${config.attio.objectSlug}/records?matching_attribute=${encodeURIComponent(
        matchField
      )}`
    : `${ATTIO_BASE}/objects/${config.attio.objectSlug}/records`;

  const res = await fetch(url, {
    method: useUpsert ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { values } }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Attio error ${res.status}: ${body}`);
  }

  return res.json();
}

module.exports = { createLeadRecord };
