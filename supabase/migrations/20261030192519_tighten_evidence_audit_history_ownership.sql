
drop policy "Users can insert their evidence audit runs" on public.evidence_audit_runs;
create policy "Users can insert their evidence audit runs"
  on public.evidence_audit_runs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investigations i
      where i.id = investigation_id and i.user_id = (select auth.uid())
    )
  );

drop policy "Users can insert their evidence audit findings" on public.evidence_audit_findings;
create policy "Users can insert their evidence audit findings"
  on public.evidence_audit_findings for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investigations i
      where i.id = investigation_id and i.user_id = (select auth.uid())
    )
  );

drop policy "Users can update their evidence audit findings" on public.evidence_audit_findings;
create policy "Users can update their evidence audit findings"
  on public.evidence_audit_findings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investigations i
      where i.id = investigation_id and i.user_id = (select auth.uid())
    )
  );

drop policy "Users can insert their evidence audit finding evidence" on public.evidence_audit_finding_evidence;
create policy "Users can insert their evidence audit finding evidence"
  on public.evidence_audit_finding_evidence for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.investigations i
      where i.id = investigation_id and i.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.evidence_audit_findings f
      where f.id = finding_id and f.user_id = (select auth.uid())
        and f.investigation_id = evidence_audit_finding_evidence.investigation_id
    )
  );

create index if not exists evidence_audit_findings_investigation_id_idx
  on public.evidence_audit_findings(investigation_id);
create index if not exists evidence_audit_findings_run_owner_fk_idx
  on public.evidence_audit_findings(run_id,user_id,investigation_id);
create index if not exists evidence_audit_runs_investigation_id_idx
  on public.evidence_audit_runs(investigation_id);
create index if not exists evidence_audit_finding_evidence_finding_fk_idx
  on public.evidence_audit_finding_evidence(finding_id,user_id,investigation_id);
create index if not exists evidence_audit_finding_evidence_link_fk_idx
  on public.evidence_audit_finding_evidence(evidence_link_id,user_id,investigation_id);
