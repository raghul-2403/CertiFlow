// Small in-memory rate limiter for public endpoints (no extra package needed).
// Allows `max` requests per IP address in each `windowMs`.
import { ApiError } from './ApiError.js';

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 30, message = 'Too many attempts. Wait a few minutes and try again.' } = {}) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.reset < now) hits.delete(ip);
  }, windowMs);
  sweep.unref();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - now) / 1000));
      return next(new ApiError(429, message));
    }
    return next();
  };
}
