-- Chapter99 V4 — Gift Vouchers (POS sell + redeem)
-- Run in Supabase SQL Editor after prior phases

-- ── Table ─────────────────────────────────────────────────────
create table if not exists gift_vouchers (
  id                uuid primary key default uuid_generate_v4(),
  code              text not null unique,
  original_amount   numeric(10,2) not null check (original_amount > 0),
  remaining_balance numeric(10,2) not null check (remaining_balance >= 0),
  expiry_date       date not null,
  status            text not null default 'active'
    check (status in ('active', 'redeemed', 'expired')),
  purchased_via     text not null default 'pos'
    check (purchased_via in ('web', 'pos')),
  buyer_name        text,
  buyer_email       text,
  shop_id           text not null references shops(id) on delete cascade,
  created_at        timestamptz default now()
);

create index if not exists gift_vouchers_shop_created
  on gift_vouchers(shop_id, created_at desc);

create index if not exists gift_vouchers_code
  on gift_vouchers(upper(code));

-- ── Auto-generate code: CH99-XXXX (4 chars, no ambiguous 0/O/I/1) ──
create or replace function generate_gift_voucher_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text := '';
  i int;
  new_code text;
begin
  loop
    suffix := '';
    for i in 1..4 loop
      suffix := suffix || substr(chars, (floor(random() * length(chars))::int + 1), 1);
    end loop;
    new_code := 'CH99-' || suffix;
    exit when not exists (select 1 from gift_vouchers where code = new_code);
  end loop;
  return new_code;
end;
$$;

create or replace function gift_vouchers_set_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := generate_gift_voucher_code();
  end if;
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists trg_gift_vouchers_set_code on gift_vouchers;
create trigger trg_gift_vouchers_set_code
  before insert on gift_vouchers
  for each row execute function gift_vouchers_set_code();

-- ── Validate (read-only, for POS lookup) ──────────────────────
create or replace function validate_gift_voucher(p_code text, p_shop_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v gift_vouchers%rowtype;
begin
  select * into v
  from gift_vouchers
  where upper(trim(code)) = upper(trim(p_code))
    and shop_id = p_shop_id;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Invalid voucher code');
  end if;

  if v.expiry_date < current_date then
    update gift_vouchers set status = 'expired' where id = v.id and status = 'active';
    return jsonb_build_object('valid', false, 'error', 'Voucher has expired');
  end if;

  if v.status = 'redeemed' then
    return jsonb_build_object('valid', false, 'error', 'Voucher already fully redeemed');
  end if;

  if v.status = 'expired' then
    return jsonb_build_object('valid', false, 'error', 'Voucher has expired');
  end if;

  if v.remaining_balance <= 0 then
    return jsonb_build_object('valid', false, 'error', 'Voucher has no balance');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', v.code,
    'original_amount', v.original_amount,
    'remaining_balance', v.remaining_balance,
    'expiry_date', v.expiry_date,
    'status', v.status,
    'buyer_name', v.buyer_name
  );
end;
$$;

-- ── Redeem (atomic deduct on payment) ─────────────────────────
create or replace function redeem_gift_voucher(
  p_code text,
  p_shop_id text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v gift_vouchers%rowtype;
  v_deduct numeric;
  v_new_balance numeric;
  v_new_status text;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  end if;

  select * into v
  from gift_vouchers
  where upper(trim(code)) = upper(trim(p_code))
    and shop_id = p_shop_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid voucher code');
  end if;

  if v.expiry_date < current_date then
    update gift_vouchers set status = 'expired' where id = v.id;
    return jsonb_build_object('success', false, 'error', 'Voucher has expired');
  end if;

  if v.status in ('redeemed', 'expired') then
    return jsonb_build_object('success', false, 'error', 'Voucher is not active');
  end if;

  if v.remaining_balance <= 0 then
    return jsonb_build_object('success', false, 'error', 'Voucher has no balance');
  end if;

  v_deduct := least(p_amount, v.remaining_balance);
  v_new_balance := round((v.remaining_balance - v_deduct)::numeric, 2);
  v_new_status := case when v_new_balance <= 0 then 'redeemed' else 'active' end;

  update gift_vouchers
  set remaining_balance = v_new_balance,
      status = v_new_status
  where id = v.id;

  return jsonb_build_object(
    'success', true,
    'code', v.code,
    'deducted', v_deduct,
    'remaining_balance', v_new_balance,
    'status', v_new_status
  );
end;
$$;

-- ── RLS (anon — same pattern as receipts / transactions) ─────
alter table gift_vouchers enable row level security;

drop policy if exists "anon_select_gift_vouchers" on gift_vouchers;
create policy "anon_select_gift_vouchers" on gift_vouchers
  for select to anon, authenticated
  using (shop_id is not null);

drop policy if exists "anon_insert_gift_vouchers" on gift_vouchers;
create policy "anon_insert_gift_vouchers" on gift_vouchers
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_gift_vouchers" on gift_vouchers;
create policy "anon_update_gift_vouchers" on gift_vouchers
  for update to anon, authenticated
  using (true)
  with check (true);

grant execute on function validate_gift_voucher(text, text) to anon, authenticated;
grant execute on function redeem_gift_voucher(text, text, numeric) to anon, authenticated;
