alter table public.task_attempts
  add column if not exists wrong_tries integer not null default 0;

alter table public.task_attempts
  add column if not exists detail jsonb;
