alter table public.exports add column if not exists output_path text;
create index if not exists exports_output_path_idx on public.exports(output_path);