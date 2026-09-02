/**
 * Minimal CORS handling for the API routes.
 *
 * TODO(confirm): once we know the exact RentCafe domain the widget will run
 * on (e.g. https://thegrove.securecafe.com), replace ALLOWED_ORIGINS below
 * with that exact origin instead of "*". Leaving it as "*" is fine for a
 * public lead-capture endpoint short-term, but locking it down is best
 * practice once the real domain is known.
 */

const ALLOWED_ORIGINS = ['*'];

function applyCors(req, res) {
  const origin = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : ALLOWED_ORIGINS.includes(req.headers.origin)
    ? req.headers.origin
    : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // caller should stop handling this request
  }
  return false;
}

module.exports = { applyCors };
