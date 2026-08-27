import type { Request } from "express";
import { db } from "@workspace/db";
import { securityEventsTable } from "@workspace/db";
import { logger } from "./logger";
import { sendSecurityAlert } from "./security-mailer";

/**
 * Throttled security-event recorder.
 *
 * The old code inserted one `security_events` row (and sometimes sent an email)
 * for EVERY offending request. A single misbehaving client or a browser
 * extension hammering `/api/*` could write hundreds of near-identical rows a
 * minute. This coalesces them: at most one DB row per (ip, type) per
 * EVENT_COOLDOWN, carrying a count of how many were suppressed, and at most one
 * alert email per (ip, type) per ALERT_COOLDOWN.
 */

const EVENT_COOLDOWN_MS = 5 * 60_000; // one row per ip+type per 5 min
const ALERT_COOLDOWN_MS = 60 * 60_000; // one email per ip+type per hour
const MAX_KEYS = 5_000;

const lastEvent = new Map<string, { ts: number; suppressed: number }>();
const lastAlert = new Map<string, number>();

function evict(map: Map<string, unknown>): void {
  while (map.size > MAX_KEYS) {
    const first = map.keys().next().value as string | undefined;
    if (first === undefined) break;
    map.delete(first);
  }
}

/** Proxy-aware client IP. Trusts Express's resolution (see `trust proxy`). */
export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function recordSecurityEvent(opts: {
  type: string;
  ip: string;
  path?: string | null;
  method?: string | null;
  userAgent?: string | null;
  details: string;
  /** Also email the admin (still throttled to once per ip+type per hour). */
  alert?: boolean;
}): void {
  const key = `${opts.ip}|${opts.type}`;
  const now = Date.now();
  const prev = lastEvent.get(key);

  if (prev && now - prev.ts < EVENT_COOLDOWN_MS) {
    prev.suppressed++;
    return; // coalesced — no DB write, no log spam
  }

  const suppressed = prev?.suppressed ?? 0;
  lastEvent.set(key, { ts: now, suppressed: 0 });
  evict(lastEvent);

  const mins = Math.round(EVENT_COOLDOWN_MS / 60_000);
  const details =
    suppressed > 0
      ? `${opts.details} — plus ${suppressed} similar event${suppressed === 1 ? "" : "s"} suppressed in the last ${mins}m`
      : opts.details;

  db.insert(securityEventsTable)
    .values({
      type: opts.type,
      ip: opts.ip,
      path: opts.path ?? null,
      method: opts.method ?? null,
      userAgent: opts.userAgent ?? null,
      details,
    })
    .catch((e) => logger.warn({ err: String(e) }, "Failed to record security event"));

  if (opts.alert) {
    const at = lastAlert.get(key);
    if (!at || now - at > ALERT_COOLDOWN_MS) {
      lastAlert.set(key, now);
      evict(lastAlert);
      sendSecurityAlert({
        type: opts.type,
        ip: opts.ip,
        path: opts.path ?? "",
        details,
      }).catch(() => {});
    }
  }
}
