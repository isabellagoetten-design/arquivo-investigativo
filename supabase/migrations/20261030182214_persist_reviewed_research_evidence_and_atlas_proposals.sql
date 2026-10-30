-- Persist reviewed research proposals as Atlas topics, timeline events and source-backed relationships.
alter table public.topics
  add column if not exists entity_type text not null default 'concept',
  add column if not exists confidence text not null default 'medium';
alter table public.topics add constraint topics_entity_type_check
  check (entity_type in ('person','organization','place','event','concept')) not valid;
alter table public.topics validate constraint topics_entity_type_check;
alter table public.topics add constraint topics_confidence_check
  check (confidence in ('high','medium','low')) not valid;
alter table public.topics validate constraint topics_confidence_check;

alter table public.timeline_events
  alter column event_date drop not null,
  add column if not exists investigation_id uuid references public.investigations(id) on delete cascade,
  add column if not exists date_label text,
  add column if not exists date_precision text not null default 'day',
  add column if not exists confidence text not null default 'medium';
alter table public.timeline_events add constraint timeline_events_date_precision_check
  check (date_precision in ('day','month','year','unknown')) not valid;
alter table public.timeline_events validate constraint timeline_events_date_precision_check;
alter table public.timeline_events add constraint timeline_events_confidence_check
  check (confidence in ('high','medium','low')) not valid;
alter table public.timeline_events validate constraint timeline_events_confidence_check;
create index if not exists timeline_events_investigation_date_idx
  on public.timeline_events (investigation_id, event_date);

create table if not exists public.research_evidence_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  reference_number integer not null check (reference_number > 0),
  topic_id uuid references public.topics(id) on delete cascade,
  timeline_event_id uuid references public.timeline_events(id) on delete cascade,
  connection_id uuid references public.connections(id) on delete cascade,
  evidence_excerpt text not null default '',
  confidence text not null default 'medium' check (confidence in ('high','medium','low')),
  created_at timestamptz not null default now(),
  constraint research_evidence_one_target_check
    check (num_nonnulls(topic_id, timeline_event_id, connection_id) = 1)
);
create index if not exists research_evidence_links_investigation_idx
  on public.research_evidence_links (investigation_id, created_at desc);
create index if not exists research_evidence_links_source_idx on public.research_evidence_links (source_id);
create index if not exists research_evidence_links_topic_idx on public.research_evidence_links (topic_id) where topic_id is not null;
create index if not exists research_evidence_links_event_idx on public.research_evidence_links (timeline_event_id) where timeline_event_id is not null;
create index if not exists research_evidence_links_connection_idx on public.research_evidence_links (connection_id) where connection_id is not null;

alter table public.research_evidence_links enable row level security;
create policy "research_evidence_select_own" on public.research_evidence_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "research_evidence_insert_own" on public.research_evidence_links
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid()))
    and exists (select 1 from public.sources s where s.id = source_id and s.user_id = (select auth.uid()) and s.investigation_id = research_evidence_links.investigation_id)
    and (topic_id is null or exists (select 1 from public.topics t where t.id = topic_id and t.user_id = (select auth.uid()) and t.investigation_id = research_evidence_links.investigation_id))
    and (timeline_event_id is null or exists (select 1 from public.timeline_events e where e.id = timeline_event_id and e.user_id = (select auth.uid()) and e.investigation_id = research_evidence_links.investigation_id))
    and (connection_id is null or exists (select 1 from public.connections c where c.id = connection_id and c.user_id = (select auth.uid())))
  );
