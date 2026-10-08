-- CORTES AI: real MP4 export jobs
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  clip_id uuid not null references public.clips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'shotstack',
  render_id text,
  status text not null default 'queued',
  output_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exports enable row level security;

drop policy if exists "Users can read own exports" on public.exports;
create policy "Users can read own exports"
on public.exports for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own exports" on public.exports;
create policy "Users can create own exports"
on public.exports for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own exports" on public.exports;
create policy "Users can update own exports"
on public.exports for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists exports_project_id_idx on public.exports(project_id);
create index if not exists exports_user_id_idx on public.exports(user_id);
