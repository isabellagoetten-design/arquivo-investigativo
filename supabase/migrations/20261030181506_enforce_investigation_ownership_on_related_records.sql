-- Enforce that records linked to an investigation can only reference
-- investigations owned by the authenticated user. Existing ownership checks
-- for user_id, dossier_id and topic_id are preserved.

ALTER POLICY topics_insert_own ON public.topics
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = topics.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = topics.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY topics_update_own ON public.topics
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = topics.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = topics.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY notes_insert_own ON public.notes
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = notes.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (topic_id IS NULL OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = notes.topic_id AND t.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = notes.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY notes_update_own ON public.notes
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = notes.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (topic_id IS NULL OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = notes.topic_id AND t.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = notes.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY sources_insert_own ON public.sources
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = sources.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (topic_id IS NULL OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = sources.topic_id AND t.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = sources.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY sources_update_own ON public.sources
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (dossier_id IS NULL OR EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = sources.dossier_id AND d.user_id = (SELECT auth.uid())
  ))
  AND (topic_id IS NULL OR EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = sources.topic_id AND t.user_id = (SELECT auth.uid())
  ))
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = sources.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY "Users can add own library documents" ON public.library_documents
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = library_documents.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);

ALTER POLICY "Users can update own library documents" ON public.library_documents
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (investigation_id IS NULL OR EXISTS (
    SELECT 1 FROM public.investigations i
    WHERE i.id = library_documents.investigation_id AND i.user_id = (SELECT auth.uid())
  ))
);
