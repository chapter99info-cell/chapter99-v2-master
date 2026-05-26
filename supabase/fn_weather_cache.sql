-- Trip2Talk: weather edge-function cache (run in Supabase SQL Editor)

create table if not exists public.weather_cache (
  cache_key text primary key,
  dest text,
  city text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists weather_cache_expires_idx on public.weather_cache (expires_at);

alter table public.weather_cache enable row level security;

drop policy if exists "anon_read_weather_cache" on public.weather_cache;
create policy "anon_read_weather_cache"
  on public.weather_cache
  for select
  to anon
  using (expires_at > now());
