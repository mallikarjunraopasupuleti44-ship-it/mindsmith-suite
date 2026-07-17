CREATE OR REPLACE FUNCTION public.match_document_chunks(p_user_id uuid, query_embedding vector, p_category text DEFAULT NULL::text, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, document_id uuid, chunk_text text, file_name text, category text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
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
$function$;