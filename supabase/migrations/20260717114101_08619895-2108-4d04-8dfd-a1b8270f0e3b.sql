
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS posts_scheduled_idx ON public.posts (status, scheduled_at) WHERE status = 'scheduled';
DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
