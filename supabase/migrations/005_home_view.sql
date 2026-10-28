-- Home screen choice: icons or the text list. Default is icons.
-- Run in Supabase SQL Editor after 004_memory_sessions.sql.

alter table public.user_settings
  add column if not exists home_view text not null default 'icons'
  check (home_view in ('text', 'icons'));
