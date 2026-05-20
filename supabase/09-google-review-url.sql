-- Chapter99 V4 — Google Review URL for POS QR prompt (not on printed receipt)
alter table shops add column if not exists google_review_url text;
