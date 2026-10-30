CREATE OR REPLACE FUNCTION public.search_library_document_chunks(
  p_query text,
  p_document_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  document_id uuid,
  page_number integer,
  content text,
  relevance real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  WITH parsed AS (
    SELECT websearch_to_tsquery('portuguese', COALESCE(NULLIF(btrim(p_query), ''), '')) AS query
  )
  SELECT
    c.document_id,
    c.page_number,
    c.content,
    ts_rank_cd(to_tsvector('portuguese', c.content), parsed.query)::real AS relevance
  FROM public.library_document_chunks AS c
  CROSS JOIN parsed
  WHERE c.user_id = (SELECT auth.uid())
    AND numnode(parsed.query) > 0
    AND to_tsvector('portuguese', c.content) @@ parsed.query
    AND (p_document_ids IS NULL OR cardinality(p_document_ids) = 0 OR c.document_id = ANY(p_document_ids))
  ORDER BY relevance DESC, c.document_id, c.chunk_index
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 20);
$function$;

REVOKE ALL ON FUNCTION public.search_library_document_chunks(text, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_library_document_chunks(text, uuid[], integer) TO authenticated;
