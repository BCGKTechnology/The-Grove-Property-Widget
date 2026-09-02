/**
 * Small shared request-validation helpers for the API routes.
 * Keeps basic spam/garbage protection in one place.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// US-style 10-digit phone, loosely — strips formatting first.
const PHONE_DIGITS_RE = /^\d{10}$/;

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return PHONE_DIGITS_RE.test(digits);
}

/**
 * Rejects the request if required fields are missing/invalid, or if the
 * hidden honeypot field was filled in (a strong bot signal).
 *
 * @returns {string|null} an error message, or null if the payload is valid.
 */
function validateLeadPayload(body, { requireFields = [] } = {}) {
  if (!body || typeof body !== 'object') return 'Missing request body.';

  // Honeypot: a real visitor never sees or fills this field (hidden via CSS
  // in the widget). Any non-empty value here means a bot filled every field.
  if (body.website) return 'Rejected.';

  for (const field of requireFields) {
    if (!body[field] || String(body[field]).trim() === '') {
      return `Missing required field: ${field}`;
    }
  }

  if (body.email && !isValidEmail(body.email)) return 'Invalid email address.';
  if (body.phone && !isValidPhone(body.phone)) return 'Invalid phone number.';

  return null;
}

module.exports = { isValidEmail, isValidPhone, validateLeadPayload };
