# webapp

> The HyreAgent.ai React + Vite single-page application — the primary user-facing surface.

## Status

**Week 1 of Phase B (lift-and-shift from `Siddardth7/job-pipeline` monorepo).** Per [Decision #34](https://github.com/HyreAgent-ai/docs/wiki/Phase-A-design-contract) the architectural rewrite (storage.js dissolution, gateway pattern, 12-endpoint reorg, 5 validation spikes) is deferred to incremental post-friend-beta work. This repo currently ships the same working code as the monorepo, on the HyreAgent-AI brand, with consent UX wired and the four most user-affecting bugs fixed.

The design contract this repo is gradually moving toward is [PHASE_A_DESIGN.md](https://github.com/HyreAgent-ai/docs/wiki/PHASE-A-DESIGN) in the docs repo. Architectural debt is real, bounded, and tracked — don't refactor it without consulting Section 1.X (gateway), Section 1.5 (storage.js choreography), or Section 1.X.3 (contention budget) of that document first.

## Tech stack (as-shipped, week 1)

| Layer | Choice |
| --- | --- |
| Framework | [React 18.2](https://react.dev/) with [Vite 5](https://vitejs.dev/) |
| Language | JavaScript (TypeScript adoption deferred — Q-A1, decided post-beta) |
| Routing | Single-file `App.jsx` with component-as-view (React Router migration in Phase B) |
| Styling | Plain CSS + inline styles (Tailwind + shadcn migration deferred — Q-A5) |
| State | Local component state + custom hooks; data layer in `src/lib/storage.js` (dissolution per [Section 1.5](https://github.com/HyreAgent-ai/docs/wiki/PHASE-A-DESIGN#section-15) of the design contract) |
| Testing | [Vitest 4](https://vitest.dev/) + Testing Library + jsdom |
| Auth | Supabase JS client + JWT verified in `api/lib/auth.js` middleware (M2b shipped) |
| Icons | [lucide-react](https://lucide.dev/) |
| PDF rendering | pdfjs-dist (PERF-09 — 900KB unconditional bundle; lazy-load fix open) |
| Lint | ESLint 8 (`eslint-plugin-react`, `react-hooks`, `react-refresh`) |

## Prerequisites

- Node.js ≥ 22 (LTS) — verified on Node 24 (Vercel default)
- npm ≥ 10
- A Supabase project with the [`HyreAgent-ai/database`](https://github.com/HyreAgent-ai/database) schema applied
- API keys: Groq (LLM), Serper (contact search)

## Getting started

```bash
git clone git@github.com:HyreAgent-ai/webapp.git
cd webapp
npm install
cp .env.example .env.local  # then fill in
npm run dev
```

The app boots at http://localhost:5173.

Required env vars (all client-side use the `VITE_` prefix; server-side functions read the unprefixed names):

```
# Client-side (browser-readable, must use VITE_ prefix)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server-side (Vercel function env, never exposed to the browser)
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
GROQ_API_KEY=
SERPER_API_KEY=
INTERNAL_API_TOKEN=
ALLOWED_ORIGIN=https://app.hyreagent.ai
```

## Scripts

```bash
npm run dev      # Vite dev server with HMR
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
npm run test     # Vitest (one-shot)
npm run lint     # ESLint
```

## Folder layout (as-shipped, week 1)

```
api/                          # Vercel serverless functions
├── lib/                      # shared auth, supabase, gateway helpers (M2b)
├── v1/                       # gateway endpoints — applications, pipeline, user_job_feed
├── find-contacts.js          # AI contact search (PERSONA_LIMIT_EXCEEDED hard-cap shipped)
├── groq.js                   # Groq LLM proxy (AI-01 isolation pending)
└── parse-resume.js
src/
├── App.jsx                   # router-as-state
├── main.jsx                  # Vite entry
├── components/               # SPA pages + leaf components
├── lib/
│   ├── storage.js            # ⚠️  ~71 call sites across 10 files — to be dissolved per Section 1.5
│   ├── error-copy.js         # user-facing error message map (UA-B1 ships)
│   ├── groq.js
│   ├── supabase.js
│   └── ...
├── data/                     # local JSON (seniority-reject etc — will move to platform/data)
├── supabase.js               # Supabase client init
└── tests/                    # SPA unit tests (Vitest + Testing Library)
tests/                        # JS integration tests (root-level, kept until reorg)
public-served/                # privacy.html + terms.html (served from repo root)
```

## How auth + data flow works (today, post-M2b)

1. User signs in via Supabase JS client; receives a JWT.
2. Browser stores the JWT (Supabase SDK handles session).
3. Every authenticated request goes through `api/v1/*`:
   - `api/lib/auth.js` middleware verifies the JWT against `SUPABASE_JWT_SECRET`
   - Handler reads `userId` from the verified token; uses service-role to query Supabase with explicit user-scoped filters
   - Returns uniform error envelope `{ error: { code, message, request_id } }`; the SPA's `error-copy.js` maps `code` → user-visible message
4. Some `storage.js` calls still talk to Supabase directly from the browser. This is the migration debt being paid down per [Section 1.5](https://github.com/HyreAgent-ai/docs/wiki/PHASE-A-DESIGN#section-15) of the design contract.

## Consent flow (CB-5 / COMPLIANCE-04)

Two surfaces:

- `privacy.html` (root) — plain-English privacy policy, version `2026-05-18`
- `terms.html` (root) — plain-English beta ToS, version `2026-05-18`

Both are served as static assets at `/privacy` and `/terms`. The SPA's `BetaConsent.jsx` component (Phase B step) renders the [Trust Moment](https://github.com/HyreAgent-ai/docs/wiki/Trust-Moment) wireframe and posts to `POST /v1/me/consent`, which writes to the `consent_ledger` table ([schema](https://github.com/HyreAgent-ai/database) in the database repo).

Until the consent gate is wired (Day 5 of the lift-and-shift plan), the app behaves as it did in the monorepo — sign-in lands directly on the dashboard.

## Deployment

This repo is deployed to Vercel via the `siddardth7` team's Vercel account (temporary; migration to a HyreAgent-AI Vercel team is open). The CI workflow + branch protection require a passing `npm run build` + `npm run lint` + `npm test` before merge to `main`.

## Branching

- `main` → deployed to `https://hyreagent-ai-webapp.vercel.app` (and eventually a custom domain)
- Feature branches: `<short-description>` or `<author>_<issue#>_<short-description>` per the docs repo CONTRIBUTING

PRs target `main`. Branch protection blocks direct push.

## Status of audit findings (as of lift-and-shift)

The Phase A design maps every [audit finding](https://github.com/HyreAgent-ai/security) to a file in this repo. The four highest-impact-on-friend-experience items are being patched in week 1:

- **AI-01** — prompt injection isolation in `src/lib/groq.js`
- **DATA-02** — legacy `jobs` table RLS scrub (database repo migration)
- **CODE-11** — `upsertTemplate` mass-assignment (`src/lib/storage.js:363`)
- **RELI-04** — merge_pipeline dedup (lives in platform repo, but feeds this UI)

Remaining HIGH / MEDIUM / LOW findings are tracked as GitHub issues in [`HyreAgent-ai/security`](https://github.com/HyreAgent-ai/security) and worked incrementally based on friend-usage signal.

## Contributing

See [CONTRIBUTING.md](https://github.com/HyreAgent-ai/.github/blob/main/CONTRIBUTING.md). For solo-developer changes, the [2-tier approval rule](https://github.com/HyreAgent-ai/docs/wiki/Decision-Log) (Decision #5) applies: "ship it" for non-schema/non-auth/non-billing, "ADR-first" otherwise.

## License

[Apache-2.0](./LICENSE)

## Contact

- Maintainer: [@Siddardth7](https://github.com/Siddardth7) — siddardth7@gmail.com
- Issues: file in this repo with the `service/webapp` label
- Architecture: [docs/wiki/PHASE-A-DESIGN](https://github.com/HyreAgent-ai/docs/wiki/PHASE-A-DESIGN)
