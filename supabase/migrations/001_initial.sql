-- ReMind V1: patient auth + progress sync
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'patient'
    check (role in ('patient', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  content_scale numeric not null default 1,
  text_align text not null default 'center'
    check (text_align in ('left', 'center', 'right')),
  text_position text not null default 'middle'
    check (text_position in ('top', 'middle', 'bottom')),
  high_contrast boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attempts (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id text not null,
  content_version integer not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null
    check (status in ('viewed', 'attempted', 'completed')),
  entered_answer text,
  used_hint boolean not null default false,
  viewed_answers boolean not null default false,
  self_assessment text
    check (
      self_assessment is null
      or self_assessment in ('independent', 'with_help', 'difficult', 'skipped')
    ),
  reading jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists task_attempts_user_id_idx
  on public.task_attempts (user_id);

create index if not exists task_attempts_user_task_idx
  on public.task_attempts (user_id, task_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile + default settings on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'patient')
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security (patient owns their rows; viewer links come in V2)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.task_attempts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "attempts_select_own" on public.task_attempts;
create policy "attempts_select_own"
  on public.task_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.task_attempts;
create policy "attempts_insert_own"
  on public.task_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "attempts_update_own" on public.task_attempts;
create policy "attempts_update_own"
  on public.task_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "attempts_delete_own" on public.task_attempts;
create policy "attempts_delete_own"
  on public.task_attempts for delete
  using (auth.uid() = user_id);
