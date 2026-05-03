export interface PingResult {
  status: "up" | "down";
  responseTimeMs: number | null;
  statusCode: number | null;
  error: string | null;
}

function humanizeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err).slice(0, 255);

  // AbortController timeout
  if (err.name === "AbortError" || err.message.includes("abort")) {
    return "Request timed out (15s)";
  }

  // Node.js fetch wraps the real cause — unwrap it
  const cause = (err as Error & { cause?: unknown }).cause;
  const causeMsg = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : null;
  const raw = (causeMsg ?? err.message).toLowerCase();

  if (raw.includes("enotfound") || raw.includes("getaddrinfo") || raw.includes("dns")) {
    return "DNS resolution failed — domain does not exist";
  }
  if (raw.includes("econnrefused")) {
    return "Connection refused — server is not accepting connections";
  }
  if (raw.includes("econnreset") || raw.includes("connection reset")) {
    return "Connection reset by server";
  }
  if (raw.includes("etimedout") || raw.includes("timed out")) {
    return "Connection timed out";
  }
  if (raw.includes("cert") || raw.includes("ssl") || raw.includes("tls") || raw.includes("certificate")) {
    return "SSL/TLS certificate error";
  }
  if (raw.includes("econnaborted") || raw.includes("socket hang up")) {
    return "Connection dropped unexpectedly";
  }
  if (raw.includes("fetch failed")) {
    return causeMsg ? causeMsg.slice(0, 200) : "Network error — could not reach server";
  }

  return (causeMsg ?? err.message).slice(0, 255);
}

export async function pingUrl(url: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const status = response.ok ? "up" : "down";
    return {
      status,
      responseTimeMs,
      statusCode: response.status,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`.trim(),
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    return {
      status: "down",
      responseTimeMs,
      statusCode: null,
      error: humanizeError(err),
    };
  }
}
