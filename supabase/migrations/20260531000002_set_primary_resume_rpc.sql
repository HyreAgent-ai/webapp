-- RELI-12: atomic set_primary_resume RPC
-- Prevents races where two concurrent calls both demote all resumes then each
-- promotes a different one, leaving either zero or two primary resumes.
-- Uses advisory lock scoped per-user so concurrent calls serialize safely.

CREATE OR REPLACE FUNCTION set_primary_resume(p_resume_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Advisory lock per-user so concurrent calls for the same user serialize.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Verify the target resume belongs to this user.
  IF NOT EXISTS (
    SELECT 1 FROM resumes WHERE id = p_resume_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Resume not found';
  END IF;

  -- Atomically demote all then promote the target in a single transaction.
  UPDATE resumes SET is_primary = (id = p_resume_id)
  WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_primary_resume(uuid) TO authenticated;
