
-- Switch to SECURITY INVOKER; RLS on projects would block a plain user's SELECT,
-- so keep SECURITY DEFINER but revoke direct EXECUTE from anon/authenticated.
-- The trigger runs as table owner regardless of EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.posts_set_user_id_from_project() FROM PUBLIC, anon, authenticated;
