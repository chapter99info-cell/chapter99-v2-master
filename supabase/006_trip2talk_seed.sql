-- Trip2Talk sample tour + guide content (run after 004 + 005)

alter table staff_profiles add column if not exists active boolean default true;
alter table client_guide_content add column if not exists active boolean default true;

insert into tours (
  trip_code, destination, start_date, end_date, price_aud, max_pax, current_pax, status
)
values (
  'NZ-AUT-2026', 'New Zealand', '2026-06-15', '2026-06-28', 2499, 20, 0, 'CONFIRMED'
)
on conflict (trip_code) do nothing;

insert into staff_profiles (full_name, role, phone, active)
select 'Demo Guide', 'GUIDE', '+61400000001', true
where not exists (select 1 from staff_profiles where role = 'GUIDE' limit 1);

insert into client_guide_content (dest, tab_type, title_en, title_th, payload, sort_order, active)
select v.dest, v.tab_type, v.title_en, v.title_th, v.payload::jsonb, v.sort_order, true
from (
  values
    ('New Zealand', 'content', 'Arrival tips', 'เคล็ดลับเมื่อถึง', '{"body":"Check in with your guide at the hotel lobby.","tips":["Keep passport handy","Buy a local SIM"]}', 1),
    ('New Zealand', 'photo', 'Sky Tower', 'สกายทาวเวอร์', '{"imageUrl":"https://images.unsplash.com/photo-1507699622109-496685a10e9e?w=800","difficulty":"easy"}', 1),
    ('New Zealand', 'food', 'Night market', 'ตลาดกลางคืน', '{"body":"Try local seafood — cash preferred.","tips":["Halal options limited"]}', 1)
) as v(dest, tab_type, title_en, title_th, payload, sort_order)
where not exists (
  select 1 from client_guide_content c
  where c.dest = v.dest and c.tab_type = v.tab_type and c.title_en = v.title_en
);
