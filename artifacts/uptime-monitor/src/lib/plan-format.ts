/** Human-readable plan values for UI. Mirrors the backend's helpers. */

export const isUnlimited = (n: number) => n < 0;

export function limitLabel(n: number): string {
  return isUnlimited(n) ? "Unlimited" : String(n);
}

export function monitorsLabel(n: number): string {
  return isUnlimited(n) ? "Unlimited monitors" : `${n} monitor${n === 1 ? "" : "s"}`;
}

export function intervalLabel(seconds: number): string {
  if (seconds < 60) return `Checks every ${seconds} seconds`;
  const m = Math.round(seconds / 60);
  return `Checks every ${m} minute${m === 1 ? "" : "s"}`;
}

export function retentionLabel(days: number): string {
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"} history`;
  if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"} history`;
  return `${days} days history`;
}

export function statusPagesLabel(n: number): string {
  if (n === 0) return "No status pages";
  return isUnlimited(n) ? "Unlimited status pages" : `${n} status page${n === 1 ? "" : "s"}`;
}

export function teamLabel(n: number): string {
  if (n <= 1) return "Single user";
  return isUnlimited(n) ? "Unlimited team members" : `${n} team members`;
}

/** Interval options a plan permits, for a monitor form dropdown. */
const ALL_INTERVALS = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];
export function allowedIntervals(minSeconds: number): { value: number; label: string }[] {
  return ALL_INTERVALS.filter((s) => s >= minSeconds).map((s) => ({
    value: s,
    label: s < 60 ? `Every ${s} seconds` : `Every ${s / 60} minute${s === 60 ? "" : "s"}`,
  }));
}
