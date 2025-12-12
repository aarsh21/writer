# AGENTS.md
Scope: repository-wide guidance for all agents.
Install deps: `bun install` at repo root.
Full dev (turbo): `bun run dev`.
Full build (turbo): `bun run build`.
Type check all: `bun run check-types`.
Web dev server only: `cd apps/web && bun run dev:web` (port 3001).
Desktop dev: `cd apps/web && bun run desktop:dev`.
Web build: `cd apps/web && bun run build`; desktop build: `cd apps/web && bun run desktop:build`.
Backend dev/setup: `cd packages/backend && bun run dev` or `bun run dev:setup`.
Tests currently absent; when added (e.g., Vitest) run single test via `bun test path -t "name"`.
Imports: prefer type-only imports with `import type` (verbatimModuleSyntax), group external/internal/relative; use `@/*` alias in web.
Formatting: follow existing style (tabs indentation, double quotes, trailing commas, no semicolons).
Components: favor named React function components; type props with `React.ComponentProps` or explicit interfaces; use `cn` helper for class merging.
State/data: use TanStack Router conventions; keep route context typed; preload intent defaults respected.
Styling: Tailwind v4 + shadcn/ui utilities; keep token usage consistent with `@theme` variables.
Error handling: fail fast on missing prerequisites, surface user-facing errors via UI affordances rather than silent failures.
Convex backend: keep functions typed against generated schema; avoid direct env access in client bundles.
Auth: use `ConvexBetterAuthProvider` wiring from `src/main.tsx`; reuse shared `authClient`.
Secrets: never commit .env files; follow .gitignore patterns.

## btca
Trigger: user says "use btca" (for codebase/docs questions).
Run:
- btca ask -t <tech> -q "<question>"
Available <tech>: react,tauri,tanstack-router,tailwindcss,convex,shadcn,tiptap,better-auth
