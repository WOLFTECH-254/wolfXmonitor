# PingWatch — Uptime Monitor

## Overview

A site uptime monitoring tool that pings URLs at regular intervals to keep services alive (especially Render projects that sleep after 15 minutes of inactivity). Features a dark terminal aesthetic with black backgrounds and muted forest green accents.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TanStack Query + Recharts
- **Theme**: Black + muted sage/forest green, Space Mono monospace font

## Features

- Add monitors with a name, URL, and ping interval (minutes)
- Automatic background pinging via server-side scheduler
- Dashboard with live status, uptime %, global overview stats
- Per-monitor detail page: uptime bar chart, response time line chart, ping history
- Manual "Ping Now" button
- Toggle active/inactive per monitor
- Delete monitors

## Architecture

- `artifacts/api-server` — Express API + background pinger scheduler
- `artifacts/uptime-monitor` — React frontend
- `lib/db` — Drizzle ORM schema (`monitorsTable`, `pingsTable`)
- `lib/api-spec/openapi.yaml` — API contract
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Codegen Note

After running codegen, orval overwrites `lib/api-zod/src/index.ts` with stale barrel exports. The codegen script auto-patches this by rewriting the file to only export from `./generated/api`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
