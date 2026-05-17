# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a Next.js monorepo. All application code lives in `my-app/`. Run all commands from that directory.

```
7eats/
└── my-app/          # Next.js application (work here)
    ├── app/         # Next.js App Router — server components by default
    ├── public/      # Static assets
    └── ...config files
```

## Commands

All commands run from `my-app/`:

```bash
pnpm dev        # Start dev server at localhost:3000
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run Biome linter (biome check)
pnpm format     # Format with Biome (biome format --write)
```

No test framework is configured yet.

## Tech Stack

- **Next.js 16** with App Router (not Pages Router)
- **React 19** — server components by default; add `"use client"` only when needed
- **TypeScript** — strict mode enabled, path alias `@/*` maps to `my-app/`
- **Tailwind CSS v4** — configured via PostCSS
- **Biome** — handles both linting and formatting (replaces ESLint + Prettier)
- **pnpm** — package manager with workspace support

## Key Conventions

- **Server vs. Client components:** Components are server-side by default in the App Router. Add `"use client"` at the top only when you need browser APIs, event handlers, or React state/effects.
- **Styling:** Use Tailwind utility classes. CSS custom properties for theming are defined in `app/globals.css`. Dark mode is supported via CSS variables.
- **Import paths:** Use `@/` prefix to reference files from the `my-app/` root (e.g., `import Foo from "@/components/Foo"`).
- **Linting:** Biome enforces recommended rules for React and Next.js domains. The `noUnknownAtRules` CSS rule is disabled to allow Tailwind directives.
