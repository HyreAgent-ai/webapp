-- SP-007 Gate 1: cascade-delete all user data (SECURITY DEFINER bypasses RLS)
-- Called by DELETE /api/v1/me BEFORE auth.admin.deleteUser

CREATE OR REPLACE FUNCTION delete_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Copy consent record to audit table before deletion
  INSERT INTO consent_audit (user_hash, event)
  SELECT encode(digest(p_user_id::text, 'sha256'), 'hex'), 'account_deleted'
  WHERE EXISTS (
    SELECT 1 FROM consent_ledger WHERE user_id = p_user_id
  );

  -- Delete all user data (order matters — FK dependencies)
  DELETE FROM job_applications  WHERE user_id = p_user_id;
  DELETE FROM jobs              WHERE user_id = p_user_id;
  DELETE FROM contacts          WHERE user_id = p_user_id;
  DELETE FROM user_integrations WHERE user_id = p_user_id;
  DELETE FROM user_preferences  WHERE user_id = p_user_id;
  DELETE FROM api_keys          WHERE user_id = p_user_id;
  DELETE FROM consent_ledger    WHERE user_id = p_user_id;

  -- Note: auth.admin.deleteUser called separately by API layer
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_data(uuid) TO anon, authenticated;
