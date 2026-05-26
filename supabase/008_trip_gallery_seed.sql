-- Seed trip_gallery rows (upload files to trip-gallery bucket at these paths)

insert into trip_gallery (storage_path, caption_th, caption_en, dest, sort_order, camera_metadata)
values
  (
    'NZ-2025/01-milford-sound.jpg',
    'มิลฟอร์ดซาวด์ — หุบเขาน้ำแข็ง',
    'Milford Sound — glacier fjord',
    'New Zealand',
    1,
    '{"camera_make":"Canon","camera_model":"EOS R6","lens":"RF 24-70mm","focal_length":"35mm","aperture":"f/8","shutter_speed":"1/500s","iso":"200","taken_at":"2025-03-12T14:22:00+13:00","location":"Milford Sound"}'::jsonb
  ),
  (
    'NZ-2025/02-queenstown-lake.jpg',
    'ควีนส์ทาวน์ — ทะเลสาบวาคาติพู',
    'Queenstown — Lake Wakatipu sunset',
    'New Zealand',
    2,
    '{"camera_make":"Sony","camera_model":"A7 IV","lens":"FE 16-35mm","focal_length":"24mm","aperture":"f/11","shutter_speed":"1/250s","iso":"100","taken_at":"2025-03-14T19:45:00+13:00","location":"Queenstown"}'::jsonb
  ),
  (
    'NZ-2025/03-hobbiton.jpg',
    'ฮอบบิตัน — ฟาร์มมาตา',
    'Hobbiton — Matamata film set',
    'New Zealand',
    3,
    '{"camera_make":"Fujifilm","camera_model":"X-T5","lens":"XF 23mm","focal_length":"23mm","aperture":"f/5.6","shutter_speed":"1/320s","iso":"160","taken_at":"2025-03-15T11:10:00+13:00","location":"Matamata"}'::jsonb
  ),
  (
    'NZ-2025/04-rotorua-geothermal.jpg',
    'โรโตรัว — พื้นที่ความร้อนใต้พิภพ',
    'Rotorua — geothermal valley',
    'New Zealand',
    4,
    '{"camera_make":"Nikon","camera_model":"Z6 II","lens":"Z 24-70mm","focal_length":"50mm","aperture":"f/7.1","shutter_speed":"1/400s","iso":"320","taken_at":"2025-03-16T09:30:00+13:00","location":"Rotorua"}'::jsonb
  ),
  (
    'NZ-2025/05-auckland-sky-tower.jpg',
    'ออกแลนด์ — สกายทาวเวอร์ยามค่ำ',
    'Auckland — Sky Tower at dusk',
    'New Zealand',
    5,
    '{"camera_make":"Apple","camera_model":"iPhone 15 Pro","lens":"Main","focal_length":"24mm","aperture":"f/1.78","shutter_speed":"1/120s","iso":"64","taken_at":"2025-03-18T18:05:00+13:00","location":"Auckland CBD"}'::jsonb
  )
on conflict (storage_path) do update set
  caption_th = excluded.caption_th,
  caption_en = excluded.caption_en,
  dest = excluded.dest,
  sort_order = excluded.sort_order,
  camera_metadata = excluded.camera_metadata;
