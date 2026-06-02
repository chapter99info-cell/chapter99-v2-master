-- Trip card cover images (portfolio bucket on niuibpznjvytprbrzvnn)
-- Run in Supabase SQL Editor → trip2talk-v4 (niuibpznjvytprbrzvnn)

alter table tours add column if not exists cover_image text;

comment on column tours.cover_image is 'Public URL for trip card hero/cover (portfolio bucket)';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/Tasmania/Hobart/1.jpg'
where trip_code = 'TAS-3D2N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/Melbourne/01.jpg'
where trip_code = 'MEL-4D3N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/Ulruru/1.jpg'
where trip_code = 'ULU-4D3N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/New%20Zealand/Cover/01.jpg'
where trip_code = 'NZ-6D5N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/Tasmania/Launceston/594961969_1428638085927955_7817067387013979508_n.jpg'
where trip_code = 'TAS-LH-4D3N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/One%20day%20trip%20SYD/35225886_2066269863700629_8276990772163641344_n.jpg'
where trip_code = 'KIA-1DAY';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/Cowra/1.jpg'
where trip_code = 'CAN-2D1N';

update tours set cover_image = 'https://niuibpznjvytprbrzvnn.supabase.co/storage/v1/object/public/portfolio/SYDNEY/505479211_10236865839535926_981414994444837633_n.jpg'
where trip_code = 'SYD-1DAY';
