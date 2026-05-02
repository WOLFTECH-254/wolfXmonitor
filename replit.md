# wolfXmonitor — Uptime Monitoring SaaS

## Overview

A full-stack multi-user uptime monitoring SaaS. Pings URLs at configurable intervals, sends email alerts on downtime/recovery, and includes a public status page, Pro plan via Paystack, and a full admin control panel.

## Branding

- **Name**: wolfXmonitor
- **Theme**: Dark green-tinted (`#080e0a` bg, `#22c55e` primary)
- **Fonts**: Barlow Condensed (display) + Space Mono (mono)
- **Domain target**: `monitor.xwolf.space`
- **Email sender**: `alerts@xwolf.space` (Brevo, domain `xwolf.space` authenticated)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, TypeScript 5.9
- **API**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod, `drizzle-zod`, generated Zod schemas (`lib/api-zod`)
- **API codegen**: Orval from OpenAPI spec (`lib/api-spec`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TanStack Query + Recharts (`artifacts/uptime-monitor`)
- **Email**: Brevo SMTP API (key in DB settings + env fallback)
- **Payments**: Paystack inline popup (keys in DB settings)

## Features

### User Features
- Sign up with name, email, country, password
- Dashboard: live status, uptime %, global overview stats
- Add monitors (name, URL, ping interval)
- Per-monitor detail: uptime bar chart, response time line chart, ping history
- Manual "Ping Now" button, toggle active/inactive, delete monitors
- Email alerts: downtime, recovery, welcome (monitor added), monitor deleted
- Public status page (`/status`) — all monitors
- Per-monitor public page (`/status/:id`) — uptime bar + recent checks
- Upgrade to Pro via Paystack (`/upgrade`) — removes monitor limit

### Admin Features (`/admin`)
- Overview: global stats (users, monitors, pings, uptime)
- Monitors tab: list all, toggle pause, delete
- Users tab: list all, toggle admin, delete
- Activity tab: live ping log (last 100)
- Payments tab: all Paystack transactions
- Settings tab:
  - **Email**: Brevo API key (masked), sender email/name, Test Connection
  - **Billing**: Paystack secret key (masked), public key, Pro plan price (USD → local currency), Free monitor limit

### Plans
- **Free**: up to N monitors (admin-configurable, default 5)
- **Pro**: unlimited monitors — choose from 5 durations (Weekly/Monthly/3-Month/6-Month/Yearly)
  - Each plan stores `plan_slug` + `plan_expires_at` on the user record
  - Prices in USD, auto-converted to local currency at checkout via exchange rate API
  - Kenyan users (KES) get M-Pesa STK Push option via Paystack channels
  - Admin can configure per-plan pricing, toggle active/inactive in Admin → Payments tab

## Architecture

```
artifacts/
  api-server/          Express API + background pinger scheduler
  uptime-monitor/      React frontend (Vite)
lib/
  db/                  Drizzle ORM schema
  api-spec/            OpenAPI YAML contract
  api-client-react/    Generated TanStack Query hooks
  api-zod/             Generated Zod schemas
```

### DB Tables
- `users` — id, name, email, password_hash, notification_email, notifications_enabled, is_admin, country, plan, created_at
- `monitors` — id, user_id, name, url, interval_minutes, active, last_status, last_pinged_at, last_response_time_ms, created_at
- `pings` — id, monitor_id, status, response_time_ms, status_code, error, created_at
- `settings` — key, value, updated_at (keys: brevo_api_key, brevo_sender_email, brevo_sender_name, paystack_secret_key, paystack_public_key, free_monitor_limit)
- `payments` — id, user_id, paystack_reference, amount, currency, status, plan, created_at
- `plans` — id, slug, name, duration_days, price_usd, monitor_limit, is_active, sort_order, created_at
- `users` also has: `plan_slug` (weekly/monthly/quarterly/biannual/yearly), `plan_expires_at`
- `user_sessions` — managed by connect-pg-simple (created manually, NOT via Drizzle push)

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/schemas
- `pnpm --filter @workspace/db run push` — push schema (CAUTION: will prompt to drop user_sessions)

## Important Notes

- **DB push warning**: `drizzle-kit push` detects `user_sessions` as unmanaged and asks to drop it. Always run SQL manually for schema changes to avoid session loss.
- **Auth middleware**: `requireAuth` and `requireAdmin` must be applied per-route (not `router.use()`), otherwise they block public routes like `/api/status`.
- **Brevo sender**: Only `alerts@xwolf.space` is verified. Do NOT change sender email to unverified domains.
- **Admin credentials**: `britonkiplangat0@gmail.com` / `WolfAdmin2025!`
- **Exchange rates**: `https://open.er-api.com/v6/latest/USD` (free, no key) — used at payment init.
- **Paystack currencies**: NGN (NG), GHS (GH), ZAR (ZA), KES (KE), USD (default for all others)

## Codegen Note

After running codegen, orval overwrites `lib/api-zod/src/index.ts` with stale barrel exports. The codegen script auto-patches this.
