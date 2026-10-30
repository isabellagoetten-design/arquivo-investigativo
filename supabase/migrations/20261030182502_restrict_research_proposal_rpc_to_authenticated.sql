revoke all on function public.accept_research_proposals(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.accept_research_proposals(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
