-- Trip booking form + payment slips

create table if not exists trip_bookings (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  phone text not null,
  email text,
  trip_type text not null,
  num_people int default 1,
  special_requests text,
  referral_source text,
  slip_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table trip_bookings enable row level security;

drop policy if exists "Public can insert trip_bookings" on trip_bookings;
create policy "Public can insert trip_bookings"
  on trip_bookings for insert
  to anon
  with check (true);

drop policy if exists "Public can read trip_bookings" on trip_bookings;
create policy "Public can read trip_bookings"
  on trip_bookings for select
  to anon
  using (true);

drop policy if exists "Public can update trip_bookings" on trip_bookings;
create policy "Public can update trip_bookings"
  on trip_bookings for update
  to anon
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-slips',
  'booking-slips',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "booking slips anon upload" on storage.objects;
create policy "booking slips anon upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'booking-slips');

drop policy if exists "booking slips public read" on storage.objects;
create policy "booking slips public read"
  on storage.objects for select
  to public
  using (bucket_id = 'booking-slips');
