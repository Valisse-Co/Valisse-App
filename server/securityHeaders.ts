import type { RequestHandler } from "express";

// No CSP/frame restrictions here: Stripe, maps and the Manus preview embed
// require their existing integrations. API data must not enter shared caches.
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
};
export const privateApiHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  next();
};
