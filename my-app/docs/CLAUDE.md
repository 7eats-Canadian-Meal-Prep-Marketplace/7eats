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
