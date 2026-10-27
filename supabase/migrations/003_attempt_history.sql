-- Keep earlier cycles when a learner starts over, and store on-screen time.
-- Run in the Supabase SQL Editor after 001 and 002.

alter table public.task_attempts
  add column if not exists archived_at timestamptz;

alter table public.task_attempts
  add column if not exists active_ms integer not null default 0;

alter table public.task_attempts
  drop constraint if exists task_attempts_active_ms_nonnegative;

alter table public.task_attempts
  add constraint task_attempts_active_ms_nonnegative
  check (active_ms >= 0);

comment on column public.task_attempts.archived_at is
  'Set when the learner starts over. The row stays for history and is hidden from current progress.';

comment on column public.task_attempts.active_ms is
  'Milliseconds the task was visible on screen. Not shown in the app.';

-- Once archived, later writes cannot change the historical row.
create or replace function public.keep_archived_attempt()
returns trigger
language plpgsql
as $$
begin
  if old.archived_at is not null then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists task_attempts_keep_archived on public.task_attempts;

create trigger task_attempts_keep_archived
  before update on public.task_attempts
  for each row execute function public.keep_archived_attempt();
