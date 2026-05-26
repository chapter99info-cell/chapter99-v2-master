-- Trip2Talk content generator — saved AI captions + gallery image
-- Run once in Supabase SQL editor (after Storage bucket "gallery" exists)

create table if not exists gallery_posts (
  id uuid default gen_random_uuid() primary key,
  image_url text,
  location text,
  trip_type text,
  season text,
  template_a text,
  template_b text,
  template_c text,
  template_a_en text,
  template_b_en text,
  next_trip_date date,
  seats_remaining int,
  created_at timestamptz default now()
);

alter table gallery_posts enable row level security;

create policy "Authenticated users can read gallery_posts"
  on gallery_posts for select
  to authenticated
  using (true);

create policy "Authenticated users can insert gallery_posts"
  on gallery_posts for insert
  to authenticated
  with check (true);
