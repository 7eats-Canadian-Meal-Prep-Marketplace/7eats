# CLAUDE.md

Project guidance for agents working in this repository.

## Project Structure

This repo is organized around a single Next.js app in `my-app/`. Run project
commands from `my-app/` unless a task explicitly targets repo-level tooling.

```text
7eats/
└── my-app/
    ├── app/              # Next.js App Router routes, API routes, components
    ├── db/               # Drizzle + Neon connection, schema, migrations
    ├── lib/              # Server-side helpers for waitlist, validation, rate limits
    ├── __tests__/        # Vitest tests
    └── public/           # Static assets
```

## Commands

All commands below run from `my-app/`:

```bash
pnpm dev                         # Start Next.js dev server at localhost:3000
pnpm build                       # Production build
pnpm start                       # Start production server
pnpm lint                        # Biome check
pnpm format                      # Biome format --write
pnpm test                        # Vitest watch mode
pnpm test:run                    # Vitest one-shot test run
pnpm exec tsc --noEmit           # TypeScript type check
pnpm db:generate                 # Generate Drizzle migrations
pnpm db:migrate                  # Apply generated Drizzle migrations
pnpm exec drizzle-kit push       # Push current Drizzle schema to Neon
```

If a change modifies `db/schema/**`, run Drizzle against the configured Neon
database before calling the task complete. `drizzle.config.ts` requires
`DATABASE_URL`; load it from `.env.local` without printing the value.

`pnpm db:migrate` uses `scripts/db-migrate.mjs` (Neon WebSocket + Drizzle
migrator). Do not use `drizzle-kit migrate` directly — it fails on Neon/Node
without WebSocket setup.

## Tech Stack

- **Next.js 16** with App Router, not Pages Router.
- **React 19** with Server Components by default. Add `"use client"` only for
  browser APIs, event handlers, state, or effects.
- **TypeScript** in strict mode. The `@/*` path alias maps to `my-app/`.
- **Neon Postgres** via `@neondatabase/serverless`.
- **Drizzle ORM** using `drizzle-orm/neon-http`; schema exports are centralized
  in `db/schema/index.ts`.
- **Vitest** for tests.
- **Biome** for linting, formatting, and import organization.
- **Tailwind CSS v4** plus CSS Modules for component/page-specific styling.
- **pnpm** as the package manager.

## Frontend-Backend Flow Testing (MANDATORY)

After implementing any API endpoint AND wiring it to the frontend, you MUST test the complete flow using the **Playwright MCP** before reporting the task complete.

### When this applies
- You implement a new API route (e.g., `app/api/...`) AND update frontend code to call it
- You change an existing endpoint's request/response shape AND update frontend consumers
- You integrate new data from the backend into a UI component

### How to test

1. Start the dev server if not running: `pnpm dev` (port 3000)
2. Load Playwright tools via ToolSearch, then navigate and interact:

```
ToolSearch: "select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_type,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_wait_for"
```

3. Navigate to the relevant page and interact with the feature:

```
browser_navigate: http://localhost:3000/the-relevant-page
browser_click: the button or input that triggers the endpoint
browser_wait_for: expected text or element to appear
browser_take_screenshot: capture result for verification
browser_console_messages: check for errors
```

4. Check for:
   - No 500 errors in console or network
   - The frontend renders the data correctly
   - No CSP or auth errors blocking requests

### Key Playwright MCP tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_snapshot` | Accessibility tree — use for finding element targets |
| `browser_take_screenshot` | Visual verification |
| `browser_click` | Click a button or link |
| `browser_type` | Type into an input (use `slowly: true` for autocomplete) |
| `browser_wait_for` | Wait for text to appear or a timeout |
| `browser_console_messages` | Read browser console errors/logs |
| `browser_fill_form` | Fill multiple form fields at once |

### CSP note

If Mapbox or other third-party APIs are blocked by CSP, add their domains to `connect-src` in `next.config.ts`. Current allowed origins include `https://api.mapbox.com` and `https://events.mapbox.com`.

## Database Notes

- `db/index.ts` creates the Drizzle client with `neon(DATABASE_URL)` and the
  schema barrel from `db/schema/index.ts`.
- Core schemas live in `db/schema/users.ts`, `cooks.ts`, `listings.ts`,
  `orders.ts`, `enums.ts`, and `waitlist.ts`.
- Admin RLS policies use the Neon compatibility helper:
  `auth.role() = 'admin'`.
- Service-only policies use `auth.role() = 'service_role'`.
- Mutable tables should keep `updatedAt` as `defaultNow().$onUpdate(() => new Date())`.
- Prefer explicit `onDelete` behavior on foreign keys so Drizzle push output is
  intentional and reviewable.

## Routing — use `proxy.ts` only (not `middleware.ts`)

Next.js 16 deprecated `middleware.ts` in favor of **`my-app/proxy.ts`**. Having
both files breaks dev and build.

- **Do not** create, restore, or re-export from `middleware.ts`.
- **Do** put all request routing, auth gates, and redirects in `proxy.ts`.
- Keep **client** logic (`/app`, `/app-auth`) and **business** logic
  (`/business`, `/business-auth`) in clearly separated sections — do not mix
  consumer redirects with cook/admin setup flows.
- `/` → `/app` for guests and clients; `/business/dashboard` only when a
  cook/admin session is present.

If proxy changes act weird after deleting `middleware.ts`, stop dev and remove
`my-app/.next` (stale Turbopack cache can still reference the old file).

## Key Conventions

- **Server vs. client:** Keep components server-side unless client behavior is
  required.
- **Styling:** Follow existing CSS Modules and Tailwind patterns. Shared theme
  variables live in `app/globals.css`.
- **Imports:** Use `@/` for app-root imports, for example
  `import { db } from "@/db"`.
- **Testing:** Add or update focused Vitest coverage for behavior changes,
  especially API routes, validation, rate limits, and schema safeguards.
- **Formatting:** Run Biome on touched files after edits. Avoid unrelated
  formatting churn.
