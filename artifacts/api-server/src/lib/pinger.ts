export interface PingResult {
  status: "up" | "down";
  responseTimeMs: number | null;
  statusCode: number | null;
  error: string | null;
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
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "down",
      responseTimeMs,
      statusCode: null,
      error: message.slice(0, 255),
    };
  }
}
