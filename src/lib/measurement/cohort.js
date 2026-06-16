// SP-016 — Gate 5 day-14 H1 cohort query (PostHog HogQL)
// Run via PostHog Insights → HogQL tab, or via PostHog API.
// Pass: completers_count >= 3 AND returners_count >= 2

export const DAY14_HOGQL = `
WITH cohort AS (
  SELECT
    person.id AS user_id,
    min(timestamp) AS signup_at
  FROM events
  WHERE event = 'auth_signup_completed'
  GROUP BY person.id
),
completers AS (
  SELECT DISTINCT c.user_id
  FROM cohort c
  JOIN events ru ON ru.person.id = c.user_id
    AND ru.event = 'resume_uploaded'
    AND ru.timestamp BETWEEN c.signup_at AND c.signup_at + INTERVAL 7 DAY
  JOIN events jd ON jd.person.id = c.user_id
    AND jd.event = 'jd_analysis_run'
    AND jd.timestamp BETWEEN ru.timestamp AND c.signup_at + INTERVAL 7 DAY
  JOIN events ac ON ac.person.id = c.user_id
    AND ac.event = 'application_created'
    AND ac.timestamp BETWEEN jd.timestamp AND c.signup_at + INTERVAL 7 DAY
),
first_session AS (
  SELECT person.id AS user_id, min(timestamp) AS first_at
  FROM events
  WHERE event = '$pageview' AND person.id IN (SELECT user_id FROM completers)
  GROUP BY person.id
),
returners AS (
  SELECT DISTINCT fs.user_id
  FROM first_session fs
  JOIN events s ON s.person.id = fs.user_id
    AND s.event = '$pageview'
    AND s.timestamp >= fs.first_at + INTERVAL 3 DAY
    AND s.timestamp <= fs.first_at + INTERVAL 14 DAY
)
SELECT
  (SELECT count() FROM completers) AS completers_count,
  (SELECT count() FROM returners)  AS returners_count
`;

// Pass criteria
export const PASS = { completers: 3, returners: 2 };

export function evaluateH1(completers_count, returners_count) {
  if (completers_count >= PASS.completers && returners_count >= PASS.returners) return 'CASE_A';
  if (completers_count >= PASS.completers && returners_count < PASS.returners) return 'CASE_B';
  if (completers_count < PASS.completers) return 'CASE_C';
  return 'CASE_D';
}
