# webapp

> The HyreAgent.ai React + Vite web application — the primary user-facing surface.

## Purpose

Single-page React app for authenticated job seekers. Lets users browse the daily-curated job feed, see AI match scores, track applications, manage their resume, and outreach to contacts. Deployed to Vercel.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [React 18](https://react.dev/) with [Vite](https://vitejs.dev/) |
| Language | TypeScript (strict) |
| Routing | React Router |
| Forms | React Hook Form + [Zod](https://zod.dev/) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Local state; server state via fetch wrappers (calls `platform` services through `/api/v1/*`) |
| Testing | Vitest + React Testing Library |
| Auth | Supabase JS client (session tokens), validated by `platform` gateway |
| Lint / format | ESLint (`@hyreagent-ai/eslint-config`) + Prettier |
| Pre-commit | Husky + lint-staged |

## Prerequisites

- Node.js ≥ 22 (LTS)
- npm ≥ 10 (or pnpm if standardized later)
- Access to `HyreAgent-ai/platform` for API contracts and types

## Getting started

```bash
git clone -b dev git@github.com:HyreAgent-ai/webapp.git
cd webapp
npm install
cp .env.example .env.local
# fill in:
#   VITE_API_BASE_URL=http://localhost:3000/api/v1
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
npm run dev
```

App boots at http://localhost:5173.

## Scripts

```bash
npm run dev          # Vite dev server with HMR
npm run build        # production build → dist/
npm run preview      # serve dist/ locally for verification
npm run test         # Vitest in watch mode
npm run test:run     # Vitest one-shot (CI mode)
npm run test:coverage  # coverage report (must meet floor in CI)
npm run lint         # ESLint
npm run lint:fix
npm run typecheck    # tsc --noEmit
```

## Branching

- `main` → deployed to https://hyreagent.ai (prod)
- `dev` → deployed to https://dev.hyreagent.ai (staging)
- Feature branches: `<username>_<issue#>_<short-description>`

## Folder layout

```
src/
├── components/         # leaf UI components (one per file)
├── routes/             # page-level components, one per route
├── lib/                # client-side helpers (apiClient, supabase, formatters)
├── stores/             # zustand or react-context stores if any
├── hooks/              # custom hooks
├── types/              # local types (shared types live in @hyreagent-ai/common)
└── main.tsx            # entry
```

## Where the data comes from

The webapp **never** talks directly to Supabase for application data. It calls `https://hyreagent.ai/api/v1/*` (the gateway in `platform`), which validates auth, applies rate limits and cost ceilings, then talks to Supabase on the user's behalf.

Exception during migration: until the gateway covers every endpoint, some `storage.js` calls still go browser-to-Supabase. See migration progress in [`docs/wiki/Migration-current-to-target`](https://github.com/HyreAgent-ai/docs/wiki/Migration-current-to-target).

## Deployment

- **prod (`main`):** Vercel auto-deploys; CI gates: lint + typecheck + test + coverage floor
- **staging (`dev`):** Vercel auto-deploys to a preview URL
- **PR previews:** Vercel preview URL per PR

## Contributing

See [CONTRIBUTING.md](https://github.com/HyreAgent-ai/.github/blob/main/CONTRIBUTING.md). PRs target `dev`, never `main`.

## License

[Apache-2.0](./LICENSE)

## Contact

- Maintainer: [@Siddardth7](https://github.com/Siddardth7)
- Issues: file in this repo with the `service/webapp` label
- Architecture questions: [docs/wiki/Architecture](https://github.com/HyreAgent-ai/docs/wiki/Architecture)
