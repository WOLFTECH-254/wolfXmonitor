import { defineConfig } from "drizzle-kit";
import path from "path";
import { existsSync } from "fs";

// Pick up the repo-root .env for local development (no-op in CI/prod where the
// env is already populated).
if (!process.env.DATABASE_URL) {
  const rootEnv = path.join(__dirname, "../../.env");
  if (existsSync(rootEnv)) {
    try {
      process.loadEnvFile(rootEnv);
    } catch {
      // ignore
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Forward slashes: drizzle-kit globs this path and the glob library treats
  // Windows backslashes from path.join() as escape characters.
  schema: path.join(__dirname, "./src/schema/index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
