-- English captions for gallery upcoming trips (EN toggle)

alter table gallery_posts
  add column if not exists template_a_en text,
  add column if not exists template_b_en text;

-- Public read for client gallery (anon)
drop policy if exists "Public can read gallery_posts" on gallery_posts;
create policy "Public can read gallery_posts"
  on gallery_posts for select
  to anon
  using (true);
