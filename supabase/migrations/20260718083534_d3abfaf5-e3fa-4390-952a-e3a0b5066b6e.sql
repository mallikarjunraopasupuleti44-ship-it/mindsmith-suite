
-- 1) automation_channels: restrict authenticated role to non-token columns only.
-- Token columns (access_token, refresh_token, scopes, metadata, token_expires_at,
-- provider_account_id, provider_username) are only ever written/read by
-- supabaseAdmin (service role) inside server code. Removing table-level grants
-- and re-granting per column ensures a bug in an RLS policy still cannot leak
-- raw OAuth tokens via the Data API.

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.automation_channels FROM authenticated;

GRANT SELECT
  (id, user_id, platform, connected, external_account_id,
   provider_account_id, provider_username, token_expires_at,
   created_at, updated_at)
  ON public.automation_channels TO authenticated;

GRANT INSERT
  (id, user_id, platform, connected, external_account_id)
  ON public.automation_channels TO authenticated;

GRANT UPDATE
  (connected, external_account_id)
  ON public.automation_channels TO authenticated;

GRANT DELETE ON public.automation_channels TO authenticated;
-- service_role keeps ALL (unchanged) for token read/write from server code.


-- 2) posts.user_id: backfill from owning project, enforce NOT NULL, and
-- auto-populate on insert so RLS via project ownership can never be bypassed
-- by a row missing user_id.

UPDATE public.posts p
   SET user_id = pr.user_id
  FROM public.projects pr
 WHERE p.project_id = pr.id
   AND p.user_id IS DISTINCT FROM pr.user_id;

ALTER TABLE public.posts
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.posts_set_user_id_from_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO owner FROM public.projects WHERE id = NEW.project_id;
    IF owner IS NULL THEN
      RAISE EXCEPTION 'posts.project_id % has no owning project', NEW.project_id;
    END IF;
    NEW.user_id := owner;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_set_user_id_from_project ON public.posts;
CREATE TRIGGER posts_set_user_id_from_project
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.posts_set_user_id_from_project();
