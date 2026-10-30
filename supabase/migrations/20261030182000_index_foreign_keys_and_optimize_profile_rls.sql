-- Add indexes for frequently joined foreign-key columns and avoid
-- per-row auth.uid() evaluation in people_profiles policies.

CREATE INDEX IF NOT EXISTS connections_target_topic_id_idx ON public.connections (target_topic_id);
CREATE INDEX IF NOT EXISTS dossiers_user_id_idx ON public.dossiers (user_id);
CREATE INDEX IF NOT EXISTS investigations_user_id_idx ON public.investigations (user_id);
CREATE INDEX IF NOT EXISTS library_documents_investigation_id_idx ON public.library_documents (investigation_id);
CREATE INDEX IF NOT EXISTS notes_dossier_id_idx ON public.notes (dossier_id);
CREATE INDEX IF NOT EXISTS notes_topic_id_idx ON public.notes (topic_id);
CREATE INDEX IF NOT EXISTS people_profiles_knowledge_id_idx ON public.people_profiles (knowledge_id);
CREATE INDEX IF NOT EXISTS sources_dossier_id_idx ON public.sources (dossier_id);
CREATE INDEX IF NOT EXISTS sources_topic_id_idx ON public.sources (topic_id);
CREATE INDEX IF NOT EXISTS topic_links_from_topic_id_idx ON public.topic_links (from_topic_id);
CREATE INDEX IF NOT EXISTS topic_links_to_topic_id_idx ON public.topic_links (to_topic_id);

ALTER POLICY "Users create own people profiles" ON public.people_profiles
WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users delete own people profiles" ON public.people_profiles
USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users read own people profiles" ON public.people_profiles
USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users update own people profiles" ON public.people_profiles
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
