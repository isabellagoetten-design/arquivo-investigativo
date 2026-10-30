-- Arquivo Investigativo: tabela de investigações
-- Execute este script no SQL Editor do Supabase.

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.investigations enable row level security;

drop policy if exists "Users can view their own investigations" on public.investigations;
create policy "Users can view their own investigations"
on public.investigations for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own investigations" on public.investigations;
create policy "Users can create their own investigations"
on public.investigations for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own investigations" on public.investigations;
create policy "Users can update their own investigations"
on public.investigations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own investigations" on public.investigations;
create policy "Users can delete their own investigations"
on public.investigations for delete
to authenticated
using (auth.uid() = user_id);
