
ALTER TABLE public.automation_channels
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS provider_username text,
  ADD COLUMN IF NOT EXISTS scopes text[],
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS automation_channels_user_platform_uniq
  ON public.automation_channels(user_id, platform);

DROP TRIGGER IF EXISTS trg_automation_channels_updated_at ON public.automation_channels;
CREATE TRIGGER trg_automation_channels_updated_at
  BEFORE UPDATE ON public.automation_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.automation_channels FROM anon, authenticated;
GRANT ALL ON public.automation_channels TO service_role;

CREATE OR REPLACE VIEW public.automation_channels_public
WITH (security_invoker = on) AS
SELECT id, user_id, platform, connected, provider_account_id, provider_username,
       scopes, metadata, created_at, updated_at
FROM public.automation_channels
WHERE user_id = auth.uid();

GRANT SELECT ON public.automation_channels_public TO authenticated;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS external_post_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.posts p SET user_id = pr.user_id
  FROM public.projects pr WHERE p.project_id = pr.id AND p.user_id IS NULL;

DROP POLICY IF EXISTS "post_media_owner_read" ON storage.objects;
CREATE POLICY "post_media_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post_media_owner_write" ON storage.objects;
CREATE POLICY "post_media_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post_media_owner_delete" ON storage.objects;
CREATE POLICY "post_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
