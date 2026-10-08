-- CORTES AI: large video transcription jobs
-- Removes the 24 MB application-level transcription constraint by delegating
-- long-file speech-to-text to an asynchronous provider that can read a signed
-- Storage URL without loading the whole video into a Supabase Edge Function.

alter table public.projects
  add column if not exists transcription_provider text,
  add column if not exists transcription_job_id text,
  add column if not exists transcription_status text;

create index if not exists projects_transcription_job_id_idx
  on public.projects (transcription_job_id)
  where transcription_job_id is not null;
