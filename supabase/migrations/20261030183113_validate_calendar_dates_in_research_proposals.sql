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
  v_event_date date;
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

    v_event_date := null;
    if v_precision = 'day' and v_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      begin
        v_event_date := v_date::date;
      exception when others then
        v_date := null;
        v_precision := 'unknown';
      end;
    elsif v_precision = 'month' and v_date ~ '^[0-9]{4}-[0-9]{2}$'
      and substring(v_date from 6 for 2)::integer between 1 and 12 then
      null;
    elsif v_precision = 'year' and v_date ~ '^[0-9]{4}$' then
      null;
    else
      v_date := null;
      v_precision := 'unknown';
    end if;

    insert into public.timeline_events (user_id, investigation_id, title, event_date, date_label, date_precision, description, category, confidence)
    values (
      v_user_id, p_investigation_id, v_name,
      v_event_date,
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
$function$;