create policy "research_evidence_update_own" on public.research_evidence_links
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "research_evidence_delete_own" on public.research_evidence_links
  for delete to authenticated using ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.accept_research_proposals(p_investigation_id uuid, p_citations jsonb DEFAULT '[]'::jsonb, p_entities jsonb DEFAULT '[]'::jsonb, p_events jsonb DEFAULT '[]'::jsonb, p_relationships jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_ref integer;
  v_url text;
  v_title text;
  v_source_id uuid;
  v_topic_id uuid;
  v_event_id uuid;
  v_connection_id uuid;
  v_source_map jsonb := '{}'::jsonb;
  v_entity_map jsonb := '{}'::jsonb;
  v_name text;
  v_source_name text;
  v_target_name text;
  v_relation text;
  v_date text;
  v_precision text;
  v_confidence text;
  v_refs jsonb;
  v_ref_value text;
  v_saved_sources integer := 0;
  v_saved_entities integer := 0;
  v_saved_events integer := 0;
  v_saved_relationships integer := 0;
  v_saved_evidence integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_investigation_id is null then
    raise exception 'INVESTIGATION_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_citations, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_entities, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_relationships, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PROPOSAL_PAYLOAD' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_citations, '[]'::jsonb)) > 30
    or jsonb_array_length(coalesce(p_entities, '[]'::jsonb)) > 40
    or jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 60
    or jsonb_array_length(coalesce(p_relationships, '[]'::jsonb)) > 60 then
    raise exception 'PROPOSAL_LIMIT_EXCEEDED' using errcode = '22023';
  end if;

  perform 1 from public.investigations i
  where i.id = p_investigation_id and i.user_id = v_user_id;
  if not found then raise exception 'INVESTIGATION_NOT_FOUND' using errcode = '42501'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_citations, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item->>'ref','') !~ '^[0-9]{1,6}$' then continue; end if;
    v_ref := (v_item->>'ref')::integer;
    v_url := left(coalesce(v_item->>'url',''), 2000);
    v_title := left(coalesce(v_item->>'title','Fonte sem título'), 300);
    if v_ref < 1 or v_url !~* '^https?://' then continue; end if;

    select s.id into v_source_id from public.sources s
    where s.user_id = v_user_id and s.investigation_id = p_investigation_id and s.url = v_url
    order by s.created_at asc limit 1;

    if v_source_id is null then
      insert into public.sources (user_id, investigation_id, title, url, source_type, notes)
      values (v_user_id, p_investigation_id, v_title, v_url, 'site', 'Fonte adicionada durante a aprovação de propostas de pesquisa.')
      returning id into v_source_id;
      v_saved_sources := v_saved_sources + 1;
    end if;
    v_source_map := jsonb_set(v_source_map, array[v_ref::text], to_jsonb(v_source_id::text), true);
    v_source_id := null;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_entities, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' then continue; end if;
    v_name := left(btrim(coalesce(v_item->>'name','')), 180);
    if v_name = '' then continue; end if;
    v_confidence := case when v_item->>'confidence' in ('high','medium','low') then v_item->>'confidence' else 'low' end;

    insert into public.topics (user_id, investigation_id, title, content, entity_type, confidence)
    values (
      v_user_id, p_investigation_id, v_name, left(coalesce(v_item->>'description',''), 4000),
      case when v_item->>'entity_type' in ('person','organization','place','event','concept') then v_item->>'entity_type' else 'concept' end,
      v_confidence
    ) returning id into v_topic_id;

    v_entity_map := jsonb_set(v_entity_map, array[lower(v_name)], to_jsonb(v_topic_id::text), true);
    v_saved_entities := v_saved_entities + 1;

    v_refs := case when jsonb_typeof(v_item->'evidence_refs') = 'array' then v_item->'evidence_refs' else '[]'::jsonb end;
    for v_ref_value in select value #>> '{}' from jsonb_array_elements(v_refs)
    loop
      if coalesce(v_ref_value,'') !~ '^[0-9]{1,6}$' then continue; end if;
      v_ref := v_ref_value::integer;
      v_source_id := nullif(v_source_map->>v_ref::text,'')::uuid;
      if v_source_id is null then continue; end if;
      insert into public.research_evidence_links (user_id, investigation_id, source_id, reference_number, topic_id, evidence_excerpt, confidence)
      values (v_user_id, p_investigation_id, v_source_id, v_ref, v_topic_id, left(coalesce(v_item->>'description',''), 1000), v_confidence);
      v_saved_evidence := v_saved_evidence + 1;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' then continue; end if;
    v_name := left(btrim(coalesce(v_item->>'title','')), 180);
    if v_name = '' then continue; end if;
    v_date := nullif(v_item->>'date','');
    v_precision := case when v_item->>'date_precision' in ('day','month','year','unknown') then v_item->>'date_precision' else 'unknown' end;
    v_confidence := case when v_item->>'confidence' in ('high','medium','low') then v_item->>'confidence' else 'low' end;

    insert into public.timeline_events (user_id, investigation_id, title, event_date, date_label, date_precision, description, category, confidence)
    values (
      v_user_id, p_investigation_id, v_name,
      case when v_date ~ '^\d{4}-\d{2}-\d{2}$' and v_precision = 'day' then v_date::date else null end,
      left(coalesce(v_date,''), 20), v_precision, left(coalesce(v_item->>'description',''), 4000), 'Pesquisa', v_confidence
    ) returning id into v_event_id;
    v_saved_events := v_saved_events + 1;

    v_refs := case when jsonb_typeof(v_item->'evidence_refs') = 'array' then v_item->'evidence_refs' else '[]'::jsonb end;
    for v_ref_value in select value #>> '{}' from jsonb_array_elements(v_refs)
    loop
      if coalesce(v_ref_value,'') !~ '^[0-9]{1,6}$' then continue; end if;
      v_ref := v_ref_value::integer;
      v_source_id := nullif(v_source_map->>v_ref::text,'')::uuid;
      if v_source_id is null then continue; end if;
      insert into public.research_evidence_links (user_id, investigation_id, source_id, reference_number, timeline_event_id, evidence_excerpt, confidence)
      values (v_user_id, p_investigation_id, v_source_id, v_ref, v_event_id, left(coalesce(v_item->>'description',''), 1000), v_confidence);
      v_saved_evidence := v_saved_evidence + 1;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_relationships, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' then continue; end if;
    v_source_name := lower(btrim(coalesce(v_item->>'source_entity','')));
    v_target_name := lower(btrim(coalesce(v_item->>'target_entity','')));
    v_relation := left(btrim(coalesce(v_item->>'relation','')), 180);
    if v_source_name = '' or v_target_name = '' or v_relation = '' then continue; end if;

    v_topic_id := nullif(v_entity_map->>v_source_name,'')::uuid;
    v_event_id := nullif(v_entity_map->>v_target_name,'')::uuid;
    if v_topic_id is null or v_event_id is null or v_topic_id = v_event_id then continue; end if;
    v_confidence := case when v_item->>'confidence' in ('high','medium','low') then v_item->>'confidence' else 'low' end;

    insert into public.connections (user_id, source_topic_id, target_topic_id, label)
    values (v_user_id, v_topic_id, v_event_id, v_relation)
    returning id into v_connection_id;
    v_saved_relationships := v_saved_relationships + 1;

    v_refs := case when jsonb_typeof(v_item->'evidence_refs') = 'array' then v_item->'evidence_refs' else '[]'::jsonb end;
    for v_ref_value in select value #>> '{}' from jsonb_array_elements(v_refs)
    loop
      if coalesce(v_ref_value,'') !~ '^[0-9]{1,6}$' then continue; end if;
      v_ref := v_ref_value::integer;
      v_source_id := nullif(v_source_map->>v_ref::text,'')::uuid;
      if v_source_id is null then continue; end if;
      insert into public.research_evidence_links (user_id, investigation_id, source_id, reference_number, connection_id, evidence_excerpt, confidence)
      values (v_user_id, p_investigation_id, v_source_id, v_ref, v_connection_id, left(coalesce(v_item->>'relation',''), 1000), v_confidence);
      v_saved_evidence := v_saved_evidence + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'persisted', true, 'investigation_id', p_investigation_id,
    'saved_sources', v_saved_sources, 'saved_entities', v_saved_entities,
    'saved_events', v_saved_events, 'saved_relationships', v_saved_relationships,
    'saved_evidence_links', v_saved_evidence
  );
end;
$function$

revoke all on function public.accept_research_proposals(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.accept_research_proposals(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
