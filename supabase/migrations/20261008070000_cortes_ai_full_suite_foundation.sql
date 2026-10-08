create table if not exists public.clip_ai_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  clip_id uuid references public.clips(id) on delete cascade,
  language text not null default 'pt-BR',
  titles jsonb not null default '[]'::jsonb,
  hooks jsonb not null default '[]'::jsonb,
  description text,
  hashtags jsonb not null default '[]'::jsonb,
  cta text,
  chapters jsonb not null default '[]'::jsonb,
  provider text, model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clip_ai_content_user_idx on public.clip_ai_content(user_id, created_at desc);
alter table public.clip_ai_content enable row level security;
create policy "clip ai content own" on public.clip_ai_content for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_media_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  prompt text not null,
  input_image_path text, provider text, provider_job_id text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  output_path text, error_message text, credits_reserved integer not null default 0,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists cortes_media_jobs_user_idx on public.cortes_media_jobs(user_id, created_at desc);
alter table public.cortes_media_jobs enable row level security;
create policy "media jobs own" on public.cortes_media_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_dubbing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_language text not null, target_language text not null,
  provider text, provider_job_id text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  output_path text, error_message text, credits_reserved integer not null default 0,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists cortes_dubbing_jobs_user_idx on public.cortes_dubbing_jobs(user_id, created_at desc);
alter table public.cortes_dubbing_jobs enable row level security;
create policy "dubbing jobs own" on public.cortes_dubbing_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','instagram','tiktok','facebook','x','linkedin','twitch','kick')),
  display_name text, external_account_id text,
  access_token_encrypted text, refresh_token_encrypted text,
  token_expires_at timestamptz, scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected' check (status in ('connected','expired','revoked','error')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists cortes_social_accounts_user_idx on public.cortes_social_accounts(user_id);
alter table public.cortes_social_accounts enable row level security;
create policy "social accounts own" on public.cortes_social_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  clip_id uuid references public.clips(id) on delete set null,
  social_account_id uuid references public.cortes_social_accounts(id) on delete set null,
  platform text not null, title text, description text,
  hashtags jsonb not null default '[]'::jsonb, scheduled_for timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed','cancelled')),
  external_post_id text, external_url text, error_message text,
  created_at timestamptz not null default now(), published_at timestamptz
);
create index if not exists cortes_publications_user_idx on public.cortes_publications(user_id, created_at desc);
alter table public.cortes_publications enable row level security;
create policy "publications own" on public.cortes_publications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_post_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.cortes_publications(id) on delete cascade,
  views bigint not null default 0, likes bigint not null default 0,
  comments bigint not null default 0, shares bigint not null default 0,
  saves bigint not null default 0, watch_time_seconds numeric not null default 0,
  captured_at timestamptz not null default now()
);
alter table public.cortes_post_analytics enable row level security;
create policy "analytics own" on public.cortes_post_analytics for select using (auth.uid() = user_id);

create table if not exists public.cortes_brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, logo_path text, primary_color text, secondary_color text,
  font_family text, caption_preset jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cortes_brand_kits enable row level security;
create policy "brand kits own" on public.cortes_brand_kits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cortes_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null, category text not null default 'general',
  config jsonb not null default '{}'::jsonb, is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.cortes_templates enable row level security;
create policy "templates visible" on public.cortes_templates for select using (is_public or auth.uid() = user_id);
create policy "templates own write" on public.cortes_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);