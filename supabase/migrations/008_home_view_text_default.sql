-- Text list is the home default. A saved icons choice stays icons.
alter table public.user_settings
  alter column home_view set default 'text';
