-- RELI-13: server-side resume count guard
-- Prevents race condition where two tabs can simultaneously upload past the
-- 5-resume limit (both read count=4, both proceed, end up with 6 resumes).
-- A trigger enforces the limit atomically at INSERT time.

CREATE OR REPLACE FUNCTION check_resume_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM resumes WHERE user_id = NEW.user_id
  ) >= 5 THEN
    RAISE EXCEPTION 'RESUME_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- Only fires on INSERT (not UPDATE/upsert of existing rows)
DROP TRIGGER IF EXISTS enforce_resume_limit ON resumes;
CREATE TRIGGER enforce_resume_limit
  BEFORE INSERT ON resumes
  FOR EACH ROW EXECUTE FUNCTION check_resume_limit();
