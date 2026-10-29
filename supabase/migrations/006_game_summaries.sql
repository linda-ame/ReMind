-- Finished memory-game measures. No boards and no symbol layouts.
-- Run after 005_home_view.sql.

create table if not exists public.game_summaries (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('memory_pairs', 'memory_pattern', 'memory_positions')),
  grid text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  category text,
  started_at timestamptz not null,
  studied_at timestamptz,
  completed_at timestamptz not null,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists game_summaries_user_id_idx
  on public.game_summaries (user_id, game, completed_at);

alter table public.game_summaries enable row level security;

drop policy if exists "game_summaries_select_own" on public.game_summaries;
create policy "game_summaries_select_own"
  on public.game_summaries for select
  using (auth.uid() = user_id);

drop policy if exists "game_summaries_insert_own" on public.game_summaries;
create policy "game_summaries_insert_own"
  on public.game_summaries for insert
  with check (auth.uid() = user_id);

drop policy if exists "game_summaries_update_own" on public.game_summaries;
create policy "game_summaries_update_own"
  on public.game_summaries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
