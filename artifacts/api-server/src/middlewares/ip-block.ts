import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { blockedIpsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { recordSecurityEvent, clientIp } from "../lib/security-log";

let blockedCache = new Set<string>();
let lastRefresh = 0;
const CACHE_TTL = 30_000;

/**
 * Real offensive-security tooling only. Deliberately NOT including generic HTTP
 * client UAs (python-requests, go-http-client, curl, …) — those are how people
 * legitimately hit the API and how uptime checkers probe it. Blocking + logging
 * every one of those was a big source of security-log spam.
 */
const KNOWN_SCANNERS = [
  "masscan", "zgrab", "nikto", "sqlmap", "nmap", "dirbuster",
  "gobuster", "wfuzz", "hydra", "medusa", "wpscan", "acunetix",
  "nessus", "openvas", "metasploit",
];

/** @deprecated use clientIp from lib/security-log */
export function getClientIp(req: Request): string {
  return clientIp(req);
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
  next: NextFunction,
): Promise<void> {
  try {
    await refreshCache();
    const ip = clientIp(req);

    if (blockedCache.has(ip)) {
      recordSecurityEvent({
        type: "blocked_ip",
        ip,
        path: req.path,
        method: req.method,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        details: "Blocked IP attempted access",
      });
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const ua = ((req.headers["user-agent"] as string | undefined) ?? "").toLowerCase();
    const scanner = KNOWN_SCANNERS.find((s) => ua.includes(s));

    if (scanner) {
      recordSecurityEvent({
        type: "suspicious_agent",
        ip,
        path: req.path,
        method: req.method,
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
        details: `Security scanner user-agent detected: ${scanner}`,
        alert: true,
      });
      logger.warn({ ip, scanner }, "Security scanner user-agent detected");
      res.status(403).json({ error: "Access denied." });
      return;
    }

    next();
  } catch {
    next();
  }
}
