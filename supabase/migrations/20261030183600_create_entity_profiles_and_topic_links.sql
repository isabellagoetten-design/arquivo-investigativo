create table if not exists public.entity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('person','organization','place','event','concept','other')),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 180),
  summary text,
  aliases text[] not null default '{}',
  external_identifier text,
  external_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_profiles_id_user_unique unique (id,user_id)
);

create index if not exists entity_profiles_user_type_name_idx
  on public.entity_profiles (user_id,entity_type,canonical_name);

alter table public.topics
  add column if not exists entity_profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'topics_entity_profile_owner_fk'
      and conrelid = 'public.topics'::regclass
  ) then
    alter table public.topics
      add constraint topics_entity_profile_owner_fk
      foreign key (entity_profile_id,user_id)
      references public.entity_profiles(id,user_id)
      on delete restrict;
  end if;
end $$;

create index if not exists topics_entity_profile_id_idx
  on public.topics(entity_profile_id)
  where entity_profile_id is not null;

alter table public.entity_profiles enable row level security;

drop policy if exists entity_profiles_select_own on public.entity_profiles;
create policy entity_profiles_select_own on public.entity_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists entity_profiles_insert_own on public.entity_profiles;
create policy entity_profiles_insert_own on public.entity_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists entity_profiles_update_own on public.entity_profiles;
create policy entity_profiles_update_own on public.entity_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists entity_profiles_delete_own on public.entity_profiles;
create policy entity_profiles_delete_own on public.entity_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.entity_profiles from anon;
grant select,insert,update,delete on public.entity_profiles to authenticated;
grant select,insert,update on public.topics to authenticated;
