import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { blockedIpsTable, securityEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendSecurityAlert } from "../lib/security-mailer";

let blockedCache = new Set<string>();
let lastRefresh = 0;
const CACHE_TTL = 30_000;

const KNOWN_SCANNERS = [
  "masscan", "zgrab", "nikto", "sqlmap", "nmap", "dirbuster",
  "gobuster", "wfuzz", "hydra", "medusa", "shodan", "censys",
  "python-requests", "go-http-client/1", "scrapy", "ahrefsbot",
  "semrushbot", "mj12bot", "dotbot", "blexbot",
];

export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - lastRefresh < CACHE_TTL) return;
  lastRefresh = now;
  try {
    const rows = await db.select({ ip: blockedIpsTable.ip }).from(blockedIpsTable);
    blockedCache = new Set(rows.map((r) => r.ip));
  } catch {
    /* keep old cache on error */
  }
}

export function invalidateIpCache(): void {
  lastRefresh = 0;
}

export async function ipBlockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await refreshCache();
    const ip = getClientIp(req);

    if (blockedCache.has(ip)) {
      db.insert(securityEventsTable).values({
        type: "blocked_ip",
        ip,
        path: req.path,
        method: req.method,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        details: "Blocked IP attempted access",
      }).catch(() => {});
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const ua = ((req.headers["user-agent"] as string | undefined) ?? "").toLowerCase();
    const isScanner = KNOWN_SCANNERS.some((s) => ua.includes(s));

    if (isScanner) {
      const details = `Suspicious user-agent: ${req.headers["user-agent"] ?? "(none)"}`;
      db.insert(securityEventsTable).values({
        type: "suspicious_agent",
        ip,
        path: req.path,
        method: req.method,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        details,
      }).catch(() => {});
      sendSecurityAlert({ type: "suspicious_agent", ip, path: req.path, details }).catch(() => {});
      logger.warn({ ip, ua }, "Suspicious user-agent detected");
      res.status(403).json({ error: "Access denied." });
      return;
    }

    next();
  } catch {
    next();
  }
}
