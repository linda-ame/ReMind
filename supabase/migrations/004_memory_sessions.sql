-- Memory practice sessions. The app does not show this recap after each task.
-- Run in Supabase SQL Editor after 003_attempt_history.sql.

create table if not exists public.memory_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('immediate', 'delayed')),
  task_id text not null,
  completed_at timestamptz,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists memory_sessions_user_id_idx
  on public.memory_sessions (user_id);

alter table public.memory_sessions enable row level security;

drop policy if exists "memory_sessions_select_own" on public.memory_sessions;
create policy "memory_sessions_select_own"
  on public.memory_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "memory_sessions_insert_own" on public.memory_sessions;
create policy "memory_sessions_insert_own"
  on public.memory_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "memory_sessions_update_own" on public.memory_sessions;
create policy "memory_sessions_update_own"
  on public.memory_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "memory_sessions_delete_own" on public.memory_sessions;
create policy "memory_sessions_delete_own"
  on public.memory_sessions for delete
  using (auth.uid() = user_id);
