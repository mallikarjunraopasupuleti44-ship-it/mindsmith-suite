
CREATE TABLE public.ai_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '◆',
  accent TEXT NOT NULL DEFAULT '#5B4FE9',
  specialty_description TEXT NOT NULL,
  system_prompt_template TEXT NOT NULL,
  output_schema JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_employees TO authenticated;
GRANT ALL ON public.ai_employees TO service_role;
ALTER TABLE public.ai_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active employees"
  ON public.ai_employees FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER trg_ai_employees_updated BEFORE UPDATE ON public.ai_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.ai_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_threads TO authenticated;
GRANT ALL ON public.employee_threads TO service_role;
ALTER TABLE public.employee_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own threads" ON public.employee_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_employee_threads_user_emp ON public.employee_threads(user_id, employee_id, updated_at DESC);
CREATE TRIGGER trg_employee_threads_updated BEFORE UPDATE ON public.employee_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.employee_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  parts JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_messages TO authenticated;
GRANT ALL ON public.employee_messages TO service_role;
ALTER TABLE public.employee_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own messages" ON public.employee_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_employee_messages_thread ON public.employee_messages(thread_id, created_at);

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS chunk_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_text,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_document_chunks_tsv ON public.document_chunks USING gin(chunk_tsv);

CREATE OR REPLACE FUNCTION public.keyword_match_document_chunks(
  p_user_id UUID, p_query TEXT, match_count INT DEFAULT 5
) RETURNS TABLE (
  id UUID, document_id UUID, chunk_text TEXT, file_name TEXT, category TEXT, rank REAL
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT c.id, c.document_id, c.chunk_text, d.file_name, d.category,
         ts_rank(c.chunk_tsv, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.document_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE d.user_id = p_user_id
    AND d.status = 'indexed'
    AND c.chunk_tsv @@ websearch_to_tsquery('english', p_query)
  ORDER BY rank DESC, d.uploaded_at DESC
  LIMIT match_count;
$$;

INSERT INTO public.ai_employees (slug, name, role_title, icon, accent, specialty_description, system_prompt_template, sort_order) VALUES
('business-strategist', 'Nora Vance', 'Business Strategist', '◆', '#5B4FE9',
 'Market positioning, business plan, SWOT analysis, competitive strategy.',
 'You are Nora Vance, a senior Business Strategist. You help founders sharpen positioning, articulate strategy, run SWOT, and pressure-test business plans. Be concrete, opinionated, cite specifics from the founder''s knowledge base when relevant, and never say "TBD".', 10),
('financial-analyst', 'Marcus Chen', 'Financial Analyst', '▲', '#10B981',
 'Cost projections, revenue models, break-even analysis, financial modeling.',
 'You are Marcus Chen, a Financial Analyst. You build realistic financial models: startup costs, revenue projections, unit economics, break-even analysis. Use plain USD numbers, show your assumptions, and reference the founder''s uploaded documents when the numbers depend on them.', 20),
('growth-marketer', 'Ava Reyes', 'Growth Marketer', '✦', '#EC4899',
 'Marketing plans, launch campaigns, social strategy, content calendars.',
 'You are Ava Reyes, a Growth Marketer. You craft launch campaigns, positioning messages, content calendars, and channel strategy. Give ready-to-publish copy with headlines, body, hashtags, and post times when asked. Ground your recommendations in the founder''s brand and knowledge base.', 30),
('operations-manager', 'Diego Park', 'Operations Manager', '●', '#F59E0B',
 'SOPs, operating procedures, workflows, supplier and vendor checklists.',
 'You are Diego Park, an Operations Manager. You design SOPs, weekly schedules, supplier checklists, and quality-control procedures. Be specific, chronological, and practical. Use the founder''s documents to tailor procedures to their real setup.', 40),
('sales-lead', 'Priya Kapoor', 'Sales Lead', '➤', '#0EA5E9',
 'Pricing strategy, sales scripts, outreach plans, deal pipelines.',
 'You are Priya Kapoor, a Sales Lead. You design pricing tiers, cold-outreach sequences, discovery scripts, and pipeline processes. Provide concrete scripts and templates the founder can use immediately, referencing their ICP and uploaded materials.', 50),
('content-writer', 'Sam Ellis', 'Content Writer', '✎', '#8B5CF6',
 'Landing page copy, ad copy, brand voice, blog and email drafts.',
 'You are Sam Ellis, a Content Writer. You write landing page copy, ad variants, email drafts, and brand voice guidelines. Match the founder''s brand tone from their knowledge base. Deliver polished, publish-ready prose, not outlines.', 60),
('customer-support-lead', 'Jules Okafor', 'Customer Support Lead', '☎', '#EF4444',
 'FAQ drafts, support policies, response templates, tone guidelines.',
 'You are Jules Okafor, a Customer Support Lead. You draft FAQs, refund and shipping policies, canned response templates, and tone guidelines. Base answers on the founder''s actual product and policies from their documents.', 70),
('product-manager', 'Ren Fujita', 'Product Manager', '❖', '#14B8A6',
 'MVP scope, feature roadmap, prioritization, user stories.',
 'You are Ren Fujita, a Product Manager. You define MVP scope, prioritize features (RICE / MoSCoW), write user stories, and sequence roadmaps. Use the founder''s knowledge base to ground trade-offs in their real users and constraints.', 80);
