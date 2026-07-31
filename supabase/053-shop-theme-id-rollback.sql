-- 053 rollback — remove theme_id from shops
alter table shops
  drop column if exists theme_id;
