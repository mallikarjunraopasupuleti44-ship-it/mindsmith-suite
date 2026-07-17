
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Updated-at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================
-- projects
-- =========================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_idx ON public.projects(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- agent_tasks
-- =========================
CREATE TABLE public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'working',
  deliverable JSONB,
  deliverable_title TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, agent_id)
);
CREATE INDEX agent_tasks_project_idx ON public.agent_tasks(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent_tasks" ON public.agent_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE TRIGGER agent_tasks_updated BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- activity_events
-- =========================
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_project_idx ON public.activity_events(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity_events" ON public.activity_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

-- =========================
-- knowledge_documents
-- =========================
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'processing',
  status_error TEXT,
  extracted_text TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_documents_user_idx ON public.knowledge_documents(user_id, uploaded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.knowledge_documents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER knowledge_documents_updated BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- document_chunks
-- =========================
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX document_chunks_document_idx ON public.document_chunks(document_id, chunk_index);
CREATE INDEX document_chunks_embedding_idx
  ON public.document_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks" ON public.document_chunks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = document_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = document_id AND d.user_id = auth.uid()));

-- =========================
-- deliverable_sources
-- =========================
CREATE TABLE public.deliverable_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_task_id, document_id)
);
CREATE INDEX deliverable_sources_task_idx ON public.deliverable_sources(agent_task_id);
CREATE INDEX deliverable_sources_doc_idx ON public.deliverable_sources(document_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_sources TO authenticated;
GRANT ALL ON public.deliverable_sources TO service_role;
ALTER TABLE public.deliverable_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deliverable_sources" ON public.deliverable_sources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.agent_tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = agent_task_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = agent_task_id AND p.user_id = auth.uid()
  ));

-- =========================
-- RAG search function
-- =========================
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_user_id UUID,
  query_embedding vector(3072),
  p_category TEXT DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  file_name TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_text,
    d.file_name,
    d.category,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.document_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE d.user_id = p_user_id
    AND d.status = 'indexed'
    AND c.embedding IS NOT NULL
    AND (p_category IS NULL OR d.category = p_category)
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks(UUID, vector, TEXT, INT) TO authenticated, service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_documents;
