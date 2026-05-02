import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { securityEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendSecurityAlert } from "../lib/security-mailer";

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

async function logRateLimitEvent(req: Request, detail: string) {
  const ip = getIp(req);
  try {
    await db.insert(securityEventsTable).values({
      type: "rate_limit",
      ip,
      path: req.path,
      method: req.method,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      details: detail,
    });
  } catch (e) {
    logger.warn({ ip, detail }, "Failed to log rate limit event");
  }
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIp(req),
  handler: async (req, res) => {
    await logRateLimitEvent(req, "Global rate limit exceeded (300 req/15 min)");
    res.status(429).json({ error: "Too many requests. Please slow down." });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIp(req),
  handler: async (req, res: Response) => {
    const ip = getIp(req);
    await logRateLimitEvent(req, "Auth rate limit hit (12 req/15 min) — brute force suspected");
    try {
      await sendSecurityAlert({
        type: "rate_limit",
        ip,
        path: req.path,
        details: "Auth endpoint rate limit exceeded — possible brute force attack.",
      });
    } catch { /* non-critical */ }
    res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIp(req),
  handler: async (req, res: Response) => {
    await logRateLimitEvent(req, "API rate limit exceeded (120 req/min)");
    res.status(429).json({ error: "Too many requests. Please wait a moment." });
  },
});
