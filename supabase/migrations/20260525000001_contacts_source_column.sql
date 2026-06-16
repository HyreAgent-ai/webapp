-- COMPLIANCE-04 Path D: add source column to contacts table so linkedin_legacy
-- rows can be filtered from the default fetchContacts query.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Back-fill any rows where source is still NULL (pre-migration rows).
UPDATE public.contacts SET source = 'linkedin_legacy' WHERE source IS NULL;
