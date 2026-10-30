drop policy if exists "research_evidence_insert_own" on public.research_evidence_links;
create policy "research_evidence_insert_own"
on public.research_evidence_links for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.investigations i
    where i.id = investigation_id and i.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.sources s
    where s.id = source_id and s.user_id = (select auth.uid())
      and s.investigation_id = research_evidence_links.investigation_id
  )
  and (
    topic_id is null or exists (
      select 1 from public.topics t
      where t.id = topic_id and t.user_id = (select auth.uid())
        and t.investigation_id = research_evidence_links.investigation_id
    )
  )
  and (
    timeline_event_id is null or exists (
      select 1 from public.timeline_events e
      where e.id = timeline_event_id and e.user_id = (select auth.uid())
        and e.investigation_id = research_evidence_links.investigation_id
    )
  )
  and (
    connection_id is null or exists (
      select 1
      from public.connections c
      join public.topics source_topic on source_topic.id = c.source_topic_id
      join public.topics target_topic on target_topic.id = c.target_topic_id
      where c.id = connection_id
        and c.user_id = (select auth.uid())
        and source_topic.user_id = (select auth.uid())
        and target_topic.user_id = (select auth.uid())
        and source_topic.investigation_id = research_evidence_links.investigation_id
        and target_topic.investigation_id = research_evidence_links.investigation_id
    )
  )
);
