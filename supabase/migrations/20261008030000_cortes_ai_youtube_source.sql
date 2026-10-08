-- CORTES AI: source URLs for supported video ingestion
alter table public.projects
  add column if not exists source_type text not null default 'upload',
  add column if not exists source_url text;

alter table public.projects
  drop constraint if exists projects_source_type_check;

alter table public.projects
  add constraint projects_source_type_check
  check (source_type in ('upload','youtube'));

create index if not exists projects_user_source_type_idx
  on public.projects(user_id, source_type);
