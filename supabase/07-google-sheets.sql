-- Chapter99 V4 — Google Sheets sync settings per shop
alter table shops add column if not exists google_sheet_url text;
alter table shops add column if not exists google_sheet_sync_enabled boolean default false;
