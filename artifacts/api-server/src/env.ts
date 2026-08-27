// Load environment variables from a local .env file when present.
//
// In production the process manager (PM2 / systemd) injects env vars, so this is
// a no-op there. For local development it lets `node dist/index.mjs` pick up the
// repo-root .env without an extra --env-file flag or a dotenv dependency.
//
// Must be imported before any module that reads process.env at load time.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(import.meta.dirname, "../../../.env"),
];

for (const file of candidates) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // ignore malformed / unreadable .env — real env vars still apply
    }
    break;
  }
}
