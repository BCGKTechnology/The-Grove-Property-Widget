/**
 * Extremely lightweight in-memory rate limiter.
 *
 * NOTE: serverless functions are stateless between cold starts and run as
 * multiple concurrent instances, so this only limits *bursts within one warm
 * instance* — it is a cheap first line of defense against a single bot
 * hammering the endpoint, not a substitute for a real rate-limiting service
 * (e.g. Vercel's own Edge Config / Upstash Redis) if abuse becomes a problem.
 */

const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > MAX_PER_WINDOW;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress;
}

module.exports = { isRateLimited, getClientIp };
