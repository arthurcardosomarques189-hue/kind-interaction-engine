-- CORTES AI: video storage and processing foundation
-- Apply this migration in the Supabase project before enabling real video uploads.

insert into storage.buckets (id, name, public)
values ('cortes-videos', 'cortes-videos', false)
on conflict (id) do nothing;

alter table public.projects
  add column if not exists video_path text,
  add column if not exists video_name text,
  add column if not exists video_size bigint,
  add column if not exists progress integer not null default 0,
  add column if not exists error_message text;

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  score integer not null default 0,
  video_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null default '',
  language text,
  created_at timestamptz not null default now()
);

alter table public.clips enable row level security;
alter table public.transcripts enable row level security;

drop policy if exists "Users can read own clips" on public.clips;
create policy "Users can read own clips"
on public.clips for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own transcripts" on public.transcripts;
create policy "Users can read own transcripts"
on public.transcripts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can upload own project videos" on storage.objects;
create policy "Users can upload own project videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cortes-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own project videos" on storage.objects;
create policy "Users can read own project videos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'cortes-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own project videos" on storage.objects;
create policy "Users can delete own project videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cortes-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
