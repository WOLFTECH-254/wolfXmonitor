import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";
import { recordSecurityEvent, clientIp } from "../lib/security-log";

/**
 * Rate limiting.
 *
 * These are a safety net against abuse, NOT a throttle for normal use. The SPA
 * polls a handful of `/api` endpoints every 30s per open tab plus `/api/auth/me`
 * on every navigation, so the old limits (20 req/min global, 12 auth req/15min
 * including `/me`) locked out ordinary users and every rejection wrote a
 * security-events row. Limits below are generous; logging is throttled via
 * recordSecurityEvent.
 */

// `/api/healthz` and static-ish probes shouldn't burn budget.
const skipHealth = (req: Request) => req.path === "/healthz" || req.path === "/api/healthz";

const base: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator already uses req.ip with IPv6 normalisation and is
  // proxy-aware via `trust proxy`. Don't override it with a raw XFF read.
};

/** Coarse per-IP ceiling across everything. */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 5 * 60_000,
  max: 1500, // ~5 req/s sustained
  skip: skipHealth,
  handler: (req, res) => {
    recordSecurityEvent({
      type: "rate_limit",
      ip: clientIp(req),
      path: req.path,
      method: req.method,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: "Global rate limit exceeded (1500 req / 5 min per IP)",
    });
    res.status(429).json({ error: "Too many requests. Please slow down." });
  },
});

/** Per-IP limit for the general API surface. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  max: 300, // comfortably above multi-tab 30s polling
  skip: skipHealth,
  handler: (req, res) => {
    recordSecurityEvent({
      type: "rate_limit",
      ip: clientIp(req),
      path: req.path,
      method: req.method,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: "API rate limit exceeded (300 req/min per IP)",
    });
    res.status(429).json({ error: "Too many requests. Please wait a moment." });
  },
});

/**
 * Brute-force guard for credential endpoints only. GETs (notably
 * `/api/auth/me`, hit on every page load) are exempt.
 */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60_000,
  max: 30, // login attempts / registrations per IP per 10 min
  skip: (req) => req.method === "GET" || req.method === "OPTIONS",
  handler: (req, res) => {
    recordSecurityEvent({
      type: "rate_limit",
      ip: clientIp(req),
      path: req.path,
      method: req.method,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: "Auth rate limit hit (30 attempts / 10 min) — possible brute force",
      alert: true,
    });
    res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  },
});
