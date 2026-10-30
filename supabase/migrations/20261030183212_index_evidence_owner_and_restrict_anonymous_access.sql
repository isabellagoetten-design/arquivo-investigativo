create index if not exists research_evidence_links_user_id_idx
  on public.research_evidence_links (user_id);

revoke all on table public.research_evidence_links from anon;
grant select, insert, delete on table public.research_evidence_links to authenticated;
