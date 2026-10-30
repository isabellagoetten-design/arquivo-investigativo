create unique index if not exists research_evidence_links_id_user_investigation_uidx
  on public.research_evidence_links (id, user_id, investigation_id);

create table if not exists public.evidence_audit_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  overall_summary text not null default '',
  evidence_count integer not null check (evidence_count >= 0),
  source_count integer not null check (source_count >= 0),
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint evidence_audit_runs_id_owner_investigation_key unique (id, user_id, investigation_id)
);

create table if not exists public.evidence_audit_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  issue_type text not null check (issue_type in ('direct_contradiction','factual_discrepancy','chronology_inconsistency','unsupported_claim','corroboration','source_dependence')),
  severity text not null check (severity in ('high','medium','low')),
  title text not null check (char_length(title) between 1 and 220),
  explanation text not null default '',
  next_step text not null default '',
  status text not null default 'needs_review' check (status in ('needs_review','confirmed_by_researcher','dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_audit_findings_id_owner_investigation_key unique (id, user_id, investigation_id),
  constraint evidence_audit_findings_run_owner_fk
    foreign key (run_id, user_id, investigation_id)
    references public.evidence_audit_runs(id, user_id, investigation_id) on delete cascade
);

create table if not exists public.evidence_audit_finding_evidence (
  finding_id uuid not null,
  evidence_link_id uuid not null,
  user_id uuid not null,
  investigation_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (finding_id, evidence_link_id),
  constraint evidence_audit_finding_evidence_finding_fk
    foreign key (finding_id, user_id, investigation_id)
    references public.evidence_audit_findings(id, user_id, investigation_id) on delete cascade,
  constraint evidence_audit_finding_evidence_link_fk
    foreign key (evidence_link_id, user_id, investigation_id)
    references public.research_evidence_links(id, user_id, investigation_id) on delete cascade
);

create index if not exists evidence_audit_runs_user_investigation_created_idx
  on public.evidence_audit_runs(user_id, investigation_id, created_at desc);
create index if not exists evidence_audit_findings_user_investigation_created_idx
  on public.evidence_audit_findings(user_id, investigation_id, created_at desc);
create index if not exists evidence_audit_findings_run_id_idx
  on public.evidence_audit_findings(run_id);
create index if not exists evidence_audit_finding_evidence_user_investigation_idx
  on public.evidence_audit_finding_evidence(user_id, investigation_id);

alter table public.evidence_audit_runs enable row level security;
alter table public.evidence_audit_findings enable row level security;
alter table public.evidence_audit_finding_evidence enable row level security;

create policy "Users can read their evidence audit runs"
  on public.evidence_audit_runs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their evidence audit runs"
  on public.evidence_audit_runs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their evidence audit runs"
  on public.evidence_audit_runs for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their evidence audit findings"
  on public.evidence_audit_findings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their evidence audit findings"
  on public.evidence_audit_findings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their evidence audit findings"
  on public.evidence_audit_findings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their evidence audit findings"
  on public.evidence_audit_findings for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their evidence audit finding evidence"
  on public.evidence_audit_finding_evidence for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their evidence audit finding evidence"
  on public.evidence_audit_finding_evidence for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their evidence audit finding evidence"
  on public.evidence_audit_finding_evidence for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.evidence_audit_runs from anon;
revoke all on public.evidence_audit_findings from anon;
revoke all on public.evidence_audit_finding_evidence from anon;
grant select, insert, delete on public.evidence_audit_runs to authenticated;
grant select, insert, update, delete on public.evidence_audit_findings to authenticated;
grant select, insert, delete on public.evidence_audit_finding_evidence to authenticated;

create or replace function public.save_evidence_audit_findings(
  p_investigation_id uuid,
  p_overall_summary text,
  p_evidence_count integer,
  p_source_count integer,
  p_audited_at timestamptz,
  p_findings jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_finding_id uuid;
  v_item jsonb;
  v_evidence_ids uuid[];
  v_saved integer := 0;
  v_issue_type text;
  v_severity text;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.';
  end if;
  if not exists (
    select 1 from public.investigations i
    where i.id = p_investigation_id and i.user_id = v_user_id
  ) then
    raise exception 'Investigação não encontrada ou sem permissão.';
  end if;
  if jsonb_typeof(p_findings) <> 'array'
     or jsonb_array_length(p_findings) < 1
     or jsonb_array_length(p_findings) > 30 then
    raise exception 'Selecione de 1 a 30 apontamentos para salvar.';
  end if;

  insert into public.evidence_audit_runs (
    user_id, investigation_id, overall_summary, evidence_count, source_count, audited_at
  ) values (
    v_user_id, p_investigation_id, left(coalesce(p_overall_summary, ''), 1800),
    greatest(coalesce(p_evidence_count, 0), 0),
    greatest(coalesce(p_source_count, 0), 0),
    coalesce(p_audited_at, now())
  ) returning id into v_run_id;

  for v_item in select value from jsonb_array_elements(p_findings)
  loop
    v_issue_type := v_item->>'issue_type';
    v_severity := v_item->>'severity';
    v_title := left(trim(coalesce(v_item->>'title','')),220);
    if v_issue_type not in ('direct_contradiction','factual_discrepancy','chronology_inconsistency','unsupported_claim','corroboration','source_dependence')
       or v_severity not in ('high','medium','low')
       or v_title = '' then
      raise exception 'Um apontamento contém classificação ou título inválido.';
    end if;
    if jsonb_typeof(v_item->'evidence_ids') <> 'array'
       or jsonb_array_length(v_item->'evidence_ids') < 1
       or jsonb_array_length(v_item->'evidence_ids') > 10 then
      raise exception 'Cada apontamento precisa ter de 1 a 10 vínculos de evidência.';
    end if;

    select array_agg(distinct value::uuid)
      into v_evidence_ids
    from jsonb_array_elements_text(v_item->'evidence_ids') as ids(value);
    if cardinality(v_evidence_ids) is null or cardinality(v_evidence_ids) < 1 then
      raise exception 'Nenhuma evidência válida foi indicada.';
    end if;
    if exists (
      select 1
      from unnest(v_evidence_ids) as requested(id)
      left join public.research_evidence_links rel
        on rel.id = requested.id
       and rel.user_id = v_user_id
       and rel.investigation_id = p_investigation_id
      where rel.id is null
    ) then
      raise exception 'Um vínculo de evidência não pertence a esta investigação.';
    end if;

    insert into public.evidence_audit_findings (
      run_id, user_id, investigation_id, issue_type, severity, title, explanation, next_step
    ) values (
      v_run_id, v_user_id, p_investigation_id, v_issue_type, v_severity, v_title,
      left(coalesce(v_item->>'explanation',''),1600),
      left(coalesce(v_item->>'next_step',''),700)
    ) returning id into v_finding_id;

    insert into public.evidence_audit_finding_evidence (
      finding_id, evidence_link_id, user_id, investigation_id
    )
    select v_finding_id, requested.id, v_user_id, p_investigation_id
    from unnest(v_evidence_ids) as requested(id);
    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('persisted', true, 'run_id', v_run_id, 'saved_findings', v_saved);
end;
$$;

revoke execute on function public.save_evidence_audit_findings(uuid,text,integer,integer,timestamptz,jsonb) from public, anon;
grant execute on function public.save_evidence_audit_findings(uuid,text,integer,integer,timestamptz,jsonb) to authenticated;
