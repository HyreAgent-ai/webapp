# Bug-fix triage rubric

Apply one `severity:*` label per friend-bug issue. Criteria below are binding; "gut feel" is not a valid reason.

## Severity definitions

### `severity:critical`
Ship in **this** Saturday rundown.
- Data loss (user's resume, applications, contacts disappear)
- Auth bypass or cross-tenant read/write
- More than one user blocked from core flow (signup, login, resume upload, JD analysis)
- PII leak in logs or telemetry

*Example:* "I uploaded my resume and now another user's resume shows up on my dashboard."

### `severity:high`
Ship within **2 rundowns**.
- One feature completely broken for ≥ 1 user, no workaround
- No data risk
- Includes regressions that re-break a previously fixed flow

*Example:* "JD analysis returns 500 every time on jobs from Lever."

### `severity:medium`
Backlog, but **visible in rundown**.
- Annoyance, workaround exists
- UX friction that doesn't block completion
- Cosmetic but on the happy path

*Example:* "Dark mode toggle resets after refresh."

### `severity:low`
Backlog; drops off the top of rundown after one cycle.
- Polish, nice-to-have
- Cosmetic and off-path
- Spelling, alignment, hover states

*Example:* "Footer copyright year says 2025."

## Routing table

| Finding category | Default severity |
|---|---|
| Auth / RLS / data isolation | critical |
| Telemetry PII | critical |
| Broken core flow (signup, resume, JD, application) | high |
| Broken secondary flow (settings, networking, intel) | medium |
| Cosmetic, copy, spacing | low |

## Re-triage rule

If an issue sits **3 rundowns** without resolution, owner re-evaluates: downgrade severity (and document why) or escalate to the next rundown's batch. No silent decay.

## GitHub labels

These four labels must exist in `HyreAgent-ai/webapp` with distinct colors:
- `severity:critical` — red (`#b60205`)
- `severity:high` — orange (`#d93f0b`)
- `severity:medium` — yellow (`#fbca04`)
- `severity:low` — green (`#0e8a16`)
