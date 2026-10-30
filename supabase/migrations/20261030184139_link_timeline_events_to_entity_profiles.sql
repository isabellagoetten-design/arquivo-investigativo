-- Link timeline events to canonical entity profiles without restricting an event to one entity.
alter table public.timeline_events
  add constraint timeline_events_id_user_unique unique (id,user_id);

create table if not exists public.timeline_event_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  timeline_event_id uuid not null,
  entity_profile_id uuid not null,
  relationship text not null default 'envolvido'
    check (char_length(trim(relationship)) between 1 and 120),
  created_at timestamptz not null default now(),
  constraint timeline_event_entities_event_owner_fk
    foreign key (timeline_event_id,user_id)
    references public.timeline_events(id,user_id) on delete cascade,
  constraint timeline_event_entities_profile_owner_fk
    foreign key (entity_profile_id,user_id)
    references public.entity_profiles(id,user_id) on delete cascade,
  constraint timeline_event_entities_event_profile_unique
    unique (timeline_event_id,entity_profile_id)
);

create index timeline_event_entities_profile_user_idx
  on public.timeline_event_entities(entity_profile_id,user_id);
create index timeline_event_entities_event_user_idx
  on public.timeline_event_entities(timeline_event_id,user_id);

alter table public.timeline_event_entities enable row level security;
create policy timeline_event_entities_select_own
  on public.timeline_event_entities for select to authenticated
  using ((select auth.uid()) = user_id);
create policy timeline_event_entities_insert_own
  on public.timeline_event_entities for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy timeline_event_entities_update_own
  on public.timeline_event_entities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy timeline_event_entities_delete_own
  on public.timeline_event_entities for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.timeline_event_entities from anon;
grant select,insert,update,delete on table public.timeline_event_entities to authenticated;

alter table public.research_evidence_links
  add column entity_profile_id uuid;

alter table public.research_evidence_links
  add constraint research_evidence_links_entity_profile_owner_fk
  foreign key (entity_profile_id,user_id)
  references public.entity_profiles(id,user_id) on delete cascade;

alter table public.research_evidence_links
  drop constraint research_evidence_one_target_check;
alter table public.research_evidence_links
  add constraint research_evidence_one_target_check
  check (num_nonnulls(topic_id,timeline_event_id,connection_id,entity_profile_id) = 1);

create index research_evidence_links_entity_profile_idx
  on public.research_evidence_links(entity_profile_id,user_id)
  where entity_profile_id is not null;

drop policy if exists research_evidence_insert_own on public.research_evidence_links;
create policy research_evidence_insert_own
  on public.research_evidence_links for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investigations i
      where i.id = research_evidence_links.investigation_id
        and i.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.sources s
      where s.id = research_evidence_links.source_id
        and s.user_id = (select auth.uid())
        and s.investigation_id = research_evidence_links.investigation_id
    )
    and (
      topic_id is null or exists (
        select 1 from public.topics t
        where t.id = research_evidence_links.topic_id
          and t.user_id = (select auth.uid())
          and t.investigation_id = research_evidence_links.investigation_id
      )
    )
    and (
      timeline_event_id is null or exists (
        select 1 from public.timeline_events e
        where e.id = research_evidence_links.timeline_event_id
          and e.user_id = (select auth.uid())
          and e.investigation_id = research_evidence_links.investigation_id
      )
    )
    and (
      connection_id is null or exists (
        select 1
        from public.connections c
        join public.topics st on st.id = c.source_topic_id
        join public.topics tt on tt.id = c.target_topic_id
        where c.id = research_evidence_links.connection_id
          and c.user_id = (select auth.uid())
          and st.user_id = (select auth.uid())
          and tt.user_id = (select auth.uid())
          and st.investigation_id = research_evidence_links.investigation_id
          and tt.investigation_id = research_evidence_links.investigation_id
      )
    )
    and (
      entity_profile_id is null or exists (
        select 1 from public.entity_profiles ep
        where ep.id = research_evidence_links.entity_profile_id
          and ep.user_id = (select auth.uid())
      )
    )
  );

revoke all on table public.timeline_events from anon;
grant select,insert,update,delete on table public.timeline_events to authenticated;
