-- DATA-02 — Drop the legacy `public.jobs` table after migrating its 35 rows
-- into the multi-user schema (`normalized_jobs` + `user_job_feed`).
--
-- Severity: HIGH (cross-user data leak)
-- Finding:  docs/audit-evidence/findings/DATA-02-jobs-table-leaks-across-users.md
--
-- BEFORE:  `public.jobs` has 35 rows of Siddardth's pre-migration pipeline
--          analytics. Its only RLS policy is `authenticated_read_jobs` with
--          `qual = true` — every authenticated user can SELECT every row,
--          including the AI-generated verdict, match score, and personal notes.
--
-- AFTER:   `public.jobs` is dropped. The 35 rows live in `user_job_feed`
--          scoped to Siddardth's user_id (`de1bafab-7e76-4b80-a7ed-8de86c6d9bad`),
--          with their parent `normalized_jobs` rows inserted as needed.
--
-- This is Path A from the finding ("migrate then drop"). Path B (add user_id
-- + scope RLS) is preserved at the bottom as a fallback if Path A's row count
-- check fails.
--
-- ⚠️  PRODUCTION RUN REQUIRES OWNER SIGN-OFF.
-- Per HANDOFF.md irreversible-action checkpoint #4: "Before any production
-- SQL run — confirm SQL + DB target." Run this migration ONLY against the
-- production project (`wefcbqfxzvvgremxhubi`) with the service-role key after
-- the dry-run SELECT counts at the bottom match expectations.

BEGIN;

-- 1. Insert any missing job rows into normalized_jobs.
--    Match on lowercased canonical job_url (strip query string + trailing slash).
INSERT INTO public.normalized_jobs (id, company_name, job_title, location, job_url, source, posted_date, description)
SELECT
    gen_random_uuid()::text,
    j.company,
    j.role,
    COALESCE(j.location, ''),
    j.link,
    COALESCE(j.source, 'legacy'),
    j.created_at::date::text,
    j.jd
FROM public.jobs j
WHERE NOT EXISTS (
    SELECT 1
    FROM public.normalized_jobs n
    WHERE lower(regexp_replace(n.job_url, '\?.*$', '')) =
          lower(regexp_replace(j.link,    '\?.*$', ''))
)
AND j.link IS NOT NULL
AND j.link <> '';

-- 2. Insert user_job_feed entries for Siddardth's 35 rows.
--    ON CONFLICT keeps the migration idempotent — re-running won't double-add.
INSERT INTO public.user_job_feed (
    user_id,
    job_id,
    in_pipeline,
    user_relevance_score,
    analysis_result,
    resume_variant,
    status,
    pipeline_added_at,
    created_at
)
SELECT
    'de1bafab-7e76-4b80-a7ed-8de86c6d9bad'::uuid AS user_id,
    n.id                                           AS job_id,
    COALESCE(j.in_pipeline, false)                 AS in_pipeline,
    j.match                                        AS user_relevance_score,
    j.analysis_result                              AS analysis_result,
    j.resume_variant                               AS resume_variant,
    CASE
        WHEN j.status = 'applied'     THEN 'applied'
        WHEN j.in_pipeline = true     THEN 'viewed'
        ELSE 'new'
    END                                            AS status,
    CASE WHEN j.in_pipeline = true THEN j.created_at ELSE NULL END
                                                   AS pipeline_added_at,
    j.created_at                                   AS created_at
FROM public.jobs j
JOIN public.normalized_jobs n
  ON lower(regexp_replace(n.job_url, '\?.*$', '')) =
     lower(regexp_replace(j.link,    '\?.*$', ''))
ON CONFLICT (user_id, job_id) DO NOTHING;

-- 3. Sanity check — before dropping, assert the row count matches.
--    If the count does not equal 35, abort the transaction.
DO $$
DECLARE
    legacy_count int;
    migrated_count int;
BEGIN
    SELECT COUNT(*) INTO legacy_count   FROM public.jobs;
    SELECT COUNT(*) INTO migrated_count
    FROM public.user_job_feed
    WHERE user_id = 'de1bafab-7e76-4b80-a7ed-8de86c6d9bad'::uuid
      AND created_at < '2026-04-01';

    IF migrated_count < legacy_count THEN
        RAISE EXCEPTION
            'DATA-02 migration aborted: legacy_count=% > migrated_count=%. Investigate URL-join misses before dropping public.jobs.',
            legacy_count, migrated_count;
    END IF;
END$$;

-- 4. Drop the leaky table.
DROP TABLE public.jobs;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFICATION — run AFTER commit
-- ──────────────────────────────────────────────────────────────────────────
--
-- (a) Confirm the table is gone:
--   SELECT to_regclass('public.jobs');
--   Expected: NULL.
--
-- (b) Confirm the 35 rows are in user_job_feed:
--   SELECT COUNT(*) FROM public.user_job_feed
--   WHERE user_id = 'de1bafab-7e76-4b80-a7ed-8de86c6d9bad'::uuid
--     AND created_at < '2026-04-01';
--   Expected: 35 (give or take ON CONFLICT skips on re-run).
--
-- (c) Confirm cross-user exposure is gone — sign in as secondary user, then:
--   curl 'https://wefcbqfxzvvgremxhubi.supabase.co/rest/v1/jobs?select=id' \
--     -H 'apikey: <anon>' -H 'Authorization: Bearer <secondary_user_jwt>'
--   Expected: 404 (table not found) — proves cross-user read path is closed.
--
-- ──────────────────────────────────────────────────────────────────────────
-- ROLLBACK / Path B fallback
-- ──────────────────────────────────────────────────────────────────────────
--
-- If migration aborts at step 3 because the URL-join missed rows (e.g. legacy
-- rows with NULL url, or URLs that don't canonicalise to a normalized_jobs
-- row), fall back to Path B — add user_id + scope RLS without dropping:
--
--   ALTER TABLE public.jobs ADD COLUMN user_id uuid REFERENCES auth.users(id);
--   UPDATE public.jobs SET user_id = 'de1bafab-7e76-4b80-a7ed-8de86c6d9bad'::uuid
--   WHERE user_id IS NULL;
--   ALTER TABLE public.jobs ALTER COLUMN user_id SET NOT NULL;
--   DROP POLICY IF EXISTS authenticated_read_jobs ON public.jobs;
--   CREATE POLICY user_owns_jobs ON public.jobs FOR ALL TO authenticated
--     USING (user_id = (select auth.uid()))
--     WITH CHECK (user_id = (select auth.uid()));
--
-- Path B closes the leak today; Path A is the right end-state for next-cycle.
