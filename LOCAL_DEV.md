# Running wolfXmonitor locally (Windows)

## One-time setup

1. `pnpm install`
2. Create `.env` in the repo root (already gitignored):

   ```
   NODE_ENV=development
   PORT=8080
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   SESSION_SECRET=<64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ```

3. `pnpm db:push` — creates/syncs the Drizzle schema on the database.

## Every day

Two terminals from the repo root:

```
pnpm dev:api    # builds + runs the Express API on http://localhost:8080
pnpm dev:web    # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to the API
(`API_PROXY_TARGET`, default `http://localhost:8080`). In production Nginx does
this instead.

`pnpm dev:api` does a full rebuild each start — re-run it after backend changes.
The frontend hot-reloads on its own.

## Notes for this environment

- The API has no `dotenv`; `artifacts/api-server/src/env.ts` loads the root `.env`
  via Node's `process.loadEnvFile`. Production keeps injecting env through PM2.
- `pnpm-workspace.yaml` originally stripped every non-Linux native binary
  (esbuild / rollup / lightningcss / tailwind-oxide) for the Replit deploy. The
  `win32-x64` builds were added back so Windows can install/build. Linux installs
  are unaffected.
- First registered account becomes the admin. Configure Paystack / Brevo /
  Telegram from `/admin`.
