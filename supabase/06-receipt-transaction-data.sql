-- Optional: store full transaction snapshot on each receipt
alter table receipts add column if not exists transaction_data jsonb;
